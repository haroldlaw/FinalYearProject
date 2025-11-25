require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')
const connectDB = require('./config/db')
const userRoutes = require('./routes/userRoutes')
const imageRoutes = require('./routes/imageRoutes')

const app = express()

console.log('Starting server...')

// Simple CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`)
  next()
})

// Connect to database
connectDB()

// Routes
app.use('/api/users', userRoutes)
app.use('/api/images', imageRoutes)

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Backend API Server' })
})

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  })
})

const PORT = process.env.PORT || 9000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})