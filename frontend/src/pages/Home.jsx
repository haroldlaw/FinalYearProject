import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import background from "../assets/background.jpg";
import { imageAPI } from "../services/api";

const Home = () => {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large! Please select an image under 10MB.");
        return;
      }
      console.log("Image selected:", file.name);
      setSelectedImage(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large! Please select an image under 10MB.");
        return;
      }
      console.log("Image dropped:", file.name);
      setSelectedImage(file);
    }
  };

  const removeSelectedImage = () => {
    console.log("Removing selected image");
    setSelectedImage(null);
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setUploading(true);
    console.log("🔍 Starting image analysis...");

    try {
      // Upload image for analysis
      const uploadResult = await imageAPI.uploadAnalysis(selectedImage);

      if (uploadResult.success) {
        console.log("Image uploaded successfully for analysis");
        console.log("Image URL:", uploadResult.data.imageUrl);

        // Navigate to result page with the correct data
        navigate("/result", {
          state: {
            analysisResult: uploadResult.data,
          },
        });
      } else {
        console.error("Failed to upload image:", uploadResult.error);
        alert(`Failed to analyze image: ${uploadResult.error}`);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      alert("An error occurred during analysis: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
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
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-10 hover:shadow-cyan-500/30 transition-all duration-500 animate-pulse">
          <div className="text-center">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-cyan-400/30 border-t-cyan-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3 bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text">
              Analyzing Image...
            </h2>
            <p className="text-white/90 text-lg">
              Please wait while your image is being analyzed
            </p>
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
      {/* Profile Button */}
      <div className="fixed top-12 left-16 z-20">
        <button
          onClick={() => navigate("/profile")}
          className="bg-black/60 backdrop-blur-xl border-2 border-white/40 text-transparent bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 text-xl font-bold"
        >
          👤
        </button>
      </div>

      <div className="w-full max-w-4xl mx-auto px-6 py-6 min-h-full flex flex-col justify-center">
        {/* Header */}
        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 mb-8 shadow-2xl hover:shadow-cyan-500/30 transition-all duration-500">
          <div className="flex justify-center items-center">
            <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent text-center">
              AI Image Analyzer
            </h1>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-8 hover:shadow-green-500/30 transition-all duration-500 hover:scale-[1.01]">
          {!selectedImage ? (
            <div
              className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
                dragActive
                  ? "border-blue-400/70 bg-blue-500/20 shadow-blue-500/30 shadow-xl"
                  : "border-white/40 hover:border-white/70 hover:bg-white/10 hover:shadow-white/20 hover:shadow-lg"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("imageUpload").click()}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
              />
              <div className="text-8xl mb-6 animate-bounce">📁</div>
              <h3 className="text-white text-2xl font-bold mb-3 bg-linear-to-r from-cyan-300 to-purple-300 bg-clip-text">
                Upload Image
              </h3>
              <p className="text-white/90 text-lg font-medium mb-4">
                Drag & drop an image here, or click to select
              </p>
              <p className="text-white/70 text-sm">
                Supports all image formats (JPG, PNG, GIF, WEBP, etc.) • Max 10MB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Selected Image
                </h3>
                <button
                  onClick={removeSelectedImage}
                  className="bg-linear-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm border-2 border-white/30 text-white px-5 py-2 rounded-xl hover:from-red-600/90 hover:to-red-700/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-red-500/30 hover:scale-105"
                >
                  Delete
                </button>
              </div>

              {/* Image Preview */}
              <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/20 transition-all duration-400 mb-6">
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Selected"
                  className="w-full max-w-md h-64 mx-auto rounded-2xl shadow-2xl border-2 border-white/40 object-contain bg-gray-900/40 hover:shadow-green-500/20 transition-all duration-300"
                />

                {/* Image Info */}
                <div className="mt-5 text-white/90 text-base space-y-2 bg-gray-900/30 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                  <p className="flex items-center justify-center">
                    <span className="font-semibold mr-2">📁 File:</span>
                    <span className="text-blue-300">{selectedImage.name}</span>
                  </p>
                  <p className="flex items-center justify-center">
                    <span className="font-semibold mr-2">📏 Size:</span>
                    <span className="text-green-300">
                      {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </p>
                </div>
              </div>

              {/* Analyze Button */}
              <button
                onClick={analyzeImage}
                disabled={uploading}
                className="custom-button bg-linear-to-r from-cyan-500/90 to-purple-500/90 backdrop-blur-sm border-0 text-white px-8 py-3 rounded-2xl hover:from-cyan-600/90 hover:to-purple-600/90 transition-all duration-300 font-bold text-lg shadow-xl hover:shadow-cyan-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {uploading ? "🔄 Analyzing..." : "🔍 Analyze Image"}
              </button>

              {/* Select Different Image */}
              <div className="mt-6">
                <button
                  onClick={() =>
                    document.getElementById("imageUpload2").click()
                  }
                  className="custom-button bg-linear-to-r from-cyan-500/90 to-purple-500/90 backdrop-blur-sm border-0 text-white px-8 py-3 rounded-2xl hover:from-cyan-600/90 hover:to-purple-600/90 transition-all duration-300 font-bold text-lg shadow-xl hover:shadow-cyan-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Select Different Image
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="imageUpload2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mt-8 bg-black/40 backdrop-blur-xl border-2 border-white/30 rounded-3xl p-6 shadow-xl hover:shadow-cyan-500/20 transition-all duration-500">
          <h3 className="text-xl font-bold text-white mb-4 text-center bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text">
            🧠 Analyzed Based On
          </h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">🖼️</div>
              <p className="text-white/90 font-medium">Composition</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🎯</div>
              <p className="text-white/90 font-medium">Focus & Sharpness</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">💡</div>
              <p className="text-white/90 font-medium">Exposure</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🎨</div>
              <p className="text-white/90 font-medium">Color & Contrast</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
