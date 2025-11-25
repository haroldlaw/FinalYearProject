const API_BASE_URL = 'http://localhost:9000/api'

// File upload helper function 
const uploadFile = async (endpoint, file, fieldName = 'analysisImage') => {
  const url = `${API_BASE_URL}${endpoint}`
  
  const formData = new FormData()
  formData.append(fieldName, file)

  const token = localStorage.getItem('token')
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    console.log(`Uploading file to: ${url}`)
    console.log(`Field name: ${fieldName}`)
    console.log(`File name: ${file.name}`)
    console.log(`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`File type: ${file.type}`)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    console.log(`Upload response status: ${response.status}`)
    
    const data = await response.json()
    console.log(`Upload response data:`, data)

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Upload failed')
    }

    return { success: true, data: data.data || data }
  } catch (error) {
    console.error(`Upload Error for ${endpoint}:`, error)
    return { success: false, error: error.message }
  }
}

// Image API functions
export const imageAPI = {
  // Upload image for analysis
  uploadAnalysis: async (imageFile) => {
    return await uploadFile('/images/upload', imageFile, 'analysisImage')
  },

  // Get all images
  getImages: async () => {
    return await apiCall('/images/list', { method: 'GET' })
  },

  // Get specific image
  getImage: async (imageId) => {
    return await apiCall(`/images/${imageId}`, { method: 'GET' })
  },

  // Delete image
  deleteImage: async (imageId) => {
    return await apiCall(`/images/${imageId}`, { method: 'DELETE' })
  },
}