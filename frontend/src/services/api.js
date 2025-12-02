const API_BASE_URL = "http://localhost:9000/api";

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Include cookies in requests
    ...options,
  };
  try {
    const response = await fetch(url, config);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text();
      throw new Error(`Server returned non-JSON response: ${textResponse}`);
    }
    
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
};

// File upload helper function
const uploadFile = async (endpoint, file, fieldName = "analysisImage") => {
  const url = `${API_BASE_URL}${endpoint}`;

  const formData = new FormData();
  formData.append(fieldName, file);

  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: 'include', // Include cookies
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Upload failed");
    }

    return { success: true, data: data.data || data };
  } catch (error) {
    console.error(`Upload Error for ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
};

// Auth API functions
export const authAPI = {
  // Sign up user
  signup: async (userData) => {
    return await apiCall('/users/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  // Login user
  login: async (credentials) => {
    return await apiCall('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  // Logout user 
  logout: async () => {
    const result = await apiCall('/users/logout', { method: 'POST' })
    return result
  },

  // Get current user
  getCurrentUser: async () => {
    return await apiCall('/users/me', { method: 'GET' })
  },

  // Get user upload history
  getUserHistory: async () => {
    return await apiCall('/users/history', { method: 'GET' })
  },

  // Update user profile
  updateProfile: async (userData) => {
    return await apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  },

  // Delete user image
  deleteUserImage: async (imageId) => {
    return await apiCall(`/users/images/${imageId}`, { method: 'DELETE' })
  },

  // Forgot password
  forgotPassword: async (email) => {
    return await apiCall('/users/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  // Reset password
  resetPassword: async (email, newPassword) => {
    return await apiCall('/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword }),
    })
  }
}

// Image API functions
export const imageAPI = {
  // Upload image for analysis
  uploadAnalysis: async (imageFile) => {
    return await uploadFile("/images/upload", imageFile, "analysisImage");
  },

  // Get all images
  getImages: async () => {
    return await apiCall("/images/list", { method: "GET" });
  },

  // Get specific image
  getImage: async (imageId) => {
    return await apiCall(`/images/${imageId}`, { method: "GET" });
  },
};
