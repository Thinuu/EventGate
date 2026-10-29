import React, { useState, useRef } from 'react';
import { CameraIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const PhotoUpload = ({ 
  currentPhoto, 
  onPhotoChange, 
  maxSizeMB = 5, 
  required = false,
  label = "Photo",
  helperText = "Upload a clear photo of your face for verification"
}) => {
  const [preview, setPreview] = useState(currentPhoto || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    setPreview(currentPhoto || null);
  }, [currentPhoto]);

  const validateFile = (file) => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return false;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const processFile = (file) => {
    if (!validateFile(file)) return;

    setError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target.result;
      setPreview(imageUrl);
      setUploading(false);
      
      // Pass the file to parent component
      if (onPhotoChange) {
        onPhotoChange({
          file,
          preview: imageUrl,
          name: file.name
        });
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    setError(null);
    if (onPhotoChange) {
      onPhotoChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {helperText && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive 
            ? 'border-teal-400 bg-teal-50' 
            : preview 
              ? 'border-green-400 bg-green-50' 
              : 'border-gray-300 hover:border-gray-400'
          }
        `}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-sm text-gray-600">Uploading photo...</p>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg mx-auto"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto();
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <CheckCircleSolid className="h-5 w-5" />
              <span className="text-sm font-medium">Photo uploaded</span>
            </div>
            <p className="text-xs text-gray-500">Click to change photo</p>
          </div>
        ) : (
          <div className="space-y-3">
            <CameraIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, GIF up to {maxSizeMB}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {preview && !error && (
        <div className="flex items-center space-x-2 text-green-600 text-sm">
          <CheckCircleIcon className="h-4 w-4" />
          <span>Photo ready for verification</span>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
