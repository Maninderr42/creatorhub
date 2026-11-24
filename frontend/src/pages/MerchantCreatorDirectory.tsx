import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreatorProfile, MerchantProfile } from '../types';
import { merchantService } from '../services/merchantService';
import { Search, MapPin, Instagram, Youtube, Users, Sparkles, Navigation, X, Check, Eye } from 'lucide-react';

const CATEGORIES = ['All', 'Food & Beverage', 'Fitness & Health', 'Tech & Gadgets', 'Fashion & Beauty', 'Travel & Lifestyle'];
const RADIUS_OPTIONS = [10, 25, 50];

export const MerchantCreatorDirectory: React.FC = () => {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [city, setCity] = useState('');
  const [minFollowers, setMinFollowers] = useState<string>('');
  const [search, setSearch] = useState('');

  // Proximity, Radius & Strict Filtering state
  const [activeBrandLocation, setActiveBrandLocation] = useState<string | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyOnly, setNearbyOnly] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(10); // 10 km default radius!
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // 1. Initial Load: Fetch Merchant Profile to determine brand's saved location
  useEffect(() => {
    const initLocationAndTalent = async () => {
      try {
        const profile = await merchantService.getProfile();
        setMerchantProfile(profile);

        if (profile.city && profile.city.trim() !== '') {
          const cleanCity = profile.city.trim();
          setActiveBrandLocation(cleanCity);
          setCity(cleanCity);
          setNearbyOnly(true);
          if (profile.latitude && profile.longitude) {
            setDeviceCoords({ lat: profile.latitude, lng: profile.longitude });
          }
          fetchCreators(cleanCity, profile.latitude && profile.longitude ? { lat: profile.latitude, lng: profile.longitude } : null, true, 10);
          return;
        }
      } catch (err) {
        console.warn('Could not load merchant profile for default proximity:', err);
      }
      fetchCreators();
    };

    initLocationAndTalent();
  }, []);

  // 2. Fetch Creators using proximity sorting & radius filtering
  const fetchCreators = async (
    overrideCity?: string,
    overrideCoords?: { lat: number; lng: number } | null,
    overrideNearbyOnly?: boolean,
    overrideRadius?: number
  ) => {
    setLoading(true);
    setLocationError(null);
    try {
      const cat = selectedCategory !== 'All' ? selectedCategory : undefined;
      const minF = minFollowers ? Number(minFollowers) : undefined;
      const queryCity = overrideCity !== undefined ? overrideCity : (city.trim() || undefined);
      const coords = overrideCoords !== undefined ? overrideCoords : deviceCoords;
      const isStrictNearby = overrideNearbyOnly !== undefined ? overrideNearbyOnly : nearbyOnly;
      const effectiveRadius = overrideRadius !== undefined ? overrideRadius : radiusKm;

      const data = await merchantService.searchCreators(
        cat,
        queryCity || undefined,
        minF,
        search || undefined,
        coords?.lat,
        coords?.lng,
        isStrictNearby,
        effectiveRadius
      );
      setCreators(data);
    } catch (err) {
      console.error('Failed to load creators:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (merchantProfile !== null || !loading) {
      fetchCreators(city.trim() || undefined, deviceCoords, nearbyOnly, radiusKm);
    }
  }, [selectedCategory, nearbyOnly, radiusKm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCity = city.trim();
    if (cleanCity) {
      setActiveBrandLocation(cleanCity);
      setNearbyOnly(true);
      fetchCreators(cleanCity, deviceCoords, true, radiusKm);
    } else {
      fetchCreators(undefined, deviceCoords, nearbyOnly, radiusKm);
    }
  };

  // 3. Real HTML5 GPS Geolocation handler with Reverse Geocoding
  const handleDetectDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setDeviceCoords(coords);

        let detectedCityName = 'My Location';
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          if (resp.ok) {
            const data = await resp.json();
            const resCity =
              data.address?.city ||
              data.address?.town ||
              data.address?.state_district ||
              data.address?.city_district ||
              data.address?.suburb ||
              data.address?.state ||
              '';
            if (resCity) {
              detectedCityName = resCity;
              setCity(resCity);
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding warning:', err);
        }

        setActiveBrandLocation(detectedCityName);
        setNearbyOnly(true);
        setLocating(false);
        fetchCreators(detectedCityName !== 'My Location' ? detectedCityName : undefined, coords, true, radiusKm);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationError('Could not detect location. Please type your city in the search box.');
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleShowAll = () => {
    setCity('');
    setActiveBrandLocation(null);
    setDeviceCoords(null);
    setNearbyOnly(false);
    fetchCreators('', null, false, 50);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Talent Discovery</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">Creator Directory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Showing creators within <strong className="text-brand-600">{radiusKm} km</strong> of your location by default.
        </p>
      </div>

      {/* Proximity / Location Banner */}
      {activeBrandLocation || city ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Hyper-Local Radius Match ({radiusKm} km)
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {nearbyOnly ? (
                  <>Showing creators within <strong className="text-emerald-800 underline">{radiusKm} km</strong> of <span className="text-emerald-900 font-bold">{activeBrandLocation || city}</span>.</>
                ) : (
                  <>Creators within <span className="text-emerald-800 font-bold">{radiusKm} km</span> of <span className="text-emerald-900 font-bold">{activeBrandLocation || city}</span> prioritized first.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Radius Selector Pills */}
            <div className="inline-flex items-center bg-white rounded-xl border border-emerald-200 p-1 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Radius:</span>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(r)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    radiusKm === r
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-900 hover:bg-emerald-50'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>

            <button
              onClick={() => setNearbyOnly(!nearbyOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center shadow-2xs ${
                nearbyOnly
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Check className={`w-3.5 h-3.5 mr-1 ${nearbyOnly ? 'opacity-100' : 'opacity-0'}`} />
              Strict Nearby Only
            </button>

            <button
              onClick={handleShowAll}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
            >
              Show All India
            </button>

            <button
              onClick={handleDetectDeviceLocation}
              disabled={locating}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-brand-600 rounded-xl shadow-sm transition-colors flex items-center"
            >
              <Navigation className="w-3.5 h-3.5 mr-1" />
              {locating ? 'GPS...' : 'Detect GPS'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">10 km Local Proximity Match</div>
              <p className="text-xs text-slate-600">
                Filter by your city or click below to detect your current location and discover creators within 10 km.
              </p>
            </div>
          </div>
          <button
            onClick={handleDetectDeviceLocation}
            disabled={locating}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-brand-600 rounded-xl shadow-sm transition-colors flex items-center flex-shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 mr-1.5" />
            {locating ? 'Detecting Location...' : 'Detect My Location (10 km)'}
          </button>
        </div>
      )}

      {locationError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
          {locationError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search creator name, bio, or niche..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Filter by City (e.g. Bengaluru, Mumbai)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
            {city && (
              <button
                type="button"
                onClick={() => {
                  setCity('');
                  fetchCreators('', deviceCoords, false, radiusKm);
                }}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
          >
            Filter Talent
          </button>
        </form>

        {/* Category Pills & Strict Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {(city || activeBrandLocation) && (
            <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={nearbyOnly}
                onChange={(e) => setNearbyOnly(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span>Only show within {radiusKm} km of {city || activeBrandLocation}</span>
            </label>
          )}
        </div>
      </div>

      {/* Creators Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : creators.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {city || activeBrandLocation
              ? `No creators found within ${radiusKm} km of ${city || activeBrandLocation}`
              : 'No creators found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {nearbyOnly
              ? `There are currently no creators registered within ${radiusKm} km of "${city || activeBrandLocation}". You can expand your radius to 25 km or 50 km to find creators across your metro area.`
              : 'Try broadening your search or selecting another category.'}
          </p>

          <div className="flex flex-wrap justify-center items-center gap-3 pt-2">
            {radiusKm === 10 && (
              <button
                type="button"
                onClick={() => setRadiusKm(25)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Expand Radius to 25 km
              </button>
            )}
            {radiusKm === 25 && (
              <button
                type="button"
                onClick={() => setRadiusKm(50)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Expand Radius to 50 km
              </button>
            )}
            <button
              type="button"
              onClick={handleShowAll}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-colors shadow-sm"
            >
              Browse All Across India
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {creators.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition-all flex flex-col justify-between ${
                c.isNearby
                  ? 'border-emerald-300 ring-2 ring-emerald-500/10 shadow-md hover:border-emerald-400'
                  : 'border-slate-200 hover:border-brand-200 hover:shadow-lg'
              }`}
            >
              <div>
                {/* Nearby Badge if local to brand */}
                {c.isNearby && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
                      Nearby Creator {c.distanceKm !== undefined && c.distanceKm !== null ? `(${c.distanceKm} km away)` : (c.city ? `• ${c.city}` : '')}
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-4 mb-4">
                  <img
                    src={c.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={c.displayName}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-brand-100 shadow-sm flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 truncate">{c.displayName}</h3>
                    <p className="text-xs text-slate-500 flex items-center mt-0.5 truncate">
                      <MapPin className="w-3 h-3 mr-1 text-slate-400 flex-shrink-0" /> {c.city || 'Location flexible'}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[11px] font-semibold">
                      {(c.totalFollowers || 0).toLocaleString()} Total Audience
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                  {c.bio || 'Creator profile available for sponsorship and custom brand deals.'}
                </p>

                {/* Social Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  {c.instagramHandle && (
                    <div className="flex items-center justify-between col-span-2 text-slate-700">
                      <div className="flex items-center space-x-1 truncate">
                        <Instagram className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                        <span className="truncate font-medium">@{c.instagramHandle}</span>
                      </div>
                      {c.isInstagramVerified ? (
                        <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 flex-shrink-0">
                          Self-reported
                        </span>
                      )}
                    </div>
                  )}
                  {c.youtubeHandle && (
                    <div className="flex items-center space-x-1 text-slate-700">
                      <Youtube className="w-3.5 h-3.5 text-red-600" />
                      <span className="truncate">{c.youtubeHandle}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">Base Rate</span>
                  <span className="text-base font-bold text-slate-900">₹{(c.baseRate || 0).toLocaleString()}</span>
                </div>
                <Link
                  to={`/merchant/creators/${c.userId}`}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-brand-600 rounded-xl transition-all shadow-sm flex items-center hover:scale-[1.02]"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
