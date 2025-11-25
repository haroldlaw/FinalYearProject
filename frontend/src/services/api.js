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
    console.log(`Making API call to: ${url}`);

    const response = await fetch(url, config);
    const data = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, data);

    if (!response.ok) {
      throw new Error(data.error || data.message || "API call failed");
    }
    return { success: true, data };
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
    console.log(`Uploading file to: ${url}`);
    console.log(`Field name: ${fieldName}`);
    console.log(`File name: ${file.name}`);
    console.log(`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`File type: ${file.type}`);

    const response = await fetch(url, {
      method: "POST",
      credentials: 'include', // Include cookies
      body: formData,
    });

    console.log(`Upload response status: ${response.status}`);

    const data = await response.json();
    console.log(`Upload response data:`, data);

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
    console.log('User logged out')
    return result
  },
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

  // Delete image
  deleteImage: async (imageId) => {
    return await apiCall(`/images/${imageId}`, { method: "DELETE" });
  },
};
