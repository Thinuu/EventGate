import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';

const QRCodeDisplay = ({ value, size = 200, className = '' }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  React.useEffect(() => {
    if (value) {
      generateQRCode(value);
    }
  }, [value, size]);

  const generateQRCode = async (text) => {
    try {
      setError(null);
      
      if (text.startsWith('data:image')) {
        setQrCodeUrl(text);
        return;
      }

      // Generate QR Code as data URL
      const qrDataUrl = await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrCodeUrl(qrDataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code');
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `qr-code-${Date.now()}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ width: size, height: size }}>
        <div className="text-center">
          <div className="text-red-500 text-sm mb-2">QR Code Error</div>
          <div className="text-gray-500 text-xs">{error}</div>
        </div>
      </div>
    );
  }

  if (!qrCodeUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg animate-pulse ${className}`} style={{ width: size, height: size }}>
        <div className="text-gray-400 text-sm">Generating...</div>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* QR Code Image */}
      <img 
        src={qrCodeUrl} 
        alt="QR Code" 
        className="rounded-lg shadow-sm"
        style={{ width: size, height: size }}
      />
      
      {/* Hidden canvas for download functionality */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Download button (shown on hover) */}
      <button
        onClick={downloadQRCode}
        className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full p-2 opacity-0 hover:opacity-100 transition-opacity shadow-sm"
        title="Download QR Code"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
};

export default QRCodeDisplay;
