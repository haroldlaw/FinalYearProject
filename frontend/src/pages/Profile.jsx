import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { imageAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const Profile = () => {
  const navigate = useNavigate();

  const {
    user: authUser,
    isAuthenticated,
    loading: authLoading,
    getUserHistory,
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

  const fetchUploadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching user history...");
      const response = await getUserHistory();

      if (response?.success) {
        setUploadHistory(response.data || []);
        console.log(
          "Upload history loaded:",
          response.data?.length || 0,
          "items"
        );
      } else {
        console.log("API not ready, using mock data");
        setMockData();
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to load upload history");
      setMockData(); // Fall back to mock data
    } finally {
      setLoading(false);
    }
  };

  // Keep mock data as fallback for development
  const setMockData = () => {
    const mockHistory = [
      {
        id: 1,
        imageUrl:
          "https://via.placeholder.com/300x200/4A90E2/FFFFFF?text=Sample+1",
        originalName: "landscape.jpg",
        uploadDate: "2024-12-01T10:30:00Z",
        fileSize: 2.5 * 1024 * 1024, // 2.5MB
        analysisScore: 85,
        status: "completed",
      },
      {
        id: 2,
        imageUrl:
          "https://via.placeholder.com/300x200/7ED321/FFFFFF?text=Sample+2",
        originalName: "portrait.png",
        uploadDate: "2024-11-28T15:45:00Z",
        fileSize: 1.8 * 1024 * 1024, // 1.8MB
        analysisScore: 92,
        status: "completed",
      },
      {
        id: 3,
        imageUrl:
          "https://via.placeholder.com/300x200/F5A623/FFFFFF?text=Sample+3",
        originalName: "nature.jpg",
        uploadDate: "2024-11-25T09:15:00Z",
        fileSize: 3.2 * 1024 * 1024, // 3.2MB
        analysisScore: 78,
        status: "completed",
      },
    ];

    setUploadHistory(mockHistory);
    console.log("Using mock data");
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const handleDeleteImage = async (imageId) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      try {
        // Replace with actual API call
        // await imageAPI.deleteImage(imageId);

        setUploadHistory((prev) => prev.filter((img) => img.id !== imageId));
        setSelectedImage(null);
      } catch (err) {
        console.error("Error deleting image:", err);
        alert("Failed to delete image");
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
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-400/30 border-t-blue-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3">
              🔐 Checking Authentication...
            </h2>
            <p className="text-white/70">
              Please wait while we verify your session
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
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-400/30 border-t-blue-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3">
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
        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 mb-6 shadow-2xl hover:shadow-blue-500/30 transition-all duration-500">
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate("/home")}
              className="bg-linear-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent font-bold hover:scale-105 transition-all duration-300 border-2 border-white/30 px-6 py-3 rounded-2xl backdrop-blur-sm shadow-lg hover:shadow-blue-500/30"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
              Profile
            </h1>
            <div></div>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 mb-8 hover:shadow-purple-500/30 transition-all duration-500">
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
              <p className="text-white/50 text-xs mt-1">
                {isAuthenticated ? "🟢 Authenticated" : "🔴 Guest Mode"}
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">📅</div>
              <p className="text-white/70 text-sm">Member Since</p>
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
                        (sum, img) => sum + img.analysisScore,
                        0
                      ) / uploadHistory.length
                    )
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Upload History */}
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 hover:shadow-green-500/30 transition-all duration-500">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">📚</span>
            Upload History ({uploadHistory.length})
          </h2>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-2xl p-4 mb-6">
              <p className="text-red-300 text-center">{error}</p>
            </div>
          )}

          {uploadHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-white text-xl font-bold mb-2">
                No uploads yet
              </h3>
              <p className="text-white/70 mb-6">
                Start by uploading your first image!
              </p>
              <button
                onClick={() => navigate("/")}
                className="bg-linear-to-r from-blue-500/90 to-green-500/90 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-3 rounded-2xl hover:from-blue-600/90 hover:to-green-600/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-green-500/30 hover:scale-105"
              >
                🚀 Upload Now
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadHistory.map((image) => (
                <div
                  key={image.id}
                  className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-4 shadow-xl hover:shadow-blue-500/20 transition-all duration-400 hover:scale-[1.02] cursor-pointer"
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.imageUrl}
                    alt={image.originalName}
                    className="w-full h-48 object-cover rounded-xl mb-4 border border-white/20"
                  />

                  <div className="space-y-2">
                    <h4 className="text-white font-semibold truncate">
                      {image.originalName}
                    </h4>

                    <div className="flex justify-between items-center">
                      <span
                        className={`text-2xl font-bold ${getScoreColor(
                          image.analysisScore
                        )}`}
                      >
                        {image.analysisScore}/100
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${getScoreBadge(
                          image.analysisScore
                        )}`}
                      >
                        {image.analysisScore >= 85
                          ? "Excellent"
                          : image.analysisScore >= 70
                          ? "Good"
                          : "Fair"}
                      </span>
                    </div>

                    <div className="text-white/70 text-sm space-y-1">
                      <p>📅 {formatDate(image.uploadDate)}</p>
                      <p>📏 {(image.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Image Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-black/70 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">
                  📷 {selectedImage.originalName}
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteImage(selectedImage.id)}
                    className="bg-linear-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-4 py-2 rounded-xl hover:from-red-600/90 hover:to-red-700/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-red-500/30 hover:scale-105"
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={closeImageModal}
                    className="bg-linear-to-r from-gray-500/90 to-gray-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-4 py-2 rounded-xl hover:from-gray-600/90 hover:to-gray-700/90 transition-all duration-300 font-semibold shadow-lg hover:scale-105"
                  >
                    ❌ Close
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.originalName}
                    className="w-full h-auto rounded-2xl border-2 border-white/40 shadow-2xl"
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
                          selectedImage.analysisScore
                        )}`}
                      >
                        {selectedImage.analysisScore}/100
                      </span>
                      <span
                        className={`text-sm px-3 py-1 rounded-full border ${getScoreBadge(
                          selectedImage.analysisScore
                        )}`}
                      >
                        {selectedImage.analysisScore >= 85
                          ? "Excellent"
                          : selectedImage.analysisScore >= 70
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
                        {selectedImage.originalName}
                      </p>
                      <p>
                        <span className="font-semibold">📏 Size:</span>{" "}
                        {(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p>
                        <span className="font-semibold">📅 Uploaded:</span>{" "}
                        {formatDate(selectedImage.uploadDate)}
                      </p>
                      <p>
                        <span className="font-semibold">✅ Status:</span>{" "}
                        <span className="capitalize">
                          {selectedImage.status}
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
