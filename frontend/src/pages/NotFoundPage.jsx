import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';

const NotFoundPage = () => (
  <PublicLayout>
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <h1 className="text-8xl font-bold text-gray-200 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
      <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700">Go Home</Link>
    </div>
  </PublicLayout>
);

export default NotFoundPage;
