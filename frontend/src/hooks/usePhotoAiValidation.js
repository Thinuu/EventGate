import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { photoQualityChecker } from '../utils/photoQualityChecker';
import { analyzeFaceInFile, loadFaceApiModels } from '../utils/faceApiValidation';

export const usePhotoAiValidation = ({
  referenceDescriptor = null,
  faceMatchThreshold = 0.5,
  showModelLoadError = true,
} = {}) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [allowOverride, setAllowOverride] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [faceAnalysis, setFaceAnalysis] = useState(null);
  const [validating, setValidating] = useState(false);

  const imageRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    let active = true;

    loadFaceApiModels()
      .then(() => {
        if (active) setModelsLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load face-api models', err);
        if (active) {
          setModelLoadFailed(true);
          if (showModelLoadError) {
            toast.error('Face matching is temporarily unavailable. You can still submit your photo.');
          }
        }
      });

    return () => {
      active = false;
    };
  }, [showModelLoadError]);

  const drawBoundingBox = useCallback((box) => {
    const canvas = overlayRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !box) return;

    const ctx = canvas.getContext('2d');
    const ratio = img.naturalWidth / img.clientWidth;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x / ratio, box.y / ratio, box.width / ratio, box.height / ratio);
  }, []);

  const validateFile = useCallback(async (file) => {
    if (!file) return [];

    setValidating(true);
    try {
      const analysis = await photoQualityChecker.analyzePhoto(file);
      setQualityAnalysis(analysis);

      const allErrors = [...analysis.errors, ...analysis.warnings];
      const faceResult = await analyzeFaceInFile({
        file,
        modelsLoaded,
        referenceDescriptor,
        faceMatchThreshold,
      });
      setFaceAnalysis(faceResult);

      if (faceResult.errors.length > 0) {
        allErrors.push(...faceResult.errors);
      }

      if (faceResult.boundingBox && imageRef.current) {
        drawBoundingBox(faceResult.boundingBox);
      }

      setValidationErrors(allErrors);
      setAllowOverride(allErrors.length > 0);
      return allErrors;
    } finally {
      setValidating(false);
    }
  }, [drawBoundingBox, faceMatchThreshold, modelsLoaded, referenceDescriptor]);

  const resetValidation = useCallback(() => {
    setValidationErrors([]);
    setAllowOverride(false);
    setQualityAnalysis(null);
    setFaceAnalysis(null);
  }, []);

  const appendValidationToFormData = useCallback((formData) => {
    formData.append('faceValidationPassed', String(validationErrors.length === 0 || allowOverride));
    formData.append('faceCount', String(faceAnalysis?.faceCount ?? 0));
    formData.append('faceConfidence', String(faceAnalysis?.confidence ?? 0));
    formData.append('brightness', String(faceAnalysis?.brightness ?? 0));
    formData.append('sharpness', String(faceAnalysis?.sharpness ?? 0));
    formData.append('faceDescriptor', JSON.stringify(faceAnalysis?.descriptor || []));
    formData.append('skipFaceMatch', String(!modelsLoaded || modelLoadFailed));
    return formData;
  }, [allowOverride, faceAnalysis, modelLoadFailed, modelsLoaded, validationErrors.length]);

  const canSubmitPhoto = useCallback((hasPhoto) => {
    if (!hasPhoto) return false;
    if (validationErrors.length > 0 && !allowOverride) return false;
    if (modelsLoaded && referenceDescriptor?.length > 0 && !faceAnalysis?.descriptor?.length) {
      return false;
    }
    return true;
  }, [allowOverride, faceAnalysis?.descriptor?.length, modelsLoaded, referenceDescriptor?.length, validationErrors.length]);

  return {
    modelsLoaded,
    modelLoadFailed,
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    resetValidation,
    appendValidationToFormData,
    canSubmitPhoto,
    imageRef,
    overlayRef,
    drawBoundingBox,
  };
};
