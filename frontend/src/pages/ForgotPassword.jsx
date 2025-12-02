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
        setMessage("Email found! Now create your new password.");
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
      className="min-h-screen w-full flex justify-center items-center"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-white text-center mb-6">
            {step === 1 && "Forgot Password"}
            {step === 2 && "Create New Password"}
            {step === 3 && "Success"}
          </h2>

          {step === 1 && (
            <form className="flex flex-col" onSubmit={handleEmailSubmit}>
              <p className="text-white/80 text-sm mb-4 text-center">
                Enter your email to reset password
              </p>
              
              <input
                name="email"
                placeholder="Email"
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
                type="email"
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
              {errors.email && (
                <p className="text-red-400 text-sm mb-3">{errors.email}</p>
              )}

              {message && (
                <div className="bg-green-500/20 border border-green-400/30 rounded-md p-3 mb-4">
                  <p className="text-green-300 text-sm">{message}</p>
                </div>
              )}

              <button
                className="bg-linear-to-r from-indigo-500/80 to-blue-500/80 backdrop-blur-sm text-white font-medium py-3 px-4 rounded-md hover:from-indigo-600/90 hover:to-blue-600/90 border border-white/20 transition-all duration-200 transform hover:scale-105 mb-4"
                type="submit"
                disabled={loading}
              >
                {loading ? "Checking..." : "Continue"}
              </button>

              <Link
                className="text-blue-400 hover:underline text-center"
                to="/login"
              >
                Back to Login
              </Link>
            </form>
          )}

          {step === 2 && (
            <form className="flex flex-col" onSubmit={handlePasswordReset}>
              <p className="text-white/80 text-sm mb-4 text-center">
                Create a new password for <span className="text-blue-400">{email}</span>
              </p>
              
              <input
                name="newPassword"
                placeholder="New Password"
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
                type="password"
                value={newPassword}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
              />
              {errors.password && (
                <p className="text-red-400 text-sm mb-3">{errors.password}</p>
              )}

              <input
                name="confirmPassword"
                placeholder="Confirm New Password"
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                required
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm mb-3">{errors.confirmPassword}</p>
              )}

              {errors.general && (
                <div className="bg-red-500/20 border border-red-400/30 rounded-md p-3 mb-4">
                  <p className="text-red-300 text-sm">{errors.general}</p>
                </div>
              )}

              <button
                className="bg-linear-to-r from-green-500/80 to-emerald-500/80 backdrop-blur-sm text-white font-medium py-3 px-4 rounded-md hover:from-green-600/90 hover:to-emerald-600/90 border border-white/20 transition-all duration-200 transform hover:scale-105 mb-4"
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-blue-400 hover:underline text-center"
              >
                Back to Email
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="bg-green-500/20 border border-green-400/30 rounded-md p-4 mb-6">
                <p className="text-green-300">{message}</p>
                <p className="text-white/80 text-sm mt-2">Redirecting to login...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
