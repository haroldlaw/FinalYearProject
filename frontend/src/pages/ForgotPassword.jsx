import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { authAPI } from "../services/api";

const ForgotPassword = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1); 

  const handleInputChange = (field, value) => {
    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: "",
      });
    }

    // Update the specific field
    if (field === 'email') {
      setEmail(value);
    } else if (field === 'password') {
      setNewPassword(value);
    } else if (field === 'confirmPassword') {
      setConfirmPassword(value);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMessage("");

    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      setLoading(false);
      return;
    }

    try {
      const result = await authAPI.forgotPassword(email.trim());
      
      if (result.success) {
        setMessage("Email found! Create your new password.");
        setStep(2);
      } else {
        setErrors({ email: result.error || "Email not found" });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setErrors({ email: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Validation 
    const newErrors = {};
    
    // Password validation
    if (!newPassword) {
      newErrors.password = "Password is required";
    } else if (newPassword.length < 8) {
      newErrors.password = "Password must have at least 8 characters";
    } else {
      // Additional password strength requirements
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumbers = /\d/.test(newPassword);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

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
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (
      newPassword &&
      confirmPassword &&
      newPassword !== confirmPassword
    ) {
      newErrors.confirmPassword = "Password does not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await authAPI.resetPassword(email, newPassword);
      
      if (result.success) {
        setMessage("Password updated successfully!");
        setStep(3);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        // Check if it's a password-specific error
        if (result.error && result.error.toLowerCase().includes('password cannot be the same')) {
          setErrors({ password: result.error });
        } else {
          setErrors({ general: result.error || "Failed to update password" });
        }
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ general: "Network error. Please try again." });
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
          {/* Main Form Container */}
          <div className="w-full bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-6 transform hover:scale-[1.01] transition-all duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-1 text-white">
                {step === 1 && "🔑 Forgot Password"}
                {step === 2 && "🔒 Create New Password"}
                {step === 3 && ""}
              </h2>
              <p className="text-white/70 text-sm">
                {step === 1 && "Enter email address to reset password"}
                {step === 2 && "Choose a new password for your account"}
                {step === 3 && ""}
              </p>
            </div>

          {step === 1 && (
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
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
                    value={email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs flex items-center">
                    <span className="mr-1">❌</span>{errors.email}
                  </p>
                )}
              </div>

              <button
                className="custom-button w-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-xl border-0 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transform hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Checking email...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Continue
                  </span>
                )}
              </button>

              <div className="text-center">
                <Link
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 hover:underline text-xs"
                  to="/login"
                >
                  ← Back to Login
                </Link>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-4" onSubmit={handlePasswordReset}>
              {/* Password Requirements Info */}
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-3 mb-4">
                <p className="text-blue-300 text-xs font-medium mb-1">Password must contain:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-blue-200">
                  <div>• At least 8 characters</div>
                  <div>• One uppercase letter</div>
                  <div>• One lowercase letter</div>
                  <div>• One special character</div>
                </div>
              </div>

              {/* New Password Input */}
              <div className="space-y-1">
                <label className="block text-white/80 text-xs font-semibold">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <span className="text-white/70 text-lg">🔒</span>
                  </div>
                  <input
                    name="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                    value={newPassword}
                    onChange={(e) => handleInputChange('password', e.target.value)}
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
                  Confirm New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <span className="text-white/70 text-lg">🔒</span>
                  </div>
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/10 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 hover:bg-white/8 text-sm"
                    value={confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    required
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs flex items-center">
                    <span className="mr-1">❌</span>{errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* General Error Display */}
              {errors.general && (
                <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3">
                  <div className="flex items-center">
                    <span className="text-red-400 mr-2 text-sm">⚠️</span>
                    <p className="text-red-300 text-xs font-medium">{errors.general}</p>
                  </div>
                </div>
              )}

              {/* Update Password Button */}
              <button
                className="custom-button w-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-xl border-0 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transform hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Updating password...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Update Password
                  </span>
                )}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              {/* Success Message */}
              <p className="text-green-300 font-medium flex items-center justify-center">
                <span className="mr-2">✅</span>{message}
              </p>
              <p className="text-white/80 text-sm">Redirecting to login page...</p>

              {/* Loading Animation */}
              <div className="flex justify-center items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
