import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Basic validation
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      console.log("Calling login API...");

      const result = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (result.success) {
        // Redirect to home
        navigate("/home");
      } else {
        console.error("Login failed:", result.error);
        setErrors({ general: result.error });
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrors({
        general: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
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
      <div className="flex justify-center items-center min-h-screen py-8">
        <div className="w-full max-w-md mx-4">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
              AI Image Analyzer
            </h1>
          </div>

          {/* Main Form Container */}
          <div className="w-full bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-6 transform hover:scale-[1.01] transition-all duration-300">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1 text-white">
              Welcome Back
            </h2>
            <p className="text-white/80 text-xs">Sign in to continue</p>
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
                  placeholder="Enter your email"
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
                  placeholder="Enter your password"
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

            {/* Login Button */}
            <button
              className="custom-button w-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-xl border-0 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transform hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                  Signing you in...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  Sign In
                </span>
              )}
            </button>

            <div className="space-y-3 text-center">
              <Link
                className="block text-cyan-400 hover:text-cyan-300 transition-colors duration-200 text-xs font-medium hover:underline"
                to="/forgot-password"
              >
                🔑 Forgot your password?
              </Link>
              
              <div className="flex items-center justify-center">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="px-3 text-white/50 text-xs">or</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              <p className="text-white/70 text-xs">
                Don't have an account?{" "}
                <Link
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 hover:underline"
                  to="/signup"
                >
                  Create Account
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

export default Login;
