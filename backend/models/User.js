const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [2, 'Username must be at least 2 characters long'],
    maxlength: [50, 'Username cannot exceed 50 characters'],
    validate: {
      validator: function(v) {
        // Only letters, spaces, apostrophes, and hyphens allowed
        return /^[a-zA-Z\s'-]+$/.test(v)
      },
      message: 'Username can only contain letters, spaces, apostrophes, and hyphens'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Email validation regex
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
      },
      message: 'Please enter a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function(v) {
        // Password must contain at least one uppercase, lowercase, number, and special character
        const hasUpperCase = /[A-Z]/.test(v)
        const hasLowerCase = /[a-z]/.test(v)
        const hasNumbers = /\d/.test(v)
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(v)
        
        return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive fields when converting to JSON
      delete ret.password
      delete ret.emailVerificationToken
      delete ret.passwordResetToken
      delete ret.loginAttempts
      delete ret.lockUntil
      return ret
    }
  }
})

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next()
  
  try {
    console.log('Hashing password for user:', this.email)
    
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    
    console.log('Password hashed successfully')
    next()
  } catch (error) {
    console.error('Error hashing password:', error)
    next(error)
  }
})

// Instance method to compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
  try {
    console.log('Comparing password for user:', this.email)
    
    const isMatch = await bcrypt.compare(enteredPassword, this.password)
    
    console.log('Password comparison result:', isMatch ? 'MATCH' : 'NO MATCH')
    return isMatch
  } catch (error) {
    console.error('Error comparing password:', error)
    throw error
  }
}

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  console.log('Incrementing login attempts for user:', this.email)
  
  // If a previous lock has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    })
  }
  
  const updates = { $inc: { loginAttempts: 1 } }
  
  // Lock account after 5 failed attempts for 5 minutes
  const maxAttempts = 5
  const lockTime = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime }
    console.log('Account locked due to too many failed attempts')
  }
  
  return this.updateOne(updates)
}

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  console.log('Resetting login attempts for user:', this.email)
  
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  })
}

// Static method to find user by email (case insensitive)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email })
}

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto')
  const resetToken = crypto.randomBytes(32).toString('hex')
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
  
  console.log('Generated password reset token for user:', this.email)
  
  return resetToken
}

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto')
  const verificationToken = crypto.randomBytes(32).toString('hex')
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex')
  
  console.log('Generated email verification token for user:', this.email)
  
  return verificationToken
}

// Pre-remove middleware
userSchema.pre('remove', function(next) {
  console.log('Removing user:', this.email)
  next()
})

// Export the model
const User = mongoose.model('User', userSchema)

module.exports = User