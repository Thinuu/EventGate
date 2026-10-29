import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveShortLink } from '../../api/shortLinks';

const ShortLinkRedirectPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Resolving link...');

  useEffect(() => {
    resolveShortLink(code)
      .then((res) => {
        const targetPath = res.data?.data?.targetPath;
        if (targetPath) {
          navigate(targetPath, { replace: true });
        } else {
          setMessage('This short link is invalid.');
        }
      })
      .catch(() => setMessage('This short link is invalid or expired.'));
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
};

export default ShortLinkRedirectPage;