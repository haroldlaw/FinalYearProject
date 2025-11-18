const express = require('express')
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const router = express.Router()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Configure multer for memory storage
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'), false)
    }
  }
})

// Upload analysis image (for AI processing)
router.post('/upload', upload.single('analysisImage'), async (req, res) => {
  try {
    console.log('Uploading image')

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    // Upload to Cloudinary
    const uploadResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'analysis-images',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(req.file.buffer)
    })

    console.log('Image uploaded successfully')

    // Here you can save to database or process with AI
    res.json({
      message: 'Image uploaded successfully for analysis',
      imageUrl: uploadResponse.secure_url,
      publicId: uploadResponse.public_id
    })

  } catch (error) {
    console.error('Error uploading image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

module.exports = router