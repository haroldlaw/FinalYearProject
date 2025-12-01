const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const router = express.Router()

// sign up
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Check if user exists
    const existingUser = await User.findByEmail(email)
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // create user
    const newUser = new User({ 
      username, 
      email: email.toLowerCase(), 
      password 
    })
    await newUser.save()

    console.log('New user registered:', newUser.email)

    // Create JWT payload
    const payload = {
      userId: newUser._id,
      email: newUser.email,
      username: newUser.username
    }

    // Generate JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    )

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ 
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          createdAt: newUser.createdAt
        }
      }
    })
  } catch (error) {
    console.error('Error registering user:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user by email
    const user = await User.findByEmail(email)
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' })
    }

    // Compare password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' })
    }

    console.log('User logged in:', user.email)

    // Create JWT payload
    const payload = {
      userId: user._id,
      email: user.email,
      username: user.username
    }

    // Generate JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    )

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({ 
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        }
      }
    })
  } catch (error) {
    console.error('Error logging in user:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user upload history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const Image = require('../models/Image');
    
    // First, try to find images for this user
    let images = await Image.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .exec();
    
    // If no images found, check if there are orphaned images (without userId)
    if (images.length === 0) {
      const orphanedImages = await Image.find({ userId: { $exists: false } })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();
      
      // For demo purposes, assign orphaned images to the current user
      if (orphanedImages.length > 0) {
        await Image.updateMany(
          { userId: { $exists: false } },
          { $set: { userId: req.userId } }
        );
        
        // Fetch again after assignment
        images = await Image.find({ userId: req.userId })
          .sort({ createdAt: -1 })
          .exec();
      }
    }
    
    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch upload history' 
    });
  }
});

// Delete user image
router.delete('/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const Image = require('../models/Image');
    const image = await Image.findOne({ 
      _id: req.params.imageId, 
      userId: req.userId 
    });

    if (!image) {
      return res.status(404).json({ 
        success: false,
        error: 'Image not found or you do not have permission to delete it' 
      });
    }

    await Image.findByIdAndDelete(req.params.imageId);
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete image' 
    });
  }
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

module.exports = router