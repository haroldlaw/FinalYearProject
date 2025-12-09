const vision = require('@google-cloud/vision');

// Initialize the Vision API client
let visionClient;
let initializationStatus = 'UNKNOWN';

try {
  // Initialize Vision client with credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`🔧 Initializing Google Vision API with credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    visionClient = new vision.ImageAnnotatorClient();
    initializationStatus = 'SUCCESS';
    console.log(`✅ Google Vision API client initialized successfully`);
  } else {
    console.warn('❌ Google Vision API credentials not found. Using fallback analysis.');
    initializationStatus = 'NO_CREDENTIALS';
  }
} catch (error) {
  console.error('❌ Failed to initialize Google Vision API:', error.message);
  initializationStatus = 'INIT_ERROR';
}

/**
 * Analyze image composition using rule of thirds and visual balance
 */
const analyzeComposition = (faces, objects, landmarks) => {
  let score = 70; // Base score
  
  // Rule of thirds analysis
  if (faces && faces.length > 0) {
    const face = faces[0];
    const vertices = face.boundingPoly.vertices;
    const faceCenter = {
      x: (vertices[0].x + vertices[2].x) / 2,
      y: (vertices[0].y + vertices[2].y) / 2
    };
    
    // Check if face is positioned according to rule of thirds
    // Assuming image dimensions, check if face is in the upper/lower third
    if (faceCenter.y > 0.33 && faceCenter.y < 0.67) {
      score += 10; // Good vertical positioning
    }
    if (faceCenter.x > 0.33 && faceCenter.x < 0.67) {
      score += 10; // Good horizontal positioning
    }
  }
  
  // Object distribution analysis
  if (objects && objects.length > 0) {
    const objectCount = objects.length;
    if (objectCount >= 2 && objectCount <= 5) {
      score += 5; // Good object balance
    }
  }
  
  return Math.min(95, Math.max(60, score));
};

/**
 * Analyze image focus and sharpness
 */
const analyzeFocus = (imageProperties, objects) => {
  let score = 70; // Base score
  
  // If we have clear object detection, it suggests good focus
  if (objects && objects.length > 0) {
    const avgConfidence = objects.reduce((sum, obj) => sum + obj.score, 0) / objects.length;
    if (avgConfidence > 0.8) {
      score += 15; // High confidence suggests sharp focus
    } else if (avgConfidence > 0.6) {
      score += 10;
    } else if (avgConfidence > 0.4) {
      score += 5;
    }
  }
  
  return Math.min(95, Math.max(60, score));
};

/**
 * Analyze image exposure using image properties
 */
const analyzeExposure = (imageProperties, colors) => {
  let score = 70; // Base score
  
  // Analyze dominant colors for exposure assessment
  if (colors && colors.length > 0) {
    const dominantColor = colors[0];
    const brightness = (dominantColor.color.red + dominantColor.color.green + dominantColor.color.blue) / 3;
    
    // Check if brightness is in good range (not too dark or too bright)
    if (brightness >= 80 && brightness <= 200) {
      score += 20; // Good exposure
    } else if (brightness >= 60 && brightness <= 220) {
      score += 10; // Acceptable exposure
    }
    
    // Check color distribution
    if (colors.length >= 3) {
      score += 5; // Good color variety suggests proper exposure
    }
  }
  
  return Math.min(95, Math.max(60, score));
};

/**
 * Analyze color and contrast
 */
const analyzeColor = (colors, imageProperties) => {
  let score = 70; // Base score
  
  if (colors && colors.length > 0) {
    // Color variety analysis
    if (colors.length >= 4) {
      score += 15; // Rich color palette
    } else if (colors.length >= 2) {
      score += 10; // Good color variety
    }
    
    // Color balance analysis
    const dominantColor = colors[0];
    if (dominantColor.score > 0.3 && dominantColor.score < 0.7) {
      score += 10; // Balanced color distribution
    }
    
    // Contrast analysis based on color differences
    if (colors.length >= 2) {
      const color1 = colors[0].color;
      const color2 = colors[1].color;
      const contrast = Math.abs(
        (color1.red + color1.green + color1.blue) - 
        (color2.red + color2.green + color2.blue)
      ) / 3;
      
      if (contrast > 50) {
        score += 10; // Good contrast
      }
    }
  }
  
  return Math.min(95, Math.max(60, score));
};

/**
 * Main function to analyze image using Google Vision API
 */
const analyzeImageWithAI = async (imageBuffer, filename = 'unknown') => {
  console.log(`\n🔍 ========== STARTING ANALYSIS FOR: ${filename} ==========`);
  console.log(`📊 Vision Client Status: ${initializationStatus}`);
  console.log(`📊 Vision Client Available: ${!!visionClient}`);
  console.log(`📊 Image Buffer Size: ${imageBuffer ? imageBuffer.length : 0} bytes`);
  
  try {
    if (!visionClient) {
      console.log(`❌ USING MOCK ANALYSIS - Google Vision API not available for: ${filename}`);
      console.log(`📋 Reason: Vision client not initialized (Status: ${initializationStatus})`);
      throw new Error('Google Vision API not available');
    }

    console.log(`🤖 USING REAL AI ANALYSIS - Starting Google Vision API analysis for: ${filename}`);
    console.log(`⏱️  Analysis started at: ${new Date().toISOString()}`);

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

    console.log(`✅ REAL AI ANALYSIS COMPLETE for ${filename}`);
    console.log(`📊 Analysis Results: ${labels.length} labels, ${faces.length} faces, ${objects.length} objects`);
    console.log(`⏱️  Analysis completed at: ${new Date().toISOString()}`);

    // Calculate scores using AI analysis data
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
      
      // Mark as real AI analysis
      analysisMethod: 'REAL_AI',
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
      processingTime: Math.floor(Math.random() * 2000) + 1500, // Simulated processing time
      
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
      
      // AI-generated recommendations
      recommendations: generateRecommendations(compositionScore, focusScore, exposureScore, colorScore, labels, faces, objects),
      
      // Image properties
      imageProperties: {
        width: imageProperties.width || 'Unknown',
        height: imageProperties.height || 'Unknown',
        format: 'auto-detected',
        colorSpace: 'sRGB',
        quality: 'AI-analyzed'
      }
    };

    console.log(`✅ REAL AI analysis completed successfully for ${filename}`);
    console.log(`🎯 Final Scores - Overall: ${overallScore}/100, Composition: ${compositionScore}/100, Focus: ${focusScore}/100, Exposure: ${exposureScore}/100, Color: ${colorScore}/100`);
    console.log(`========== ANALYSIS COMPLETE FOR: ${filename} ==========\n`);
    return analysisResult;

  } catch (error) {
    console.error(`❌ REAL AI Analysis failed for ${filename}, falling back to mock analysis`);
    console.error(`📋 Error Details: ${error.message}`);
    console.error(`📋 Error Code: ${error.code || 'N/A'}`);
    console.log(`🎭 Switching to MOCK ANALYSIS for: ${filename}`);
    return generateFallbackAnalysis(filename);
  }
};

/**
 * Generate AI-powered recommendations based on scores and analysis data
 */
const generateRecommendations = (compositionScore, focusScore, exposureScore, colorScore, labels, faces, objects) => {
  console.log(`🎯 Generating recommendations based on scores: Comp=${compositionScore}, Focus=${focusScore}, Exp=${exposureScore}, Color=${colorScore}`);
  console.log(`📊 AI Detection data: ${labels?.length || 0} labels, ${faces?.length || 0} faces, ${objects?.length || 0} objects`);
  
  const recommendations = [];
  
  // Score-based recommendations 
  if (compositionScore < 75) {
    recommendations.push("Try using the rule of thirds - position key subjects along the grid lines for better composition");
  }
  
  if (focusScore < 75) {
    recommendations.push("Consider using a faster shutter speed or better stabilization for sharper focus");
  }
  
  if (exposureScore < 75) {
    recommendations.push("Adjust exposure settings - try exposure compensation or different metering modes");
  }
  
  if (colorScore < 75) {
    recommendations.push("Experiment with white balance settings or post-processing to enhance color accuracy");
  }
  
  // Subject-specific recommendations based on AI detection
  if (faces && faces.length > 0) {
    recommendations.push("Great portrait detected! Consider using portrait mode or wider aperture for better background blur");
  }
  
  if (labels && labels.some(label => 
    label.description && label.description.toLowerCase().includes('landscape')
  )) {
    recommendations.push("Beautiful landscape! Try using a polarizing filter to enhance sky contrast and reduce reflections");
  }
  
  if (objects && objects.length > 3) {
    recommendations.push("Rich scene with multiple subjects - consider simplifying composition for stronger visual impact");
  }
  
  // Additional recommendations based on score combinations
  if (compositionScore >= 85 && focusScore >= 85) {
    recommendations.push("Excellent technical execution! Try experimenting with creative angles or lighting for artistic effect");
  }
  
  if (exposureScore < 70 && colorScore < 70) {
    recommendations.push("Consider shooting in RAW format to have more flexibility in post-processing exposure and color");
  }
  
  // Default recommendation if no specific issues found
  if (recommendations.length === 0) {
    recommendations.push("Well-composed image! Continue exploring different subjects and lighting conditions");
  }
  
  // Return top 3 recommendations
  console.log(`💡 Generated ${recommendations.length} recommendations: ${recommendations.map(r => `"${r.substring(0, 30)}..."`).join(', ')}`);
  return recommendations.slice(0, 3);
};

/**
 * Fallback analysis when AI is not available
 */
const generateFallbackAnalysis = (filename = 'unknown') => {
  console.log(`\n🎭 ========== GENERATING MOCK ANALYSIS FOR: ${filename} ==========`);
  console.log(`📋 Reason: Using fallback due to AI unavailability`);
  console.log(`⏱️  Mock analysis started at: ${new Date().toISOString()}`);
  
  const base = 70;
  const variance = 25;
  
  const compositionScore = base + Math.floor(Math.random() * variance);
  const focusScore = base + Math.floor(Math.random() * variance);
  const exposureScore = base + Math.floor(Math.random() * variance);
  const colorScore = base + Math.floor(Math.random() * variance);
  const overallScore = Math.round((compositionScore + focusScore + exposureScore + colorScore) / 4);
  
  console.log(`🎯 Mock Scores - Overall: ${overallScore}/100, Composition: ${compositionScore}/100, Focus: ${focusScore}/100, Exposure: ${exposureScore}/100, Color: ${colorScore}/100`);
  console.log(`========== MOCK ANALYSIS COMPLETE FOR: ${filename} ==========\n`);
  
  return {
    // Mark as mock analysis
    analysisMethod: 'MOCK',
    analysisSource: 'Fallback Mock Analysis',
    
    overallScore,
    compositionScore,
    focusScore,
    exposureScore,
    colorScore,
    aiAnalysis: {
      labels: [{ description: "Image analysis", confidence: 85 }],
      faces: 0,
      objects: [],
      logos: [],
      dominantColors: []
    },
    confidence: 75 + Math.floor(Math.random() * 20),
    analysisDate: new Date(),
    processingTime: 1500 + Math.floor(Math.random() * 1000),
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
      quality: 'Enhanced analysis'
    }
  };
};

module.exports = {
  analyzeImageWithAI
};
