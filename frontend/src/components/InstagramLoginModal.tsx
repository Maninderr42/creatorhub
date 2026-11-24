import React, { useState, useEffect } from 'react';
import { instagramService, InstagramAuthUrlResponse } from '../services/instagramService';
import { X, Instagram, ShieldCheck, AlertCircle, ExternalLink } from 'lucide-react';

interface InstagramLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstagramLoginModal: React.FC<InstagramLoginModalProps> = ({ isOpen, onClose }) => {
  const [authConfig, setAuthConfig] = useState<InstagramAuthUrlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      instagramService.getAuthConfig()
        .then((config) => setAuthConfig(config))
        .catch((err) => setError(err.message || 'Unable to load Instagram OAuth configuration from server.'))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDirectInstagram = authConfig?.provider === 'instagram';
  const isMeta = authConfig?.provider === 'meta';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Instagram className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sign in with Instagram</h2>
            <p className="text-xs text-slate-500">Live OAuth sync — fetches your real profile directly from Meta</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">
            Loading live OAuth configuration...
          </div>
        ) : authConfig?.url ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="flex items-center space-x-2 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {isDirectInstagram
                    ? 'Direct Instagram Business Login Active'
                    : 'Meta OAuth Active'}
                </span>
              </div>
              {isDirectInstagram ? (
                <p>
                  Redirects to Instagram.com to authenticate your Creator/Business account and automatically import your live <strong>@handle, real follower count, bio, and profile photo</strong>.
                </p>
              ) : (
                <p>
                  Authenticates via Meta OAuth to import your live profile name and photo. To automatically fetch live <strong>Instagram follower count &amp; @handle</strong> during login, configure <code>INSTAGRAM_APP_ID</code> and <code>INSTAGRAM_APP_SECRET</code> from Meta&apos;s <em>Instagram API with Instagram Login</em> product.
                </p>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
              <p className="font-bold flex items-center">
                <span>ℹ️ Note: Requires Instagram Creator or Business Account</span>
              </p>
              <p>
                Meta only authorizes live follower metrics for Professional (Creator/Business) accounts connected to your Facebook/Meta profile.
              </p>
            </div>

            <a
              href={authConfig.url}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Instagram className="w-5 h-5" />
              <span>
                {isDirectInstagram
                  ? 'Continue with Instagram'
                  : isMeta
                  ? 'Continue with Meta'
                  : 'Authorize with Instagram'}
              </span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-2">
            <p className="font-bold">Instagram OAuth Not Configured</p>
            <p>
              Set <code>INSTAGRAM_APP_ID</code> and <code>INSTAGRAM_APP_SECRET</code> in the backend environment to enable live Instagram login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
