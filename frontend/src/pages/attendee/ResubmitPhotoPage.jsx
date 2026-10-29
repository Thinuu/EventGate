import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { resubmitPhoto } from '../../api/photoVerification';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';

const ResubmitPhotoPage = () => {
  const { token } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a photo');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await resubmitPhoto(token, formData);
      toast.success('Photo resubmitted successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resubmit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Resubmit Photo</h1>
        <p className="text-sm text-slate-500 mt-2">Please upload a clear photo for verification.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          <Button type="submit" loading={loading}>Upload Photo</Button>
        </form>
        <div className="mt-4">
          <Link to="/dashboard" className="text-sm text-teal-600 hover:text-teal-700">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default ResubmitPhotoPage;
