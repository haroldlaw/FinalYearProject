import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { authAPI } from "../services/api";

const Login = () => {
  const navigate = useNavigate();
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

      const result = await authAPI.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (result.success) {
        console.log("Login successful");
        console.log("User data:", result.data.user);

        // Store token and user info
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("user", JSON.stringify(result.data.user));

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
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-black/30 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-8 px-8">
          <h2 className="text-[28px] font-bold text-white mb-6 text-center">
            Login
          </h2>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <input
              name="email"
              placeholder="Email"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            {errors.email && (
              <p className="text-red-400 text-sm mb-3">{errors.email}</p>
            )}

            <input
              name="password"
              placeholder="Password"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
            {errors.password && (
              <p className="text-red-400 text-sm mb-3">{errors.password}</p>
            )}
            
            {errors.general && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-md p-3 mb-4">
                <p className="text-red-300 text-sm">{errors.general}</p>
              </div>
            )}
            
            <button
              className="bg-linear-to-r from-indigo-500/80 to-blue-500/80 backdrop-blur-sm text-white font-medium py-3 px-4 rounded-md hover:from-indigo-600/90 hover:to-blue-600/90 border border-white/20 transition-all duration-200 transform hover:scale-105"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Submit"}
            </button>
            <p className="text-white mt-4 text-center">
              Don't have an account?
              <Link
                className="text-blue-400 hover:underline mt-4 px-1"
                to="/signup"
              >
                Sign Up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
