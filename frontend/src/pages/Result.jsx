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
    console.log("Result page loaded");
    console.log("Location state:", location.state);

    if (location.state?.analysisResult) {
      // Data passed from Home component
      setAnalysisData(location.state.analysisResult);
      setLoading(false);
      console.log("Analysis data loaded from navigation state");
    } else {
      // No analysis data found
      setError("No analysis data found");
      setLoading(false);
      console.log("No analysis data found");
    }
  }, [location]);

  const handleNewAnalysis = () => {
    navigate("/home");
  };

  if (loading) {
    return (
      <div
        className="flex justify-center items-center"
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
        <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">
              Loading Result...
            </h2>
            <p className="text-white/80">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div
        className="flex justify-center items-center"
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
        <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            No Results Found
          </h2>
          <p className="text-white/80 mb-6">
            {error || "No analysis data available"}
          </p>
          <Link
            to="/home"
            className="bg-linear-to-r from-blue-400/80 to-green-400/80 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-lg hover:from-blue-500/90 hover:to-green-500/90 transition-all duration-200 font-medium"
          >
            🔍 Analyze New Image
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex justify-center items-center"
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
      <div className="w-full max-w-6xl mx-auto p-6">
        
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-xl p-4 mb-6">
          <div className="flex justify-center items-center">
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-green-400 bg-clip-text text-transparent text-center">
              Analysis Result
            </h1>
            <div></div> {/* Spacer for center alignment */}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Image Display */}
          <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              📷 Analyzed Image
            </h3>
            <div className="text-center">
              <img
                src={analysisData.imageUrl}
                alt="Analyzed Image"
                className="w-full h-auto max-h-80 object-contain rounded-lg shadow-lg border border-white/20 bg-gray-900/20"
                onError={(e) => {
                  console.error("Image failed to load:", e.target.src);
                }}
              />

              {/* Basic Image Info */}
              <div className="mt-4 text-white/80 text-sm space-y-1">
                {analysisData.originalName && (
                  <p>
                    <span className="font-medium">📁 File:</span>{" "}
                    {analysisData.originalName}
                  </p>
                )}
                {analysisData.fileSize && (
                  <p>
                    <span className="font-medium">📏 Size:</span>{" "}
                    {(analysisData.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              📊 Analysis Results
            </h3>

            {analysisData.analysisResult ? (
              <div className="space-y-4">
                {/* Confidence Score */}
                {analysisData.analysisResult.confidence && (
                  <div>
                    <h4 className="text-white font-medium mb-2">
                      🎯 Confidence
                    </h4>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-lg font-bold">
                          {analysisData.analysisResult.confidence}%
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            analysisData.analysisResult.confidence >= 80
                              ? "bg-green-500/20 text-green-400"
                              : analysisData.analysisResult.confidence >= 60
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {analysisData.analysisResult.confidence >= 80
                            ? "High"
                            : analysisData.analysisResult.confidence >= 60
                            ? "Medium"
                            : "Low"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            analysisData.analysisResult.confidence >= 80
                              ? "bg-green-400"
                              : analysisData.analysisResult.confidence >= 60
                              ? "bg-yellow-400"
                              : "bg-red-400"
                          }`}
                          style={{
                            width: `${analysisData.analysisResult.confidence}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {analysisData.analysisResult.description && (
                  <div>
                    <h4 className="text-white font-medium mb-2">
                      📝 Description
                    </h4>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <p className="text-white leading-relaxed">
                        {analysisData.analysisResult.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Analysis Date */}
                {analysisData.analysisResult.analysisDate && (
                  <div>
                    <h4 className="text-white font-medium mb-2">
                      🕒 Analyzed At
                    </h4>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <p className="text-white">
                        {new Date(
                          analysisData.analysisResult.analysisDate
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-white/80">No analysis results available</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={handleNewAnalysis}
            className="bg-linear-to-r from-blue-400/80 to-green-400/80 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-lg hover:from-blue-500/90 hover:to-green-500/90 transition-all duration-200 font-medium"
          >
            🔍 Analyze Another Image
          </button>
        </div>

      </div>
    </div>
  );
};

export default Result;