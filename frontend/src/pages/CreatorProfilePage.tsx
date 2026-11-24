import React, { useEffect, useState } from 'react';
import { creatorService } from '../services/creatorService';
import { instagramService } from '../services/instagramService';
import { CreatorProfile } from '../types';
import { User, MapPin, Instagram, Youtube, DollarSign, CheckCircle2, AlertCircle, Save, Navigation, ShieldCheck, Copy, Check } from 'lucide-react';

export const CreatorProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Partial<CreatorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [bioCode, setBioCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifyingBio, setVerifyingBio] = useState(false);
  const [bioSuccess, setBioSuccess] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const handleOpenBioModal = async () => {
    if (!profile.instagramHandle) {
      setError('Please enter your Instagram handle first.');
      return;
    }
    setBioError(null);
    setBioSuccess(null);
    try {
      const res = await instagramService.getBioCode();
      setBioCode(res.code);
      setShowBioModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate verification code');
    }
  };

  const handleVerifyBio = async () => {
    if (!profile.instagramHandle || !bioCode) return;
    setVerifyingBio(true);
    setBioError(null);
    try {
      const updated = await instagramService.verifyBioCode(
        profile.instagramHandle,
        bioCode,
        profile.instagramFollowers
      );
      setProfile((prev) => ({
        ...prev,
        ...updated,
        isInstagramVerified: true,
      }));
      setBioSuccess('Instagram verified successfully! Your real stats are now locked and trusted by brands.');
      setTimeout(() => {
        setShowBioModal(false);
        setBioSuccess(null);
      }, 2500);
    } catch (err: any) {
      setBioError(err.message || 'Verification could not be confirmed. Make sure the code is saved in your Instagram bio.');
    } finally {
      setVerifyingBio(false);
    }
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfile((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }));
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          .then((r) => r.json())
          .then((data) => {
            const detectedCity = data.address?.city || data.address?.town || data.address?.state_district || data.address?.suburb;
            if (detectedCity) {
              setProfile((prev) => ({ ...prev, city: detectedCity }));
            }
          })
          .catch(() => {})
          .finally(() => setDetectingLocation(false));
      },
      () => setDetectingLocation(false),
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await creatorService.getProfile();
        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await creatorService.updateProfile(profile);
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-12 px-4 animate-pulse"><div className="h-64 bg-slate-200 rounded-2xl" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-8 text-white">
          <h1 className="text-2xl font-black">Creator Profile & Media Kit</h1>
          <p className="text-xs text-white/80 mt-1">This information is shown to brands and merchants when discovering creators.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
              Profile updated successfully!
            </div>
          )}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Display / Public Name *
              </label>
              <input
                type="text"
                required
                value={profile.displayName || ''}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  City / Location *
                </label>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={detectingLocation}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center transition-colors disabled:opacity-50"
                >
                  <Navigation className="w-3 h-3 mr-1" />
                  {detectingLocation ? 'Detecting...' : 'Auto-Detect GPS'}
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Bengaluru, Mumbai, Delhi"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Profile Photo URL
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={profile.avatarUrl || ''}
              onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Bio & Pitch Summary
            </label>
            <textarea
              rows={3}
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Content Niches (comma separated)
            </label>
            <input
              type="text"
              placeholder="Food & Beverage, Lifestyle, Fitness, Tech"
              value={profile.categories || ''}
              onChange={(e) => setProfile({ ...profile, categories: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Social Stats */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>Social Media Handles & Followers</span>
                  {profile.isInstagramVerified ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Verified Instagram
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                      Self-Reported Stats
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified stats give your profile a green shield in search results and 3x more brand invites.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {!profile.isInstagramVerified && (
                  <button
                    type="button"
                    onClick={handleOpenBioModal}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl shadow-sm transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-700" />
                    Verify via Bio Code
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const url = await instagramService.getAuthUrl();
                      if (url) {
                        window.location.href = url;
                      } else {
                        setError('Instagram OAuth is not configured on the server.');
                      }
                    } catch (err: any) {
                      setError(err.message || 'Unable to start Instagram sync.');
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 rounded-xl shadow-sm transition-all"
                >
                  <Instagram className="w-3.5 h-3.5 mr-1" />
                  Meta OAuth Sync
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <Instagram className="w-3.5 h-3.5 mr-1 text-pink-600" /> Instagram Handle
                  </span>
                  {profile.isInstagramVerified && (
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Verified</span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={profile.instagramHandle || ''}
                  onChange={(e) => setProfile({ ...profile, instagramHandle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>Instagram Followers</span>
                  {profile.isInstagramVerified ? (
                    <span className="text-[10px] text-emerald-600 font-bold">Locked (Verified)</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-medium">Verify to lock</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={profile.isInstagramVerified}
                  value={profile.instagramFollowers || 0}
                  onChange={(e) => setProfile({ ...profile, instagramFollowers: Number(e.target.value) })}
                  className={`w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    profile.isInstagramVerified ? 'bg-slate-100 text-slate-700 cursor-not-allowed font-semibold' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center">
                  <Youtube className="w-3.5 h-3.5 mr-1 text-red-600" /> YouTube Channel
                </label>
                <input
                  type="text"
                  placeholder="channelName"
                  value={profile.youtubeHandle || ''}
                  onChange={(e) => setProfile({ ...profile, youtubeHandle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  YouTube Subscribers
                </label>
                <input
                  type="number"
                  min="0"
                  value={profile.youtubeSubscribers || 0}
                  onChange={(e) => setProfile({ ...profile, youtubeSubscribers: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Starting Pricing</h3>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Base Rate per Collaboration (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={profile.baseRate || 0}
                  onChange={(e) => setProfile({ ...profile, baseRate: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Bio Verification Modal */}
      {showBioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Verify Instagram Ownership</h3>
                <p className="text-xs text-slate-500">Prove you own @{profile.instagramHandle}</p>
              </div>
            </div>

            {bioSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600 flex-shrink-0" />
                {bioSuccess}
              </div>
            )}

            {bioError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-rose-600 flex-shrink-0" />
                {bioError}
              </div>
            )}

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <p className="font-semibold text-slate-800">Step 1: Copy this verification code</p>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 tracking-wider">
                    {bioCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(bioCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold flex items-center space-x-1 hover:bg-slate-800"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <p className="font-semibold text-slate-800">Step 2: Add it to your Instagram bio</p>
                <p className="text-slate-500 text-[11px]">
                  Open Instagram app &gt; Edit Profile &gt; Paste <strong>{bioCode}</strong> anywhere in your bio and click save. You can remove it right after verifying!
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBioModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={verifyingBio}
                  onClick={handleVerifyBio}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center"
                >
                  {verifyingBio ? 'Checking Bio...' : 'I Added Code — Verify Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

