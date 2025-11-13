import React, { useState } from 'react'
import background from '../assets/background.jpg'

const Home = () => {
  const [selectedImage, setSelectedImage] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
    }
  }

  const removeSelectedImage = () => {
    setSelectedImage(null)
  }

  return (
    <div className="flex justify-center items-center" 
         style={{ 
           position: 'fixed',
           top: 0,
           left: 0,
           width: '100vw',
           height: '100vh',
           backgroundImage: `url(${background})`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat'
         }}>
      <div className="w-full max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-xl p-4 mb-6">
          <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-green-400 bg-clip-text text-transparent text-center">
            AI Image Analyzer
          </h1>
        </div>
        
        {/* Upload Section */}
        <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-6">
          {!selectedImage ? (
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                dragActive 
                  ? 'border-blue-400 bg-blue-500/20' 
                  : 'border-white/40 hover:border-white/60 hover:bg-white/10'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('imageUpload').click()}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
              />
              <div className="text-5xl mb-3">📁</div>
              <p className="text-white text-lg font-medium mb-2">
                Drag & drop an image here, or click to select
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold bg-linear-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">Selected Image</h3>
                <button
                  onClick={removeSelectedImage}
                  className="bg-linear-to-r from-red-400/80 to-red-600/80 backdrop-blur-sm border border-white/20 text-white px-4 py-2 rounded-lg hover:from-red-500/90 hover:to-red-700/90 transition-all duration-200 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Selected"
                className="w-80 h-60 mx-auto rounded-lg shadow-lg border border-white/20 object-contain bg-gray-900/20"
              />
              <p className="text-white/80 mt-4">
                {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
              </p>
              <button
                onClick={() => {/* Add analyze functionality here */}}
                className="mt-4 bg-linear-to-r from-blue-400/80 to-green-400/80 backdrop-blur-sm border border-white/20 text-white px-4 py-2 rounded-lg hover:from-blue-500/90 hover:to-green-500/90 transition-all duration-200 text-sm font-medium"
              >
                Analyze Image
              </button>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home