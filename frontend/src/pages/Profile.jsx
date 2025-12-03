import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { authAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const Profile = () => {
  const navigate = useNavigate();

  const {
    user: authUser,
    isAuthenticated,
    loading: authLoading,
    getUserHistory,
    logout,
  } = useAuth();

  const [uploadHistory, setUploadHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // Create user object from authentication data with fallback
  const user = authUser
    ? {
        name:
          authUser.name ||
          authUser.username ||
          authUser.fullName ||
          "Anonymous User",
        email: authUser.email || "No email provided",
        joinDate: authUser.createdAt
          ? new Date(authUser.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })
          : authUser.joinDate || "Recently",
        totalUploads: uploadHistory.length,
        avatar: authUser.avatar || authUser.profileImage || null,
        id: authUser.id || authUser._id,
      }
    : {
        // Fallback for when not authenticated
        name: "Guest User",
        email: "Please log in",
        joinDate: "N/A",
        totalUploads: 0,
        avatar: null,
        id: null,
      };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log("User not authenticated, redirecting...");
      navigate("/login");
      return;
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch user history when authenticated
  useEffect(() => {
    if (isAuthenticated && authUser) {
      fetchUploadHistory();
    }
  }, [isAuthenticated, authUser]);

  // Add a refresh interval to check for new uploads
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        fetchUploadHistory();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const fetchUploadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.getUserHistory();

      if (response?.success && response.data) {
        const historyData = Array.isArray(response.data) ? response.data : [];
        setUploadHistory(historyData);
      } else {
        setUploadHistory([]);
        if (!response?.success) {
          setError(response?.error || "Failed to fetch upload history");
        }
      }
    } catch (err) {
      console.error("Error fetching upload history:", err);
      setError(`Failed to load upload history: ${err.message}`);
      setUploadHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await logout();
        navigate("/login");
      } catch (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
      }
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      try {
        const response = await authAPI.deleteUserImage(imageId);

        if (response?.success) {
          setUploadHistory((prev) =>
            prev.filter((img) => img.id !== imageId && img._id !== imageId)
          );
          setSelectedImage(null);
        } else {
          throw new Error(response?.error || "Failed to delete image");
        }
      } catch (err) {
        console.error("Error deleting image:", err);
        alert(`Failed to delete image: ${err.message}`);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBadge = (score) => {
    if (score >= 85)
      return "bg-green-500/30 text-green-300 border-green-400/50";
    if (score >= 70)
      return "bg-yellow-500/30 text-yellow-300 border-yellow-400/50";
    return "bg-red-500/30 text-red-300 border-red-400/50";
  };

  // Show authentication loading state
  if (authLoading) {
    return (
      <div
        className="fixed inset-0 flex justify-center items-center"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-cyan-400/30 border-t-cyan-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3 bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text">
              🔐 Checking Authentication...
            </h2>
            <p className="text-white/70">
              Please wait while your session is being verified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex justify-center items-center"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-cyan-400/30 border-t-cyan-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3 bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text">
              Loading Profile...
            </h2>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="w-full max-w-7xl mx-auto px-6 py-6 min-h-full">
        {/* Header */}
        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 mb-6 shadow-2xl hover:shadow-cyan-500/30 transition-all duration-500">
          <div className="flex justify-between items-center relative">
            <button
              onClick={() => navigate("/home")}
              className="bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent font-bold hover:scale-105 transition-all duration-300 border-2 border-white/30 px-6 py-3 rounded-2xl backdrop-blur-sm shadow-lg hover:shadow-cyan-500/30"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent absolute left-1/2 transform -translate-x-1/2">
              Profile
            </h1>
            <button
              onClick={handleLogout}
              className="bg-linear-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-6 py-3 rounded-2xl hover:from-red-600/90 hover:to-red-700/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-red-500/30 hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 mb-8 hover:shadow-cyan-500/30 transition-all duration-500">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-white/40 object-cover"
                  onError={(e) => (e.target.style.display = "none")}
                />
              ) : (
                <div className="text-4xl mb-2">👨‍💼</div>
              )}
              <h3 className="text-white font-bold text-lg mb-1">{user.name}</h3>
              <p className="text-white/70 text-sm">{user.email}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">📅</div>
              <p className="text-white/70 text-sm">Account Created</p>
              <p className="text-white font-semibold">{user.joinDate}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">📸</div>
              <p className="text-white/70 text-sm">Total Uploads</p>
              <p className="text-white font-semibold text-xl">
                {user.totalUploads}
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">⭐</div>
              <p className="text-white/70 text-sm">Avg Score</p>
              <p className="text-white font-semibold text-xl">
                {uploadHistory.length > 0
                  ? Math.round(
                      uploadHistory.reduce(
                        (sum, img) =>
                          sum + (img.analysisScore || img.score || 0),
                        0
                      ) / uploadHistory.length
                    )
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Upload History */}
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 hover:shadow-cyan-500/30 transition-all duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <span className="text-3xl mr-3">📚</span>
              Upload History ({uploadHistory.length})
            </h2>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-2xl p-4 mb-6">
              <p className="text-red-300 text-center">{error}</p>
            </div>
          )}

          {uploadHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-white text-xl font-bold mb-2">
                No upload yet
              </h3>
              <p className="text-white/70 mb-6">
                Start by uploading your first image!
              </p>
              <button
                onClick={() => navigate("/home")}
                className="custom-button bg-linear-to-r from-cyan-500/90 to-purple-500/90 backdrop-blur-sm border-0 text-white px-8 py-3 rounded-2xl hover:from-cyan-600/90 hover:to-purple-600/90 transition-all duration-300 font-bold text-lg shadow-xl hover:shadow-cyan-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Upload Now
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadHistory.map((image, index) => {
                return (
                  <div
                    key={image._id || image.id || index}
                    className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-4 shadow-xl hover:shadow-cyan-500/20 transition-all duration-400 hover:scale-[1.02] cursor-pointer"
                    onClick={() => handleImageClick(image)}
                  >
                    <img
                      src={
                        image.cloudinaryUrl ||
                        image.imageUrl ||
                        image.url ||
                        "https://via.placeholder.com/300x200/4A90E2/FFFFFF?text=No+Image"
                      }
                      alt={
                        image.originalName ||
                        image.filename ||
                        image.name ||
                        "Unknown"
                      }
                      className="w-full h-48 object-cover rounded-xl mb-4 border border-white/20"
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/300x200/4A90E2/FFFFFF?text=Image+Error";
                      }}
                    />

                    <div className="space-y-2">
                      <h4 className="text-white font-semibold truncate">
                        {image.originalName ||
                          image.filename ||
                          image.name ||
                          "Unknown File"}
                      </h4>

                      <div className="flex justify-between items-center">
                        <span
                          className={`text-2xl font-bold ${getScoreColor(
                            image.analysisScore || image.score || 0
                          )}`}
                        >
                          {image.analysisScore || image.score || 0}/100
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${getScoreBadge(
                            image.analysisScore || image.score || 0
                          )}`}
                        >
                          {(image.analysisScore || image.score || 0) >= 85
                            ? "Excellent"
                            : (image.analysisScore || image.score || 0) >= 70
                            ? "Good"
                            : "Fair"}
                        </span>
                      </div>

                      <div className="text-white/70 text-sm space-y-1">
                        <p>
                          📅{" "}
                          {formatDate(
                            image.uploadDate || image.createdAt || new Date()
                          )}
                        </p>
                        <p>
                          📏{" "}
                          {image.fileSize
                            ? (image.fileSize / 1024 / 1024).toFixed(1)
                            : "N/A"}{" "}
                          MB
                        </p>
                        <p className="text-xs">
                          ID: {image._id || image.id || "No ID"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Image Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-black/70 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">
                  📷{" "}
                  {selectedImage.originalName ||
                    selectedImage.filename ||
                    selectedImage.name ||
                    "Unknown"}
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleDeleteImage(selectedImage.id || selectedImage._id)
                    }
                    className="bg-linear-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-4 py-2 rounded-xl hover:from-red-600/90 hover:to-red-700/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-red-500/30 hover:scale-105"
                  >
                    Delete
                  </button>
                  <button
                    onClick={closeImageModal}
                    className="bg-linear-to-r from-gray-500/90 to-gray-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-4 py-2 rounded-xl hover:from-gray-600/90 hover:to-gray-700/90 transition-all duration-300 font-semibold shadow-lg hover:scale-105"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <img
                    src={
                      selectedImage.cloudinaryUrl ||
                      selectedImage.imageUrl ||
                      selectedImage.url
                    }
                    alt={
                      selectedImage.originalName ||
                      selectedImage.filename ||
                      selectedImage.name
                    }
                    className="w-full h-auto rounded-2xl border-2 border-white/40 shadow-2xl"
                    onError={(e) => {
                      e.target.src =
                        "https://via.placeholder.com/400x300/4A90E2/FFFFFF?text=Image+Not+Found";
                    }}
                  />
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/20">
                    <h4 className="text-white font-bold mb-3 flex items-center">
                      <span className="text-xl mr-2">⭐</span>
                      Analysis Score
                    </h4>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-3xl font-bold ${getScoreColor(
                          selectedImage.analysisScore ||
                            selectedImage.score ||
                            0
                        )}`}
                      >
                        {selectedImage.analysisScore ||
                          selectedImage.score ||
                          0}
                        /100
                      </span>
                      <span
                        className={`text-sm px-3 py-1 rounded-full border ${getScoreBadge(
                          selectedImage.analysisScore ||
                            selectedImage.score ||
                            0
                        )}`}
                      >
                        {(selectedImage.analysisScore ||
                          selectedImage.score ||
                          0) >= 85
                          ? "Excellent"
                          : (selectedImage.analysisScore ||
                              selectedImage.score ||
                              0) >= 70
                          ? "Good"
                          : "Fair"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/20">
                    <h4 className="text-white font-bold mb-3 flex items-center">
                      <span className="text-xl mr-2">📋</span>
                      Details
                    </h4>
                    <div className="space-y-2 text-white/90">
                      <p>
                        <span className="font-semibold">📁 File:</span>{" "}
                        {selectedImage.originalName ||
                          selectedImage.filename ||
                          selectedImage.name ||
                          "Unknown"}
                      </p>
                      <p>
                        <span className="font-semibold">📏 Size:</span>{" "}
                        {selectedImage.fileSize
                          ? (selectedImage.fileSize / 1024 / 1024).toFixed(2)
                          : "N/A"}{" "}
                        MB
                      </p>
                      <p>
                        <span className="font-semibold">📅 Analyzed:</span>{" "}
                        {formatDate(
                          selectedImage.uploadDate ||
                            selectedImage.createdAt ||
                            new Date()
                        )}
                      </p>
                      <p>
                        <span className="font-semibold">✅ Status:</span>{" "}
                        <span className="capitalize">
                          {selectedImage.status || "Completed"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
