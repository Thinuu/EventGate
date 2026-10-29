/**
 * Photo Quality Checker Utility
 * Analyzes photos for: file size, resolution, blur, brightness
 * Returns quality rating (Good/Medium/Poor) and warnings
 */

export const photoQualityChecker = {
  // File size validation (50KB-5MB)
  checkFileSize: (file) => {
    const minSize = 50 * 1024; // 50KB
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (file.size < minSize) {
      return { valid: false, warning: 'Image too small (minimum 50KB)' };
    }
    if (file.size > maxSize) {
      return { valid: false, warning: 'Image too large (maximum 5MB)' };
    }
    return { valid: true, warning: null };
  },

  // File type validation
  checkFileType: (file) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      return { valid: false, warning: 'Invalid file type (only JPG/PNG allowed)' };
    }
    return { valid: true, warning: null };
  },

  // Resolution validation (min 300x300)
  checkResolution: (img) => {
    const minResolution = 300;
    
    if (img.width < minResolution || img.height < minResolution) {
      return {
        valid: false,
        warning: `Image resolution too low (${img.width}x${img.height}), minimum ${minResolution}x${minResolution}`,
        dimensions: { width: img.width, height: img.height },
      };
    }

    return { valid: true, warning: null, dimensions: { width: img.width, height: img.height } };
  },

  // Blur detection using canvas pixel variance
  checkBlur: (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Compute Laplacian variance (measures sharpness)
    let variance = 0;
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // Iterate through pixels with Sobel operator for edge detection
    for (let y = 1; y < canvas.height - 1; y += 2) {
      for (let x = 1; x < canvas.width - 1; x += 2) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = (r * 0.299 + g * 0.587 + b * 0.114);

        // Compute Laplacian
        const i_l = ((y) * canvas.width + (x - 1)) * 4;
        const i_r = ((y) * canvas.width + (x + 1)) * 4;
        const i_u = ((y - 1) * canvas.width + x) * 4;
        const i_d = ((y + 1) * canvas.width + x) * 4;

        const gray_l = (data[i_l] * 0.299 + data[i_l + 1] * 0.587 + data[i_l + 2] * 0.114);
        const gray_r = (data[i_r] * 0.299 + data[i_r + 1] * 0.587 + data[i_r + 2] * 0.114);
        const gray_u = (data[i_u] * 0.299 + data[i_u + 1] * 0.587 + data[i_u + 2] * 0.114);
        const gray_d = (data[i_d] * 0.299 + data[i_d + 1] * 0.587 + data[i_d + 2] * 0.114);

        const laplacian = Math.abs(-4 * gray + gray_l + gray_r + gray_u + gray_d);

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count += 1;
      }
    }

    const mean = sum / count;
    variance = (sumSq / count) - (mean * mean);

    // Threshold for blur detection
    const isBlurry = variance < 100; // Low variance = blurry

    return {
      valid: !isBlurry,
      warning: isBlurry ? 'Image appears blurry' : null,
      sharpness: Math.round(variance),
    };
  },

  // Brightness check
  checkBrightness: (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminosity method
      totalBrightness += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    const avgBrightness = totalBrightness / (data.length / 4);

    const warnings = [];
    let valid = true;

    if (avgBrightness < 60) {
      warnings.push('Image is too dark');
      valid = false;
    } else if (avgBrightness > 220) {
      warnings.push('Image is too bright (overexposed)');
      valid = false;
    }

    return {
      valid,
      warning: warnings.length > 0 ? warnings[0] : null,
      brightness: Math.round(avgBrightness),
    };
  },

  // Contrast detection
  checkContrast: (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      min = Math.min(min, gray);
      max = Math.max(max, gray);
    }

    const contrast = max - min;
    const lowContrast = contrast < 50;

    return {
      valid: !lowContrast,
      warning: lowContrast ? 'Image has low contrast' : null,
      contrast: Math.round(contrast),
    };
  },

  // Overall quality rating
  computeQualityRating: (checks) => {
    const allValid = Object.values(checks).every((check) => check.valid !== false);

    if (allValid) {
      return { rating: 'Good', score: 90 };
    }

    // Count warnings
    const warningCount = Object.values(checks).filter((check) => !check.valid).length;

    if (warningCount <= 1) {
      return { rating: 'Medium', score: 70 };
    }

    return { rating: 'Poor', score: 50 };
  },

  // Full analysis
  analyzePhoto: async (file) => {
    const results = {
      fileSize: photoQualityChecker.checkFileSize(file),
      fileType: photoQualityChecker.checkFileType(file),
      resolution: null,
      blur: null,
      brightness: null,
      contrast: null,
      warnings: [],
      errors: [],
    };

    // Add file-level issues
    if (!results.fileSize.valid) results.errors.push(results.fileSize.warning);
    if (!results.fileType.valid) results.errors.push(results.fileType.warning);

    if (results.errors.length > 0) {
      return results;
    }

    // Load image for pixel-level analysis
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Perform checks
        results.resolution = photoQualityChecker.checkResolution(img);
        results.blur = photoQualityChecker.checkBlur(canvas);
        results.brightness = photoQualityChecker.checkBrightness(canvas);
        results.contrast = photoQualityChecker.checkContrast(canvas);

        // Collect warnings
        if (!results.resolution.valid) results.warnings.push(results.resolution.warning);
        if (!results.blur.valid) results.warnings.push(results.blur.warning);
        if (!results.brightness.valid) results.warnings.push(results.brightness.warning);
        if (!results.contrast.valid) results.warnings.push(results.contrast.warning);

        // Compute quality rating
        results.qualityRating = photoQualityChecker.computeQualityRating({
          blur: results.blur,
          brightness: results.brightness,
          contrast: results.contrast,
        });

        resolve(results);
      };

      img.onerror = () => {
        results.errors.push('Failed to load image');
        resolve(results);
      };

      img.src = URL.createObjectURL(file);
    });
  },
};

// Auto-enhance utility
export const photoEnhancer = {
  // Adjust brightness and contrast
  enhanceImage: (canvas, brightnessDelta = 10, contrastFactor = 1.1) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Apply contrast
      r = Math.round((r - 128) * contrastFactor + 128);
      g = Math.round((g - 128) * contrastFactor + 128);
      b = Math.round((b - 128) * contrastFactor + 128);

      // Apply brightness
      r = Math.round(r + brightnessDelta);
      g = Math.round(g + brightnessDelta);
      b = Math.round(b + brightnessDelta);

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  },

  // Apply filter presets
  applyFilter: (canvas, filterType = 'none') => {
    switch (filterType) {
      case 'brighten':
        return photoEnhancer.enhanceImage(canvas, 15, 1.0);
      case 'enhance':
        return photoEnhancer.enhanceImage(canvas, 10, 1.15);
      case 'vivid':
        return photoEnhancer.enhanceImage(canvas, 5, 1.25);
      default:
        return canvas.toDataURL('image/jpeg', 0.95);
    }
  },
};
