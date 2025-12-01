import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import background from "../assets/background.jpg";

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
  // Check if analysis data is passed directly from Home component
  if (location.state?.analysisResult) {
    // Data passed from Home component 
    setAnalysisData(location.state.analysisResult);
    setLoading(false);
  } else {
    // No analysis data found - redirect back to home
    setError("No analysis data available. Please analyze an image first.");
    setLoading(false);
  }
}, [location]);

  const handleNewAnalysis = () => {
    navigate("/home");
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex justify-center items-center"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-10 hover:shadow-blue-500/30 transition-all duration-500 animate-pulse">
          <div className="text-center">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-400/30 border-t-blue-400 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-3 bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text">
              Loading Analysis...
            </h2>
            <p className="text-white/90 text-lg">Please wait while your image is being analyzed</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div
        className="fixed inset-0 flex justify-center items-center"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="bg-black/50 backdrop-blur-xl border-2 border-red-400/40 rounded-3xl shadow-2xl p-10 text-center max-w-lg hover:shadow-red-500/30 transition-all duration-500">
          <div className="text-8xl mb-6 animate-bounce">❌</div>
          <h2 className="text-3xl font-bold text-white mb-5 bg-linear-to-r from-red-400 to-pink-400 bg-clip-text">
            Analysis Not Found
          </h2>
          <p className="text-white/90 mb-8 text-lg leading-relaxed">
            {error || "We couldn't locate the analysis data for this image"}
          </p>
          <Link
            to="/home"
            className="bg-linear-to-r from-blue-500/90 to-green-500/90 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-xl hover:from-blue-600/90 hover:to-green-600/90 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-green-500/30 hover:scale-105"
          >
            🔍 Analyze New Image
          </Link>
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
      <div className="w-full max-w-7xl mx-auto px-6 py-6 min-h-full flex flex-col">
        {/* Header */}
        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-6 mb-6 shadow-2xl hover:shadow-blue-500/30 transition-all duration-500">
          <div className="flex justify-center items-center">
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent text-center">
              ✨ AI Image Analyzer ✨
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 flex-1">
          {/* Image Display */}
          <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 hover:shadow-green-500/30 transition-all duration-500 hover:scale-[1.02] max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-hidden">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <span className="text-2xl mr-3">📷</span>
              Analyzed Image
            </h3>
            <div className="text-center">
              <img
                src={analysisData.imageUrl}
                alt="Analyzed Image"
                className="w-full h-auto max-h-72 object-contain rounded-2xl shadow-2xl border-3 border-white/40 bg-gray-900/40 hover:shadow-blue-500/20 transition-all duration-300"
                onError={(e) => {
                  console.error("Image failed to load:", e.target.src);
                }}
              />

              {/* Basic Image Info */}
              <div className="mt-5 text-white/90 text-base space-y-2 bg-gray-900/30 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                {analysisData.originalName && (
                  <p className="flex items-center justify-center">
                    <span className="font-semibold mr-2">📁 File:</span>
                    <span className="text-blue-300">{analysisData.originalName}</span>
                  </p>
                )}
                {analysisData.fileSize && (
                  <p className="flex items-center justify-center">
                    <span className="font-semibold mr-2">📏 Size:</span>
                    <span className="text-green-300">{(analysisData.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-black/50 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl p-6 hover:shadow-purple-500/30 transition-all duration-500 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-hidden">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <span className="text-2xl mr-3">📊</span>
              Analysis Results
            </h3>

            {analysisData.analysisResult ? (
              <div className="space-y-5">
                {/* Overall Score */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-yellow-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">⭐</span>
                    Overall Score
                  </h4>
                  <div className="flex items-center space-x-4">
                    <div className={`text-3xl font-bold ${
                      analysisData.analysisResult.confidence >= 85
                        ? "text-green-400"
                        : analysisData.analysisResult.confidence >= 70
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}>
                      {analysisData.analysisResult.confidence}/100
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-700/50 rounded-full h-3 border border-gray-600">
                        <div
                          className={`h-3 rounded-full transition-all duration-1000 ${
                            analysisData.analysisResult.confidence >= 85
                              ? "bg-linear-to-r from-green-400 to-green-500"
                              : analysisData.analysisResult.confidence >= 70
                              ? "bg-linear-to-r from-yellow-400 to-yellow-500"
                              : "bg-linear-to-r from-red-400 to-red-500"
                          }`}
                          style={{
                            width: `${analysisData.analysisResult.confidence}%`,
                          }}
                        ></div>
                      </div>
                      <div className="text-right mt-2">
                        <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                          analysisData.analysisResult.confidence >= 85
                            ? "bg-green-500/30 text-green-300 border border-green-400/50"
                            : analysisData.analysisResult.confidence >= 70
                            ? "bg-yellow-500/30 text-yellow-300 border border-yellow-400/50"
                            : "bg-red-500/30 text-red-300 border border-red-400/50"
                        }`}>
                          {analysisData.analysisResult.confidence >= 85
                            ? "Excellent"
                            : analysisData.analysisResult.confidence >= 70
                            ? "Good"
                            : "Needs Improvement"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Composition */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-blue-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">🎨</span>
                    Composition
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "Rule of Thirds", value: analysisData.analysisResult.composition?.ruleOfThirds || "Well Applied" },
                      { label: "Balance", value: analysisData.analysisResult.composition?.balance || "Balanced" },
                      { label: "Leading Lines", value: analysisData.analysisResult.composition?.leadingLines || "Present" },
                      { label: "Symmetry", value: analysisData.analysisResult.composition?.symmetry || "Good" }
                    ].map((item, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-blue-400/30 transition-colors">
                        <span className="text-white/70 text-xs">{item.label}:</span>
                        <p className="text-white font-semibold text-sm mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Focus & Sharpness */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-green-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">🎯</span>
                    Focus & Sharpness
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "Overall Sharpness", value: analysisData.analysisResult.focus?.sharpness || "Sharp" },
                      { label: "Depth of Field", value: analysisData.analysisResult.focus?.depthOfField || "Appropriate" },
                      { label: "Focus Point", value: analysisData.analysisResult.focus?.focusPoint || "Well Placed" }
                    ].map((item, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-green-400/30 transition-colors">
                        <span className="text-white/70 text-xs">{item.label}:</span>
                        <p className="text-white font-semibold text-sm mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exposure */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-orange-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">💡</span>
                    Exposure
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "Exposure", value: analysisData.analysisResult.exposure?.level || "Well Exposed" },
                      { label: "Highlights", value: analysisData.analysisResult.exposure?.highlights || "Preserved" },
                      { label: "Shadows", value: analysisData.analysisResult.exposure?.shadows || "Detailed" },
                      { label: "Dynamic Range", value: analysisData.analysisResult.exposure?.dynamicRange || "Good" }
                    ].map((item, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-orange-400/30 transition-colors">
                        <span className="text-white/70 text-xs">{item.label}:</span>
                        <p className="text-white font-semibold text-sm mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-pink-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">🌈</span>
                    Color and Contrast
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "White Balance", value: analysisData.analysisResult.color?.whiteBalance || "Correct" },
                      { label: "Contrast", value: analysisData.analysisResult.color?.contrast || "Appropriate" }
                    ].map((item, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-pink-400/30 transition-colors">
                        <span className="text-white/70 text-xs">{item.label}:</span>
                        <p className="text-white font-semibold text-sm mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>              

                {/* Recommendations */}
                <div className="bg-linear-to-r from-gray-900/60 to-gray-800/60 backdrop-blur-lg border-2 border-white/30 rounded-2xl p-5 shadow-xl hover:shadow-indigo-500/20 transition-all duration-400 hover:scale-[1.02]">
                  <h4 className="text-white font-bold mb-3 flex items-center text-base">
                    <span className="text-xl mr-3">💡</span>
                    Recommendations
                  </h4>
                  <div className="space-y-3 text-sm text-white/90">
                    {analysisData.analysisResult.recommendations ? (
                      analysisData.analysisResult.recommendations
                        .slice(0, 3)
                        .map((rec, index) => (
                          <div key={index} className="flex items-start bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-indigo-400/30 transition-colors">
                            <span className="mr-3 text-blue-400 text-lg">•</span>
                            <p className="flex-1 leading-relaxed">{rec}</p>
                          </div>
                        ))
                    ) : (
                      [
                        "Consider experimenting with different angles for more dynamic composition",
                        "Try adjusting exposure slightly to enhance detail in shadows",
                        "The current color balance works well for this subject matter"
                      ].map((rec, index) => (
                        <div key={index} className="flex items-start bg-gray-800/50 rounded-xl p-3 border border-white/10 hover:border-indigo-400/30 transition-colors">
                          <span className="mr-3 text-blue-400 text-lg">•</span>
                          <p className="flex-1 leading-relaxed">{rec}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-white/80 text-xl">No analysis results available</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-6">
          <button
            onClick={handleNewAnalysis}
            className="bg-linear-to-r from-blue-500/90 to-green-500/90 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-2xl hover:from-blue-600/90 hover:to-green-600/90 transition-all duration-300 font-semibold text-lg shadow-xl hover:shadow-green-500/30 hover:scale-105"
          >
            🔍 Analyze Another Image
          </button>
        </div>
      </div>
      <style jsx>{` .scrollbar-hidden { -ms-overflow-style: none; scrollbar-width: none; } .scrollbar-hidden::-webkit-scrollbar { display: none; } `}</style> 
    </div>
  );
};

export default Result;