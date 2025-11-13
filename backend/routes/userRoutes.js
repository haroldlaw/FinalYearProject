const express = require('express')
const User = require('../models/User')
const jwt = require('jsonwebtoken')

const router = express.Router()

// register new user
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Check if user already exists
    const existingUser = await User.findByEmail(email)
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // Create new user
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
      { expiresIn: '24h' } // Token expires in 24 hours
    )

    console.log('JWT token generated for user:', newUser.email)

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    })
  } catch (error) {
    console.error('Error registering user:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router