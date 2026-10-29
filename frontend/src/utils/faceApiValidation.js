const MODEL_PATHS = [
  '/models',
  'https://justadudewhohacks.github.io/face-api.js/models',
];

let loadPromise = null;

export const loadFaceApiModels = () => {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!window.faceapi) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }

    const faceapiLib = window.faceapi;
    if (!faceapiLib) throw new Error('faceapi not available');

    let loaded = false;
    let lastError = null;

    for (const modelPath of MODEL_PATHS) {
      try {
        await faceapiLib.nets.ssdMobilenetv1.loadFromUri(modelPath);
        await faceapiLib.nets.faceLandmark68Net.loadFromUri(modelPath);
        await faceapiLib.nets.faceRecognitionNet.loadFromUri(modelPath);
        await faceapiLib.nets.faceExpressionNet.loadFromUri(modelPath);
        loaded = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!loaded) {
      throw lastError || new Error('Unable to load face-api models');
    }

    return faceapiLib;
  })();

  return loadPromise;
};

const computeBrightness = (imageData) => {
  const { data } = imageData;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return total / (data.length / 4);
};

const computeSharpness = (imageData) => {
  const { data, width, height } = imageData;
  const toGray = (x, y) => {
    const i = (y * width + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };

  let sum = 0;
  let sumSq = 0;
  let pixels = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const gx =
        -1 * toGray(x - 1, y - 1) - 2 * toGray(x - 1, y) - 1 * toGray(x - 1, y + 1) +
        1 * toGray(x + 1, y - 1) + 2 * toGray(x + 1, y) + 1 * toGray(x + 1, y + 1);
      const gy =
        -1 * toGray(x - 1, y - 1) - 2 * toGray(x, y - 1) - 1 * toGray(x + 1, y - 1) +
        1 * toGray(x - 1, y + 1) + 2 * toGray(x, y + 1) + 1 * toGray(x + 1, y + 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      sum += mag;
      sumSq += mag * mag;
      pixels += 1;
    }
  }

  const mean = sum / pixels;
  return sumSq / pixels - mean * mean;
};

const euclideanDistance = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const similarityFromDistance = (distance) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) return 0;
  return Math.max(0, Math.min(1, 1 - distance));
};

export const analyzeFaceInFile = async ({
  file,
  modelsLoaded,
  referenceDescriptor = null,
  faceMatchThreshold = 0.5,
}) => {
  if (!modelsLoaded) {
    return {
      faceCount: 0,
      confidence: 0,
      boundingBox: null,
      brightness: 0,
      sharpness: 0,
      descriptor: [],
      matchDistance: null,
      matchSimilarity: null,
      matchThreshold: faceMatchThreshold,
      errors: [],
      skipped: true,
    };
  }

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const brightness = computeBrightness(imageData);
  const sharpness = computeSharpness(imageData);

  const faceapiLib = window.faceapi;
  if (!faceapiLib) {
    return {
      faceCount: 0,
      confidence: 0,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      boundingBox: null,
      descriptor: [],
      errors: ['Face API not loaded'],
    };
  }

  const detection = await faceapiLib
    .detectSingleFace(img, new faceapiLib.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  const errors = [];
  let faceCount = 0;
  let confidence = 0;
  let boundingBox = null;
  let descriptor = [];

  if (!detection) {
    errors.push('No face detected');
  } else {
    faceCount = 1;
    confidence = detection.detection.score;
    boundingBox = detection.detection.box;
    descriptor = Array.from(detection.descriptor);

    if (!descriptor.length) {
      errors.push('Face descriptor extraction failed');
    }

    if (referenceDescriptor?.length > 0) {
      const distance = euclideanDistance(referenceDescriptor, descriptor);
      const similarity = similarityFromDistance(distance);

      if (distance === null) {
        errors.push('Descriptor size mismatch for comparison');
      } else if (similarity < faceMatchThreshold) {
        errors.push(
          `Face similarity too low (${(similarity * 100).toFixed(1)}%) against saved profile at threshold ${(faceMatchThreshold * 100).toFixed(1)}%`,
        );
      }

      return {
        faceCount,
        confidence,
        boundingBox,
        brightness: Math.round(brightness),
        sharpness: Math.round(sharpness),
        descriptor,
        matchDistance: distance,
        matchSimilarity: similarity,
        matchThreshold: faceMatchThreshold,
        errors,
      };
    }
  }

  return {
    faceCount,
    confidence,
    boundingBox,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness),
    descriptor,
    matchDistance: null,
    matchSimilarity: null,
    matchThreshold: faceMatchThreshold,
    errors,
  };
};
