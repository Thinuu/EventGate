import React from 'react';

const QRCodeDisplay = ({ value, size = 160 }) => (
  <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    {value ? (
      <img src={value} alt="QR Code" style={{ width: size, height: size }} />
    ) : (
      <div className="text-xs text-slate-400">QR not available</div>
    )}
  </div>
);

export default QRCodeDisplay;
