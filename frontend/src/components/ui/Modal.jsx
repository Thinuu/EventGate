import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ open, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return undefined;

    const body = document.body;
    const lockCount = Number(body.dataset.modalLockCount || '0');
    body.dataset.modalLockCount = String(lockCount + 1);

    if (lockCount === 0) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      body.dataset.modalScrollY = String(scrollY);
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    return () => {
      const nextCount = Math.max(Number(body.dataset.modalLockCount || '1') - 1, 0);
      body.dataset.modalLockCount = String(nextCount);

      if (nextCount === 0) {
        const scrollY = Number(body.dataset.modalScrollY || '0');
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.overflow = '';
        delete body.dataset.modalScrollY;
        window.scrollTo(0, scrollY);
      }
    };
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop – fixed so it always covers the full viewport even on long content */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`relative w-full ${sizes[size]} rounded-[28px] bg-white shadow-2xl animate-in fade-in zoom-in duration-200`}
        >
          {title && (
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          <div className="p-8">{children}</div>

          {footer && (
            <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;