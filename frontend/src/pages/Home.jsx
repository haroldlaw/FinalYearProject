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
        <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-8">
          <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 to-green-400 bg-clip-text text-transparent text-center">
            AI Image Analyzer
          </h1>
        </div>
        
        {/* Upload Section */}
        <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-8">
          <div 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
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
            <div className="text-6xl mb-4">📁</div>
            <p className="text-white text-xl font-medium mb-2">
              Drag & drop an image here, or click to select
            </p>
          </div>

          {/* Simple Image Preview */}
          {selectedImage && (
            <div className="mt-6 text-center">
              <h3 className="text-white text-lg font-bold mb-4">Selected Image</h3>
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Selected"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg border border-white/20"
              />
              <p className="text-white/80 mt-4">
                {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home