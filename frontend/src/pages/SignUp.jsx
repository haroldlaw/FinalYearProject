import React, { useState } from 'react'
import { Link, useNavigate } from "react-router-dom";
import background from '../assets/background.jpg'

const SignUp = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear specific field error when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ''
      })
    }
  }

const validateForm = () => {
  const newErrors = {}

  // Username validation 
  const nameRegex = /^[a-zA-Z\s'-]+$/
  if (!formData.username.trim()) {
    newErrors.username = 'Username is required'
  } else if (!nameRegex.test(formData.username.trim())) {
    newErrors.username = 'Username cannot contain numbers or special characters'
  } 

  // Email validation 
  if (!formData.email.trim()) {
    newErrors.email = 'Email is required'
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }
  }

  // Email confirmation validation
  if (!formData.confirmEmail.trim()) {
    newErrors.confirmEmail = 'Please confirm your email'
  } else if (formData.email.trim() && formData.confirmEmail.trim() && formData.email.trim() !== formData.confirmEmail.trim()) {
    newErrors.confirmEmail = 'Email does not match'
  }

  // Password validation 
  if (!formData.password) {
    newErrors.password = 'Password is required'
  } else if (formData.password.length < 8) {
    newErrors.password = 'Password must have at least 8 characters'
  } else {
    // Additional password strength requirements
    const hasUpperCase = /[A-Z]/.test(formData.password)
    const hasLowerCase = /[a-z]/.test(formData.password)
    const hasNumbers = /\d/.test(formData.password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)

    if (!hasUpperCase) {
      newErrors.password = 'Password must contain at least one uppercase letter'
    } else if (!hasLowerCase) {
      newErrors.password = 'Password must contain at least one lowercase letter'
    } else if (!hasNumbers) {
      newErrors.password = 'Password must contain at least one number'
    } else if (!hasSpecialChar) {
      newErrors.password = 'Password must contain at least one special character'
    }
  }

  // Password confirmation validation
  if (!formData.confirmPassword) {
    newErrors.confirmPassword = 'Please confirm your password'
  } else if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
    newErrors.confirmPassword = 'Password does not match'
  }

  return newErrors
}

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    // Validate form
    const formErrors = validateForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      setLoading(false)
      return
    }

    try {
      // API call will go here - for now just simulate
      console.log('SignUp data:', formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Show success message and navigate to login
      alert('Account created successfully! Please log in.')
      navigate('/login')
    } catch (error) {
      console.error('SignUp error:', error)
      setErrors({ general: 'Failed to create account. Please try again.' })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex justify-center items-center" 
         style={{ 
           position: 'fixed',
           top: 0,
           left: 0,
           width: '100vw',
           height: '100vh',
           backgroundImage: `url(${background})`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat'
         }}>
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-black/30 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-8 px-8">
          <h2 className="text-[28px] font-bold text-white mb-6 text-center">
            Sign Up
          </h2>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            {errors.general && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{errors.general}</p>
              </div>
            )}
            
            <input
              name="username"
              placeholder="Username"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              required
            />
            {errors.username && <p className="text-red-400 text-sm mb-3 -mt-3">{errors.username}</p>}
            
            <input
              name="email"
              placeholder="Email"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            {errors.email && <p className="text-red-400 text-sm mb-3 -mt-3">{errors.email}</p>}
            
            <input
              name="confirmEmail"
              placeholder="Confirm Email"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="email"
              value={formData.confirmEmail}
              onChange={handleInputChange}
              required
            />
            {errors.confirmEmail && <p className="text-red-400 text-sm mb-3 -mt-3">{errors.confirmEmail}</p>}
            
            <input
              name="password"
              placeholder="Password"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
            {errors.password && <p className="text-red-400 text-sm mb-3 -mt-3">{errors.password}</p>}
            
            <input
              name="confirmPassword"
              placeholder="Confirm Password"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
            />
            {errors.confirmPassword && <p className="text-red-400 text-sm mb-3 -mt-3">{errors.confirmPassword}</p>}
            <button
              className="bg-linear-to-r from-indigo-500/80 to-blue-500/80 backdrop-blur-sm text-white font-medium py-3 px-4 rounded-md hover:from-indigo-600/90 hover:to-blue-600/90 border border-white/20 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin mr-2">⚡</span>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
            <p className="text-white mt-4 text-center">
              Already have an account?
              <Link 
                className="text-blue-400 hover:underline mt-4 px-1 ml-1" 
                to="/login"
              >
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUp