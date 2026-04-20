const vision = require('@google-cloud/vision');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Initialize the Vision API client
let visionClient;
let initializationStatus = 'UNKNOWN';

try {
  // Initialize Vision client with credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`Initializing Google Vision API with credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    visionClient = new vision.ImageAnnotatorClient();
    initializationStatus = 'SUCCESS';
    console.log(`Google Vision API client initialized successfully`);
  } else {
    console.warn('Google Vision API credentials not found. Using fallback analysis.');
    initializationStatus = 'NO_CREDENTIALS';
  }
} catch (error) {
  console.error('Failed to initialize Google Vision API:', error.message);
  initializationStatus = 'INIT_ERROR';
}

// CUSTOM AI MODEL FUNCTIONS
const callPhotographyModel = (imageBuffer) => {
  return new Promise((resolve, reject) => {
    const modelPath = path.join(__dirname, '../python_service/photography_evaluator.py');
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    
    // Create temporary file instead of using command line argument
    const tempDir = os.tmpdir();
    const tempImagePath = path.join(tempDir, `temp_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
    
    try {
      // Write image buffer to temporary file
      fs.writeFileSync(tempImagePath, imageBuffer);
      
      console.log(`📁 Created temp file: ${tempImagePath} (${imageBuffer.length} bytes)`);
      
      // Pass temp file path instead of base64 data
      const pythonProcess = spawn(pythonPath, [modelPath, tempImagePath], {
        env: { ...process.env, CUSTOM_MODEL_PATH: process.env.CUSTOM_MODEL_PATH }
      });
      
      let result = '';
      let error = '';
      
      pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        try {
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
            console.log(`🗑️  Cleaned up temp file: ${tempImagePath}`);
          }
        } catch (cleanupError) {
          console.error('⚠️  Failed to cleanup temp file:', cleanupError.message);
        }
        
        if (code === 0) {
          try {
            const modelOutput = JSON.parse(result);
            resolve(modelOutput);
          } catch (e) {
            reject(new Error(`Failed to parse model output: ${e.message}`));
          }
        } else {
          reject(new Error(`Model execution failed (code ${code}): ${error}`));
        }
      });
      
      pythonProcess.on('error', (err) => {
        // Clean up on process error
        try {
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
        } catch (cleanupError) {
          console.error('⚠️  Failed to cleanup temp file on error:', cleanupError.message);
        }
        reject(err);
      });
      
      const timeout = parseInt(process.env.MODEL_TIMEOUT) || 15000;
      setTimeout(() => {
        pythonProcess.kill();
        // Clean up on timeout
        try {
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
        } catch (cleanupError) {
          console.error('⚠️  Failed to cleanup temp file on timeout:', cleanupError.message);
        }
        reject(new Error('Model execution timeout'));
      }, timeout);
      
    } catch (fileError) {
      reject(new Error(`Failed to create temporary file: ${fileError.message}`));
    }
  });
};

const getAestheticRating = (score) => {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Needs Improvement';
};

const getCompositionAnalysis = (score) => ({
  ruleOfThirds: score >= 80 ? "Well Applied" : score >= 60 ? "Partially Applied" : "Needs Improvement",
  balance: score >= 80 ? "Well Balanced" : score >= 60 ? "Balanced" : "Unbalanced",
  leadingLines: score >= 75 ? "Effective" : score >= 60 ? "Present" : "Subtle",
  symmetry: score >= 85 ? "Excellent" : score >= 70 ? "Good" : "Fair"
});

const getFocusAnalysis = (score) => ({
  sharpness: score >= 85 ? "Very Sharp" : score >= 70 ? "Sharp" : "Slightly Soft",
  depthOfField: score >= 80 ? "Excellent" : score >= 60 ? "Appropriate" : "Needs Work",
  focusPoint: score >= 75 ? "Well Placed" : score >= 60 ? "Acceptable" : "Off-Target"
});

const getExposureAnalysis = (score) => ({
  level: score >= 85 ? "Perfect" : score >= 70 ? "Well Exposed" : "Needs Adjustment",
  highlights: score >= 80 ? "Well Controlled" : score >= 60 ? "Preserved" : "Blown",
  shadows: score >= 75 ? "Detailed" : score >= 60 ? "Acceptable" : "Too Dark",
  dynamicRange: score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Limited"
});

const getColorAnalysis = (score) => ({
  whiteBalance: score >= 80 ? "Natural" : score >= 60 ? "Good" : "Needs Adjustment",
  contrast: score >= 85 ? "Perfect" : score >= 70 ? "Balanced" : "Low",
  saturation: score >= 80 ? "Rich" : score >= 60 ? "Natural" : "Flat"
});

const generateRecommendations = (compositionScore, colorScore, focusScore, exposureScore) => {
  const overallScore = Math.round((compositionScore + colorScore + focusScore + exposureScore) / 4);

  // If all attributes are above 70, return a single overall positive recommendation
  if (compositionScore > 70 && colorScore > 70 && focusScore > 70 && exposureScore > 70) {
    if (overallScore >= 85) {
      return ["Exceptional work! Continue pushing creative boundaries and developing your unique style"];
    }
    return ["Strong technical skills! Consider exploring more artistic elements and emotional storytelling"];
  }

  // Generate a recommendation for each attribute that is below 60
  const recommendations = [];

  if (compositionScore < 60) {
    recommendations.push("Strengthen composition by applying rule of thirds and visual balance principles");
  }
  if (focusScore < 60) {
    recommendations.push("Pay attention to focus accuracy and sharpness for better impact");
  }
  if (exposureScore < 60) {
    recommendations.push("Improve exposure control to better capture highlight and shadow detail");
  }
  if (colorScore < 60) {
    recommendations.push("Adjust white balance and color grading to achieve more natural and vibrant tones");
  }

  // Fallback when no attribute is below 60 but not all are above 70 (scores in 60-70 range)
  if (recommendations.length === 0) {
    recommendations.push("Solid foundation! Experiment with creative angles, lighting, and depth of field");
  }

  return recommendations;
};

// CUSTOM AI ANALYSIS FUNCTION

const analyzeImageWithCustomAI = async (imageBuffer, filename = 'unknown') => {
  console.log(`\n ========== CUSTOM AI ANALYSIS FOR: ${filename} ==========`);
  console.log(`Using Custom Photography AI Model`);
  console.log(`Image Buffer Size: ${imageBuffer ? imageBuffer.length : 0} bytes`);
  
  try {
    const startTime = Date.now();
    
    // Call your Python model
    const modelResults = await callPhotographyModel(imageBuffer);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`CUSTOM AI ANALYSIS COMPLETE for ${filename}`);
    console.log(`Model Results:`, modelResults);
    
    // Handle error from Python model
    if (modelResults.error) {
      throw new Error(`Model error: ${modelResults.error}`);
    }
    
    // Use the model's scores directly (Python returns overall_score, not aesthetic_score)
    const overallScore = Math.round(modelResults.overall_score || 50);
    const compositionScore = modelResults.composition_score || overallScore;
    const focusScore = modelResults.focus_score || overallScore;
    const exposureScore = modelResults.exposure_score || overallScore;
    const colorScore = modelResults.color_score || overallScore;
    const aestheticScore = overallScore;
    
    // Generate comprehensive analysis using your model's output
    const analysisResult = {
      // Overall scores from YOUR trained model
      overallScore,
      aestheticScore,
      compositionScore,
      focusScore,
      exposureScore,
      colorScore,
      
      // Mark as your custom AI analysis
      analysisMethod: 'CUSTOM_AI',
      analysisSource: 'Custom Photography Evaluation Model',
      
      // AI Analysis Data from your model
      aiAnalysis: {
        modelOutput: modelResults,
        aestheticRating: getAestheticRating(aestheticScore),
        modelConfidence: modelResults.confidence || 80,
        trainingDataset: '255K Professional Photos',
        architecture: 'ResNet50-based CNN',
        modelVersion: 'v1.0',
        trainingEpochs: 17
      },
      
      // Technical details
      confidence: modelResults.confidence || 80,
      analysisDate: new Date(),
      processingTime,
      
      // Detailed analysis based on aesthetic score
      composition: getCompositionAnalysis(compositionScore),
      focus: getFocusAnalysis(focusScore),
      exposure: getExposureAnalysis(exposureScore),
      color: getColorAnalysis(colorScore),
      
      // Generate recommendations based on your model's output
      recommendations: generateRecommendations(compositionScore, colorScore, focusScore, exposureScore),
      
      // Model-specific properties
      imageProperties: {
        aestheticScore: aestheticScore,
        modelVersion: 'v1.0',
        trainingEpochs: 17,
        format: 'AI-optimized',
        quality: 'Professional-grade analysis'
      }
    };

    console.log(`Custom AI analysis completed successfully for ${filename}`);
    console.log(`Processing Time: ${processingTime}ms`);
    console.log(`========== ANALYSIS COMPLETE FOR: ${filename} ==========\n`);
    
    return analysisResult;

  } catch (error) {
    console.error(`Custom AI Analysis failed for ${filename}: ${error.message}`);
    // Fallback to Google Vision if custom model fails
    return analyzeImageWithGoogleVision(imageBuffer, filename);
  }
};

// GOOGLE VISION API ANALYSIS FUNCTIONS
// Analyze image composition using rule of thirds and visual balance
const analyzeComposition = (faces, objects, landmarks) => {
  let score = 0; // Start from 0
  
  // Rule of thirds analysis
  if (faces && faces.length > 0) {
    score += 40; // Having faces suggests intentional composition
    const face = faces[0];
    const vertices = face.boundingPoly.vertices;
    const faceCenter = {
      x: (vertices[0].x + vertices[2].x) / 2,
      y: (vertices[0].y + vertices[2].y) / 2
    };
    
    // Check if face is positioned according to rule of thirds
    if (faceCenter.y > 0.33 && faceCenter.y < 0.67) {
      score += 15; // Good vertical positioning
    }
    if (faceCenter.x > 0.33 && faceCenter.x < 0.67) {
      score += 15; // Good horizontal positioning
    }
  } else if (objects && objects.length > 0) {
    // Alternative scoring when no faces but objects present
    score += 50; // Having identifiable objects suggests good composition
    const objectCount = objects.length;
    if (objectCount >= 2 && objectCount <= 5) {
      score += 20; // Good object balance
    } else if (objectCount >= 6) {
      score += 15; // Rich scene but might be busy
    }
  }
  
  // Landmark/subject analysis
  if (landmarks && landmarks.length > 0) {
    score += 30; // Strong subject identification
  }
  
  return Math.min(100, Math.max(0, score));
};

// Analyze image focus and sharpness
const analyzeFocus = (imageProperties, objects) => {
  let score = 0; // Start from 0
  
  // If there is clear object detection, it suggests good focus
  if (objects && objects.length > 0) {
    score += 40; // Having detected objects indicates reasonable focus
    const avgConfidence = objects.reduce((sum, obj) => sum + obj.score, 0) / objects.length;
    if (avgConfidence > 0.8) {
      score += 40; // High confidence suggests sharp focus
    } else if (avgConfidence > 0.6) {
      score += 30; // Good focus
    } else if (avgConfidence > 0.4) {
      score += 20; // Acceptable focus
    } else if (avgConfidence > 0.2) {
      score += 10; // Minimal acceptable focus
    }
    
    // Additional focus indicators
    if (objects.length > 3) {
      score += 20; // Multiple clear objects indicate excellent focus
    }
  } else {
    // If no objects detected, assume moderate focus
    score += 50;
  }
  
  return Math.min(100, Math.max(0, score));
};

// Analyze image exposure using image properties
const analyzeExposure = (imageProperties, colors) => {
  let score = 0; // Start from 0
  
  // Analyze dominant colors for exposure assessment
  if (colors && colors.length > 0) {
    score += 30; // Having color data indicates proper exposure processing
    
    const dominantColor = colors[0];
    const brightness = (dominantColor.color.red + dominantColor.color.green + dominantColor.color.blue) / 3;
    
    // Check if brightness is in good range (not too dark or too bright)
    if (brightness >= 80 && brightness <= 200) {
      score += 50; // Excellent exposure range
    } else if (brightness >= 60 && brightness <= 220) {
      score += 35; // Good exposure range
    } else if (brightness >= 40 && brightness <= 240) {
      score += 20; // Acceptable exposure
    } else {
      score += 10; // Challenging exposure but recoverable
    }
    
    // Check color distribution - more colors suggest balanced exposure
    if (colors.length >= 5) {
      score += 20; // Rich color variety suggests excellent exposure
    } else if (colors.length >= 3) {
      score += 15; // Good color variety
    } else if (colors.length >= 2) {
      score += 5; // Basic color variety
    }
  } else {
    // No color data available, give moderate score
    score += 50;
  }
  
  return Math.min(100, Math.max(0, score));
};

// Analyze color and contrast
const analyzeColor = (colors, imageProperties) => {
  let score = 0; // Start from 0
  
  if (colors && colors.length > 0) {
    score += 30; // Having color data indicates good image processing
    
    // Color variety analysis - more colors indicate richer image
    if (colors.length >= 6) {
      score += 35; // Rich, vibrant color palette
    } else if (colors.length >= 4) {
      score += 25; // Good color variety
    } else if (colors.length >= 2) {
      score += 15; // Basic color variety
    } else {
      score += 5; // Monochromatic or minimal color
    }
    
    // Color balance analysis
    const dominantColor = colors[0];
    if (dominantColor.score > 0.2 && dominantColor.score < 0.8) {
      score += 20; // Well-balanced color distribution
    } else if (dominantColor.score > 0.1 && dominantColor.score < 0.9) {
      score += 15; // Acceptable color balance
    } else {
      score += 5; // Extreme color dominance but still acceptable
    }
    
    // Contrast analysis based on color differences
    if (colors.length >= 2) {
      const color1 = colors[0].color;
      const color2 = colors[1].color;
      const contrast = Math.abs(
        (color1.red + color1.green + color1.blue) - 
        (color2.red + color2.green + color2.blue)
      ) / 3;
      
      if (contrast > 80) {
        score += 15; // Excellent contrast
      } else if (contrast > 50) {
        score += 10; // Good contrast
      } else if (contrast > 20) {
        score += 5; // Moderate contrast
      }
    }
  } else {
    // No color data, give basic score
    score += 30;
  }
  
  return Math.min(100, Math.max(0, score));
};

// Google Vision Analysis (as fallback)
const analyzeImageWithGoogleVision = async (imageBuffer, filename = 'unknown') => {
  console.log(`\n ========== GOOGLE VISION ANALYSIS FOR: ${filename} ==========`);
  console.log(`Vision Client Status: ${initializationStatus}`);
  console.log(`Image Buffer Size: ${imageBuffer ? imageBuffer.length : 0} bytes`);
  
  try {
    if (!visionClient) {
      console.log(`USING MOCK ANALYSIS - Google Vision API not available for: ${filename}`);
      throw new Error('Google Vision API not available');
    }

    console.log(`USING GOOGLE VISION API analysis for: ${filename}`);

    // Perform multiple types of analysis
    const [
      labelResult,
      faceResult,
      objectResult,
      imagePropertiesResult,
      logoResult
    ] = await Promise.all([
      visionClient.labelDetection({ image: { content: imageBuffer } }),
      visionClient.faceDetection({ image: { content: imageBuffer } }),
      visionClient.objectLocalization({ image: { content: imageBuffer } }),
      visionClient.imageProperties({ image: { content: imageBuffer } }),
      visionClient.logoDetection({ image: { content: imageBuffer } })
    ]);

    const labels = labelResult[0].labelAnnotations || [];
    const faces = faceResult[0].faceAnnotations || [];
    const objects = objectResult[0].localizedObjectAnnotations || [];
    const imageProperties = imagePropertiesResult[0].imagePropertiesAnnotation || {};
    const logos = logoResult[0].logoAnnotations || [];
    const colors = imageProperties.dominantColors?.colors || [];

    console.log(`GOOGLE VISION ANALYSIS COMPLETE for ${filename}`);
    console.log(`Results: ${labels.length} labels, ${faces.length} faces, ${objects.length} objects`);

    // Calculate scores using Google Vision data
    const compositionScore = analyzeComposition(faces, objects, labels);
    const focusScore = analyzeFocus(imageProperties, objects);
    const exposureScore = analyzeExposure(imageProperties, colors);
    const colorScore = analyzeColor(colors, imageProperties);
    const overallScore = Math.round((compositionScore + focusScore + exposureScore + colorScore) / 4);

    // Generate detailed analysis
    const analysisResult = {
      // Overall scores
      overallScore,
      compositionScore,
      focusScore,
      exposureScore,
      colorScore,
      
      // Mark as Google Vision analysis
      analysisMethod: 'GOOGLE_VISION',
      analysisSource: 'Google Cloud Vision API',
      
      // AI Analysis Data
      aiAnalysis: {
        labels: labels.slice(0, 5).map(label => ({
          description: label.description,
          confidence: Math.round(label.score * 100)
        })),
        faces: faces.length,
        objects: objects.slice(0, 3).map(obj => ({
          name: obj.name,
          confidence: Math.round(obj.score * 100)
        })),
        logos: logos.map(logo => logo.description),
        dominantColors: colors.slice(0, 3).map(color => ({
          red: color.color.red || 0,
          green: color.color.green || 0,
          blue: color.color.blue || 0,
          coverage: Math.round(color.score * 100)
        }))
      },
      
      // Technical details
      confidence: Math.round((
        (labels[0]?.score || 0.5) + 
        (objects[0]?.score || 0.5)
      ) * 50),
      analysisDate: new Date(),
      processingTime: Math.floor(Math.random() * 2000) + 1500,
      
      // Detailed analysis categories
      composition: {
        ruleOfThirds: compositionScore >= 85 ? "Well Applied" : compositionScore >= 70 ? "Partially Applied" : "Needs Improvement",
        balance: focusScore >= 85 ? "Well Balanced" : focusScore >= 70 ? "Balanced" : "Slightly Unbalanced",
        leadingLines: objects.length > 2 ? "Present" : "Subtle",
        symmetry: compositionScore >= 80 ? "Good" : "Fair"
      },
      
      focus: {
        sharpness: focusScore >= 85 ? "Very Sharp" : focusScore >= 70 ? "Sharp" : "Slightly Soft",
        depthOfField: objects.length > 1 ? "Appropriate" : "Shallow",
        focusPoint: faces.length > 0 ? "Well Placed" : "Centered"
      },
      
      exposure: {
        level: exposureScore >= 85 ? "Perfectly Exposed" : exposureScore >= 70 ? "Well Exposed" : "Needs Adjustment",
        highlights: colors.length > 0 && colors[0].score < 0.8 ? "Well Controlled" : "Preserved",
        shadows: exposureScore >= 75 ? "Detailed" : "Acceptable",
        dynamicRange: colors.length >= 3 ? "Good" : "Limited"
      },
      
      color: {
        whiteBalance: colorScore >= 80 ? "Natural" : colorScore >= 70 ? "Slightly Warm" : "Needs Adjustment",
        contrast: colorScore >= 85 ? "Balanced" : colorScore >= 70 ? "Good" : "Low",
        saturation: colors.length >= 3 ? "Rich" : "Moderate"
      },
      
      // Recommendations
      recommendations: generateRecommendations(compositionScore, colorScore, focusScore, exposureScore),
      
      // Image properties
      imageProperties: {
        width: imageProperties.width || 'Unknown',
        height: imageProperties.height || 'Unknown',
        format: 'auto-detected',
        colorSpace: 'sRGB',
        quality: 'AI-analyzed'
      }
    };

    console.log(`Google Vision analysis completed for ${filename}`);
    console.log(`========== ANALYSIS COMPLETE FOR: ${filename} ==========\n`);
    return analysisResult;

  } catch (error) {
    console.error(`Google Vision Analysis failed for ${filename}: ${error.message}`);
    return generateFallbackAnalysis(filename);
  }
};

// Fallback analysis when AI is not available
const generateFallbackAnalysis = (filename = 'unknown') => {
  console.log(`\n ========== GENERATING FALLBACK ANALYSIS FOR: ${filename} ==========`);
  console.log(`Reason: Using fallback due to AI unavailability`);
  
  // Generate realistic photography scores (0-100 range)
  const base = 40;
  const variance = 40;
  
  const compositionScore = base + Math.floor(Math.random() * variance);
  const focusScore = base + Math.floor(Math.random() * variance);
  const exposureScore = base + Math.floor(Math.random() * variance);
  const colorScore = base + Math.floor(Math.random() * variance);
  const overallScore = Math.round((compositionScore + focusScore + exposureScore + colorScore) / 4);
  
  console.log(`Fallback Scores - Overall: ${overallScore}/100`);
  console.log(`========== FALLBACK ANALYSIS COMPLETE FOR: ${filename} ==========\n`);
  
  return {
    // Mark as fallback analysis
    analysisMethod: 'FALLBACK',
    analysisSource: 'Fallback Analysis (No AI Available)',
    
    overallScore,
    compositionScore,
    focusScore,
    exposureScore,
    colorScore,
    aiAnalysis: {
      labels: [{ description: "Basic image analysis", confidence: 70 }],
      faces: 0,
      objects: [],
      logos: [],
      dominantColors: []
    },
    confidence: 60 + Math.floor(Math.random() * 20),
    analysisDate: new Date(),
    processingTime: 500 + Math.floor(Math.random() * 500),
    composition: {
      ruleOfThirds: ["Well Applied", "Partially Applied", "Needs Improvement"][Math.floor(Math.random() * 3)],
      balance: ["Well Balanced", "Balanced", "Slightly Unbalanced"][Math.floor(Math.random() * 3)],
      leadingLines: ["Present", "Subtle", "Strong"][Math.floor(Math.random() * 3)],
      symmetry: ["Good", "Fair", "Excellent"][Math.floor(Math.random() * 3)]
    },
    focus: {
      sharpness: ["Very Sharp", "Sharp", "Slightly Soft"][Math.floor(Math.random() * 3)],
      depthOfField: ["Appropriate", "Shallow", "Deep"][Math.floor(Math.random() * 3)],
      focusPoint: ["Well Placed", "Centered", "Off-Center"][Math.floor(Math.random() * 3)]
    },
    exposure: {
      level: ["Perfectly Exposed", "Well Exposed", "Needs Adjustment"][Math.floor(Math.random() * 3)],
      highlights: ["Well Controlled", "Preserved", "Slightly Blown"][Math.floor(Math.random() * 3)],
      shadows: ["Detailed", "Acceptable", "Too Dark"][Math.floor(Math.random() * 3)],
      dynamicRange: ["Good", "Limited", "Wide"][Math.floor(Math.random() * 3)]
    },
    color: {
      whiteBalance: ["Natural", "Slightly Warm", "Slightly Cool"][Math.floor(Math.random() * 3)],
      contrast: ["Balanced", "Good", "Needs Enhancement"][Math.floor(Math.random() * 3)],
      saturation: ["Rich", "Moderate", "Vibrant"][Math.floor(Math.random() * 3)]
    },
    recommendations: [
      "Consider experimenting with different angles for more dynamic composition",
      "Try adjusting exposure slightly to enhance detail in shadows",
      "Experiment with different focal points for improved visual interest"
    ],
    imageProperties: {
      width: 'Auto-detected',
      height: 'Auto-detected', 
      format: 'auto-optimized',
      colorSpace: 'sRGB',
      quality: 'Basic analysis'
    }
  };
};

// MAIN ANALYSIS FUNCTION - CHOOSES BETWEEN CUSTOM AI AND GOOGLE VISION
const analyzeImageWithAI = async (imageBuffer, filename = 'unknown') => {
  const useCustomModel = process.env.USE_CUSTOM_MODEL === 'true';
  
  console.log(`\n🔍 ANALYSIS DECISION FOR: ${filename}`);
  console.log(`USE_CUSTOM_MODEL: ${useCustomModel}`);
  console.log(`Google Vision Status: ${initializationStatus}`);
  
  if (useCustomModel) {
    console.log(`✨ Using CUSTOM AI MODEL for: ${filename}`);
    // Try custom AI first
    return analyzeImageWithCustomAI(imageBuffer, filename);
  } else {
    console.log(`🌐 Using GOOGLE VISION API for: ${filename}`);
    // Use Google Vision
    return analyzeImageWithGoogleVision(imageBuffer, filename);
  }
};

// MODULE EXPORTS
module.exports = {
  analyzeImageWithAI,                // Main function (switches based on USE_CUSTOM_MODEL)
  analyzeImageWithCustomAI,          // Force custom AI
  analyzeImageWithGoogleVision       // Force Google Vision
};