import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { instagramService } from '../services/instagramService';
import { useAuth } from '../context/AuthContext';
import { Instagram, AlertCircle } from 'lucide-react';

export const InstagramCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;

    if (!code) {
      setError('No authorization code received from Meta / Instagram.');
      return;
    }

    calledRef.current = true;

    const handleAuth = async () => {
      try {
        const targetRole = localStorage.getItem('oauth_role') || 'CREATOR';
        const res = await instagramService.login({ code, role: targetRole });
        localStorage.removeItem('oauth_role');
        await refreshUser();
        const role = res.role?.replace(/^ROLE_/, '').toUpperCase();
        if (role === 'MERCHANT') {
          navigate('/merchant/dashboard');
        } else {
          navigate('/creator/dashboard');
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message || 'Authentication failed.');
      }
    };

    handleAuth();
  }, [code, navigate, refreshUser]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Authentication Failed</h2>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white animate-pulse shadow-lg">
        <Instagram className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Connecting to Instagram...</h2>
      <p className="text-xs text-slate-500">Syncing your followers, biography, and creator media kit</p>
    </div>
  );
};

