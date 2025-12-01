import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Home from './pages/Home'
import Result from './pages/Result'
import Profile from './pages/Profile'

function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home" element={<Home />} />
          <Route path="/result" element={<Result />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Router>
  )
}

export default App