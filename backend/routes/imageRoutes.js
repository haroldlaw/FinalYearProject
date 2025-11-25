const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Image = require("../models/Image");
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
router.post("/upload", upload.single("analysisImage"), async (req, res) => {
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

    // Save image data to MongoDB
    const imageData = new Image({
      originalName: req.file.originalname,
      cloudinaryUrl: uploadResponse.secure_url,
      cloudinaryPublicId: uploadResponse.public_id,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      storageType: "cloudinary",
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
      },
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });

    // Handle specific Cloudinary errors
    if (error.http_code) {
      console.error("- Cloudinary HTTP code:", error.http_code);
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

// Delete image
router.delete("/:id", async (req, res) => {
  try {
    console.log("Deleting image:", req.params.id);

    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Delete from Cloudinary if it exists there
    if (image.cloudinaryPublicId) {
      console.log("Deleting from Cloudinary...");
      await cloudinary.uploader.destroy(image.cloudinaryPublicId);
      console.log("Deleted from Cloudinary");
    }

    // Delete from database
    await Image.findByIdAndDelete(req.params.id);
    console.log("Deleted from database");

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      error: "Failed to delete image",
      details: error.message,
    });
  }
});

module.exports = router;
