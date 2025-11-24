const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  cloudinaryUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  storageType: {
    type: String,
    enum: ['cloudinary', 'local'],
    default: 'cloudinary'
  },
  analysisResult: {
    confidence: Number,
    tags: [String],
    description: String,
    analysisDate: Date
  }
}, {
  timestamps: true
})

// Index for performance
imageSchema.index({ uploadDate: -1 })
imageSchema.index({ cloudinaryPublicId: 1 })

const Image = mongoose.model('Image', imageSchema)

module.exports = Image