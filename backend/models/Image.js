const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  analysisScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
})

// Index for performance
imageSchema.index({ uploadDate: -1 })
imageSchema.index({ cloudinaryPublicId: 1 })
imageSchema.index({ userId: 1, uploadDate: -1 }) // For user-specific queries

const Image = mongoose.model('Image', imageSchema)

module.exports = Image