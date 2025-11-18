const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const imageRoutes = require('./routes/imageRoutes');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}))

dotenv.config();

const PORT = process.env.PORT || 3000;

// connect to database
connectDB();

app.get('/', (req, res) => {
  res.send('Server is running');
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes)

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

