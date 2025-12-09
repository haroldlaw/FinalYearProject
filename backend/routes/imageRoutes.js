const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const jwt = require('jsonwebtoken');
const Image = require("../models/Image");
const { analyzeImageWithAI } = require("../services/imageAnalysisService");
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

    // Perform AI analysis on the uploaded image
    console.log(`🔍 Starting image analysis for: ${req.file.originalname}`);
    const analysisResult = await analyzeImageWithAI(req.file.buffer, req.file.originalname);
    console.log(`📊 Analysis method used: ${analysisResult.analysisMethod} (${analysisResult.analysisSource})`);

    // Save image data to MongoDB with AI analysis scores
    const imageData = new Image({
      userId: req.userId, // Associate with authenticated user
      originalName: req.file.originalname,
      cloudinaryUrl: uploadResponse.secure_url,
      cloudinaryPublicId: uploadResponse.public_id,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      storageType: "cloudinary",
      analysisScore: analysisResult.overallScore, // Use AI-generated overall score
      // Store AI analysis scores for consistent retrieval
      compositionScore: analysisResult.compositionScore,
      focusScore: analysisResult.focusScore,
      exposureScore: analysisResult.exposureScore,
      colorScore: analysisResult.colorScore,
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

module.exports = router;
