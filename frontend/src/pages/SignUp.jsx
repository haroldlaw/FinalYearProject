import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { useAuth } from "../context/AuthContext";

const SignUp = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    console.log(`Input changed: ${e.target.name} = "${e.target.value}"`);

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear specific field error when user starts typing
    if (errors[e.target.name]) {
      console.log(`Clearing error for field: ${e.target.name}`);
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Username validation
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (!nameRegex.test(formData.username.trim())) {
      newErrors.username =
        "Username cannot contain numbers or special characters";
    } else if (formData.username.trim().length < 2) {
      newErrors.username = "Username must have at least 2 characters";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    // Email confirmation validation
    if (!formData.confirmEmail.trim()) {
      newErrors.confirmEmail = "Please confirm your email";
    } else if (
      formData.email.trim() &&
      formData.confirmEmail.trim() &&
      formData.email.trim() !== formData.confirmEmail.trim()
    ) {
      newErrors.confirmEmail = "Email does not match";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must have at least 8 characters";
    } else {
      // Additional password strength requirements
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      const hasNumbers = /\d/.test(formData.password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

      if (!hasUpperCase) {
        newErrors.password =
          "Password must contain at least one uppercase letter";
      } else if (!hasLowerCase) {
        newErrors.password =
          "Password must contain at least one lowercase letter";
      } else if (!hasNumbers) {
        newErrors.password = "Password must contain at least one number";
      } else if (!hasSpecialChar) {
        newErrors.password =
          "Password must contain at least one special character";
      }
    }

    // Password confirmation validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (
      formData.password &&
      formData.confirmPassword &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Password does not match";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Form submission started");
    console.log("Form data:", formData);

    setLoading(true);
    setErrors({});

    // Validate form
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      console.error("Validation failed:");
      console.error("Validation errors:", formErrors);
      setErrors(formErrors);
      setLoading(false);
      return;
    }

    console.log("Validation passed");

    // Prepare data for API
    const apiData = {
      username: formData.username.trim(),
      email: formData.email.trim(),
      password: formData.password,
    };

    try {
      console.log("Starting API call...");

      // Call signup API
      const result = await signup(apiData);

      if (result.success) {
        // Show success message
        alert("Account created successfully! Redirecting to login...");

        // Redirect to login 
        navigate("/login");
      } else {
        console.error("Signup failed:", result.error);
        setErrors({ general: result.error });
      }
    } catch (error) {
      console.error("SignUp error occurred:");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      setErrors({
        general: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
      console.log("Form submission completed");
    }
  };

  return (
    <div
      className="fixed inset-0 overflow-auto"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="flex justify-center items-start min-h-screen py-8">
        <div className="w-full max-w-md mx-4">
          {/* Main Form Container */}
          <div className="w-full bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-6 transform hover:scale-[1.01] transition-all duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-1 text-white">
                Create Your Account
              </h2>
            </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* General Error Display */}
            {errors.general && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-3">
                <div className="flex items-center">
                  <span className="text-red-400 mr-2 text-sm">⚠️</span>
                  <p className="text-red-300 text-xs font-medium">{errors.general}</p>
                </div>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1">
              <label className="block text-white/80 text-xs font-semibold">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="text-white/70 text-lg">👤</span>
                </div>
                <input
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.username && (
                <p className="text-red-400 text-xs flex items-center">
                  <span className="mr-1">❌</span>{errors.username}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="block text-white/80 text-xs font-semibold">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="text-white/70 text-lg">✉️</span>
                </div>
                <input
                  name="email"
                  type="email"
                  placeholder="Enter email"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs flex items-center">
                  <span className="mr-1">❌</span>{errors.email}
                </p>
              )}
            </div>

            {/* Confirm Email Input */}
            <div className="space-y-1">
              <label className="block text-white/80 text-xs font-semibold">
                Confirm Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="text-white/70 text-lg">✉️</span>
                </div>
                <input
                  name="confirmEmail"
                  type="email"
                  placeholder="Confirm email"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                  value={formData.confirmEmail}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.confirmEmail && (
                <p className="text-red-400 text-xs flex items-center">
                  <span className="mr-1">❌</span>{errors.confirmEmail}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="block text-white/80 text-xs font-semibold">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="text-white/70 text-lg">🔒</span>
                </div>
                <input
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs flex items-center">
                  <span className="mr-1">❌</span>{errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1">
              <label className="block text-white/80 text-xs font-semibold">
                Confirm Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <span className="text-white/70 text-lg">🔒</span>
                </div>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs flex items-center">
                  <span className="mr-1">❌</span>{errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Password Requirements Info */}
            <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-400/20 rounded-xl p-3">
              <p className="text-blue-300 text-xs font-medium mb-1">Password must contain:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-blue-200">
                <div>• At least 8 characters</div>
                <div>• One uppercase letter</div>
                <div>• One lowercase letter</div>
                <div>• One special character</div>
              </div>
            </div>

            <button
              className="custom-button w-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-xl border-0 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transform hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                  Creating your account...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  Create Account
                </span>
              )}
            </button>

            <div className="text-center space-y-3">
              <div className="flex items-center justify-center">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="px-3 text-white/50 text-xs">or</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              <p className="text-white/70 text-xs">
                Already have an account?{" "}
                <Link
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 hover:underline"
                  to="/login"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
