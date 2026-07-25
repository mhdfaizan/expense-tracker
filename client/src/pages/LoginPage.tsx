import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import GoogleButton from '../components/GoogleButton';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'access_denied') {
      setDenied(true);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { url } = await api.getAuthUrl();
      window.location.href = url;
    } catch {
      setLoading(false);
      alert('Failed to connect. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="mb-6">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">$</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Tracker</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Track your daily expenses seamlessly with Google Sheets
          </p>
        </div>
        <GoogleButton onClick={handleConnect} loading={loading} />
        {denied && (
          <p className="text-xs text-red-500 mt-3">
            Access was denied. Both permissions are required to use the app.
          </p>
        )}
        <p className="text-xs text-gray-400 mt-4">
          Your data is stored in your own Google Drive
        </p>
      </div>
    </div>
  );
}
