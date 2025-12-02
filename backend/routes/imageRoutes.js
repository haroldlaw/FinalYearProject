const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const jwt = require('jsonwebtoken');
const Image = require("../models/Image");
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware to authenticate token from cookie
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Upload analysis image (for AI processing)
router.post("/upload", authenticateToken, upload.single("analysisImage"), async (req, res) => {
  try {
    console.log("Uploading image");

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // Upload to Cloudinary
    const uploadResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "image",
            folder: "analysis-images",
            transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
            // Add unique public_id to avoid conflicts
            public_id: `analysis_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    console.log("Image uploaded successfully");

    // mock analysis result
    const analysisResult = {
      confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
      analysisDate: new Date(),
      processingTime: Math.floor(Math.random() * 3000) + 1000, // Mock processing time

      // Photography Analysis Aspects
      composition: {
        ruleOfThirds: ["Well Applied", "Partially Applied", "Not Applied"][
          Math.floor(Math.random() * 3)
        ],
        balance: ["Balanced", "Slightly Unbalanced", "Well Balanced"][
          Math.floor(Math.random() * 3)
        ],
        leadingLines: ["Present", "Strong", "Subtle", "Absent"][
          Math.floor(Math.random() * 4)
        ],
        symmetry: ["Good", "Excellent", "Fair", "Poor"][
          Math.floor(Math.random() * 4)
        ],
      },

      focus: {
        sharpness: ["Sharp", "Very Sharp", "Slightly Soft", "Soft"][
          Math.floor(Math.random() * 4)
        ],
        depthOfField: ["Appropriate", "Shallow", "Deep", "Too Shallow"][
          Math.floor(Math.random() * 4)
        ],
        focusPoint: ["Well Placed", "Centered", "Off-Center", "Poor"][
          Math.floor(Math.random() * 4)
        ],
      },

      exposure: {
        level: [
          "Perfectly Exposed",
          "Slightly Overexposed",
          "Slightly Underexposed",
        ][Math.floor(Math.random() * 4)],
        highlights: ["Preserved", "Blown Out", "Well Controlled", "Clipped"][
          Math.floor(Math.random() * 4)
        ],
        shadows: ["Detailed", "Too Dark", "Well Lifted", "Crushed"][
          Math.floor(Math.random() * 4)
        ],
        dynamicRange: ["Good", "Excellent", "Limited", "Wide"][
          Math.floor(Math.random() * 4)
        ],
      },

      color: {
        whiteBalance: ["Too Warm", "Too Cool", "Natural"][
          Math.floor(Math.random() * 4)
        ],
        contrast: ["High", "Low", "Balanced"][
          Math.floor(Math.random() * 4)
        ],
      },

      imageProperties: {
        width: uploadResponse.width,
        height: uploadResponse.height,
        format: uploadResponse.format,
        colorSpace: "sRGB",
        quality: "auto-optimized",
      },

      recommendations: [
        "Consider experimenting with different angles for more dynamic composition",
        "Try adjusting exposure slightly to enhance detail in shadows",
        "The current color balance works well for this subject matter",
        "Focus point placement follows good photography principles",
      ],
    };

    // Save image data to MongoDB
    const imageData = new Image({
      userId: req.userId, // Associate with authenticated user
      originalName: req.file.originalname,
      cloudinaryUrl: uploadResponse.secure_url,
      cloudinaryPublicId: uploadResponse.public_id,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      storageType: "cloudinary",
      analysisScore: analysisResult.confidence, // Add the analysis score
    });

    const savedImage = await imageData.save();
    console.log("Image data saved to database with ID:", savedImage._id);

    // Return success response
    res.json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageId: savedImage._id,
        imageUrl: uploadResponse.secure_url,
        publicId: uploadResponse.public_id,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        uploadDate: savedImage.uploadDate,
        analysisResult: analysisResult,
      },
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });

    // Handle specific Cloudinary errors
    if (error.http_code) {
      console.error("Cloudinary HTTP code:", error.http_code);
      return res.status(500).json({
        error: "Cloudinary upload failed",
        details: error.message,
        code: error.http_code,
      });
    }

    res.status(500).json({
      error: "Failed to upload image",
      details: error.message,
    });
  }
});

// Get all uploaded images
router.get("/list", async (req, res) => {
  try {
    console.log("Fetching all images");

    const images = await Image.find().sort({ uploadDate: -1 }).limit(50); // Limit to last 50 images

    console.log(`Found ${images.length} images`);

    res.json({
      success: true,
      count: images.length,
      images: images,
    });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({
      error: "Failed to fetch images",
      details: error.message,
    });
  }
});

// Get specific image by ID
router.get("/:id", async (req, res) => {
  try {
    console.log("Fetching image:", req.params.id);

    const image = await Image.findById(req.params.id);

    if (!image) {
      console.log("Image not found");
      return res.status(404).json({ error: "Image not found" });
    }

    console.log("Image found:", image.originalName);

    res.json({
      success: true,
      image: image,
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({
      error: "Failed to fetch image",
      details: error.message,
    });
  }
});

module.exports = router;
