import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Shop } from '../types';
import { motion } from 'motion/react';
import { MapPin, Phone, Globe, Star, Search, Loader2, ExternalLink, Mail, Filter, ChevronDown, X, Map as MapIcon, List, ShieldCheck, Store } from 'lucide-react';
import { cn } from '../lib/utils';
import AlternatingText from './AlternatingText';
import ShopDetailModal from './ShopDetailModal';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to generate deterministic coordinates for shops without lat/lng
const getCoordinates = (shop: Shop): [number, number] => {
  if (shop.lat && shop.lng) return [shop.lat, shop.lng];
  let hash = 0;
  for (let i = 0; i < shop.id.length; i++) {
    hash = shop.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = 39.8283 + (hash % 100) / 10;
  const lng = -98.5795 + ((hash >> 8) % 100) / 10;
  return [lat, lng];
};

// Helper to calculate distance in miles between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

import { User as FirebaseUser } from 'firebase/auth';

import SEO from './SEO';

interface ShopDirectoryProps {
  user: FirebaseUser | null;
  quoteDiagnosisId?: string | null;
  onClearQuote?: () => void;
}

export default function ShopDirectory({ user, quoteDiagnosisId, onClearQuote }: ShopDirectoryProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'distance'>('rating');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRequestQuote = async (shop: Shop) => {
    if (!user || !quoteDiagnosisId) return;
    try {
      const quoteRef = collection(db, 'quoteRequests');
      await addDoc(quoteRef, {
        userId: user.uid,
        shopId: shop.id,
        diagnosisId: quoteDiagnosisId,
        status: 'pending',
        createdAt: new Date(), // using Date since serverTimestamp needs to be imported
        userEmail: user.email,
        userName: user.displayName
      });
      toast.success(`Quote requested from ${shop.name}!`);
      if (onClearQuote) onClearQuote();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quoteRequests');
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log("Geolocation error:", error)
      );
    }
    const fetchShops = async () => {
      try {
        const q = query(collection(db, 'shops'), where('isPublic', '==', true));
        const querySnapshot = await getDocs(q);
        const shopsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
        setShops(shopsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'shops');
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  const allSpecialties = Array.from(new Set(shops.flatMap(s => s.specialties || []))).sort();
  const allCities = Array.from(new Set(shops.map(s => s.city).filter(Boolean))).sort();

  const toggleSpecialty = (spec: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const filteredShops = shops
    .filter(shop => {
      const matchesSearch = shop.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                          shop.address?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesCity = !selectedCity || shop.city === selectedCity;
      const matchesSpecialties = selectedSpecialties.length === 0 || 
                                selectedSpecialties.every(spec => shop.specialties?.includes(spec));
      const matchesSpecialtyFilter = !specialtyFilter || shop.specialties?.some(spec => spec.toLowerCase().includes(specialtyFilter.toLowerCase()));
      return matchesSearch && matchesCity && matchesSpecialties && matchesSpecialtyFilter;
    })
    .sort((a, b) => {
      // Premium shops always come first
      if (a.isPremium && !b.isPremium) return -1;
      if (!a.isPremium && b.isPremium) return 1;

      if (sortBy === 'distance' && userLocation) {
        const [latA, lngA] = getCoordinates(a);
        const [latB, lngB] = getCoordinates(b);
        const distA = calculateDistance(userLocation.lat, userLocation.lng, latA, lngA);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, latB, lngB);
        return distA - distB;
      }
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return a.name.localeCompare(b.name);
    });

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": filteredShops.map((shop, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "AutoRepair",
        "name": shop.name,
        "url": `https://enginevitals.com/shop/${shop.id}`,
        "telephone": shop.phone,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": shop.address,
          "addressLocality": shop.city,
          "addressRegion": shop.state,
          "postalCode": shop.zip,
          "addressCountry": "US"
        }
      }
    }))
  };

  return (
    <div className="space-y-8">
      <SEO 
        title="Find Local Auto Repair Shops" 
        description="Browse our certified network of local auto repair shops. Find trusted mechanics, read reviews, and request quotes directly from Engine Vitals."
        schemaMarkup={schemaMarkup}
      />
      {quoteDiagnosisId && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Request a Quote</h3>
              <p className="text-[#A3A3A3] text-sm">Select a shop below to send your recent diagnosis and request a quote.</p>
            </div>
          </div>
          {onClearQuote && (
            <button 
              onClick={onClearQuote}
              className="text-[#A3A3A3] hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#262626]"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              <AlternatingText text="Certified Repair Network" />
            </h2>
            <p className="text-[#A3A3A3]">
              Find trusted local shops to handle your repairs
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
              <input 
                type="text"
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="relative flex-1 md:w-64 hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
              <input 
                type="text"
                placeholder="Filter by specialty (e.g. Brakes)..."
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="relative hidden sm:block">
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252] pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'rating' | 'distance')}
                className="bg-[#0A0A0A] border border-[#262626] rounded-2xl py-3 pl-6 pr-10 text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] appearance-none focus:outline-none focus:border-primary/50 transition-all hover:text-white"
              >
                <option value="rating">Sort: Rating</option>
                {userLocation && <option value="distance">Sort: Distance</option>}
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "p-3 rounded-2xl border transition-all flex items-center gap-2 text-sm font-bold uppercase tracking-widest",
                isFilterOpen || selectedSpecialties.length > 0 || selectedCity 
                  ? "bg-primary/10 border-primary/30 text-primary" 
                  : "bg-[#0A0A0A] border-[#262626] text-[#A3A3A3] hover:text-white"
              )}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {(selectedSpecialties.length > 0 || selectedCity) && (
                <span className="w-5 h-5 rounded-full bg-primary text-black flex items-center justify-center text-[10px]">
                  {(selectedSpecialties.length > 0 ? 1 : 0) + (selectedCity ? 1 : 0)}
                </span>
              )}
            </button>

            <div className="flex bg-[#0A0A0A] border border-[#262626] rounded-2xl p-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  viewMode === 'list' ? "bg-[#262626] text-white" : "text-[#525252] hover:text-white"
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  viewMode === 'map' ? "bg-[#262626] text-white" : "text-[#525252] hover:text-white"
                )}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(selectedSpecialties.length > 0 || selectedCity) && (
          <div className="flex flex-wrap gap-2">
            {selectedCity && (
              <button 
                onClick={() => setSelectedCity('')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
              >
                City: {selectedCity}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedSpecialties.map(spec => (
              <button 
                key={spec}
                onClick={() => toggleSpecialty(spec)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
              >
                {spec}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button 
              onClick={() => {
                setSelectedSpecialties([]);
                setSelectedCity('');
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-[#525252] hover:text-white transition-colors ml-2"
            >
              Clear All
            </button>
          </div>
        )}

        {isFilterOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-[#0A0A0A] border border-[#262626] rounded-3xl p-6 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Specialties Filter */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Specialties</h4>
                  {allSpecialties.length > 6 && (
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#525252]" />
                      <input 
                        type="text"
                        placeholder="Search..."
                        value={specialtySearch}
                        onChange={(e) => setSpecialtySearch(e.target.value)}
                        className="bg-[#141414] border border-[#262626] rounded-lg py-1 pl-7 pr-2 text-[10px] text-white focus:outline-none focus:border-primary/50 w-24 md:w-32"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 md:max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {allSpecialties
                    .filter(spec => spec.toLowerCase().includes(specialtySearch.toLowerCase()))
                    .map(spec => (
                      <button
                        key={spec}
                        onClick={() => toggleSpecialty(spec)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                          selectedSpecialties.includes(spec)
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-[#141414] border-[#262626] text-[#525252] hover:text-[#A3A3A3]"
                        )}
                      >
                        {spec}
                      </button>
                    ))}
                </div>
              </div>

              {/* City Filter */}
              <div className="space-y-3 md:space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Location</h4>
                <div className="relative">
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252] pointer-events-none" />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl py-2.5 pl-4 pr-10 text-xs text-white appearance-none focus:outline-none focus:border-primary/50"
                  >
                    <option value="">All Cities</option>
                    {allCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {(selectedSpecialties.length > 0 || selectedCity) && (
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[#1A1A1A] flex justify-end">
                <button 
                  onClick={() => {
                    setSelectedSpecialties([]);
                    setSelectedCity('');
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#525252] hover:text-primary flex items-center gap-2 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear All Filters
                </button>
              </div>
            )}
          </motion.div>
        )}
      </header>

      {loading ? (
        viewMode === 'map' ? (
          <div className="h-[600px] w-full rounded-3xl overflow-hidden border border-[#262626] relative z-0 bg-[#0A0A0A] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-[#525252]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-bold uppercase tracking-widest">Loading Map Data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-4 animate-pulse shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="w-32 h-6 bg-[#262626] rounded-lg"></div>
                    <div className="w-24 h-4 bg-[#262626] rounded-lg"></div>
                  </div>
                  <div className="w-12 h-12 bg-[#262626] rounded-xl"></div>
                </div>
                <div className="space-y-2 pt-4">
                  <div className="w-full h-4 bg-[#262626] rounded-lg"></div>
                  <div className="w-3/4 h-4 bg-[#262626] rounded-lg"></div>
                </div>
                <div className="pt-4 flex gap-2">
                  <div className="w-16 h-8 bg-[#262626] rounded-lg"></div>
                  <div className="w-16 h-8 bg-[#262626] rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredShops.length === 0 ? (
        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-12 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center text-[#525252] mx-auto mb-6 shadow-inner">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No shops found</h3>
          <p className="text-[#525252] max-w-md mx-auto">
            Try adjusting your search terms or check back later as more shops join our network.
          </p>
        </div>
      ) : viewMode === 'map' ? (
        <div className="h-[600px] w-full rounded-3xl overflow-hidden border border-[#262626] relative z-0">
          <MapContainer 
            center={[39.8283, -98.5795]} 
            zoom={4} 
            style={{ height: '100%', width: '100%', backgroundColor: '#0A0A0A' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {filteredShops.map(shop => {
              const [lat, lng] = getCoordinates(shop);
              return (
                <Marker key={shop.id} position={[lat, lng]}>
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-base mb-1">{shop.name}</h3>
                      <div className="flex items-center gap-1 text-primary mb-2">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs font-bold">{shop.rating ? shop.rating.toFixed(1) : 'New'}</span>
                      </div>
                      <p className="text-xs text-[#A3A3A3] mb-1">{shop.address}, {shop.city}</p>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.address}, ${shop.city}, ${shop.state} ${shop.zip}`)}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block w-full bg-primary text-black py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all text-center mb-2 flex items-center justify-center gap-1"
                      >
                        <MapPin className="w-3 h-3" /> Directions
                      </a>
                      {shop.phone && <p className="text-xs text-[#A3A3A3] mb-3">{shop.phone}</p>}
                      {shop.website && (
                        <a 
                          href={`https://${shop.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block w-full bg-[#141414] border border-[#262626] text-white py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#1A1A1A] transition-all text-center mb-2 flex items-center justify-center gap-1"
                        >
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                      <button 
                        onClick={() => setSelectedShop(shop)}
                        className="w-full bg-primary text-black py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all">
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop, i) => (
            <motion.div
              key={shop.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedShop(shop)}
              className={cn(
                "bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-4 sm:p-6 transition-all group relative overflow-hidden shadow-xl cursor-pointer",
                shop.isPremium ? "border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : "border-[#262626] hover:border-primary/30"
              )}
            >
              {shop.isPremium && (
                <div className="absolute top-0 right-0 bg-primary text-black text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                  Featured
                </div>
              )}
              <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Star className="w-16 h-16 sm:w-24 sm:h-24 text-primary" />
              </div>

              <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {shop.logoUrl ? (
                    <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-contain p-1.5 sm:p-2" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-xl sm:text-2xl font-bold text-[#262626]">{shop.name[0]}</div>
                  )}
                </div>
                <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors">{shop.name}</h3>
                        {shop.isVerified && (
                          <div className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full" title="Verified by AutoAI">
                            <ShieldCheck className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                  <div className="flex flex-wrap items-center gap-1 text-primary">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, index) => (
                        <Star 
                          key={index} 
                          className={cn(
                            "w-3 h-3",
                            index < Math.floor(shop.rating || 0) ? "fill-current" : "text-[#262626]"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest ml-1 text-[#525252]">
                      {shop.rating ? `${shop.rating.toFixed(1)} Rating` : 'No Rating'} {shop.reviewCount !== undefined ? `(${shop.reviewCount})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {shop.address && (
                  <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#525252] flex-shrink-0 mt-0.5" />
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.address}, ${shop.city}, ${shop.state} ${shop.zip}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#A3A3A3] hover:text-primary transition-colors flex items-center gap-1 group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shop.address}, {shop.city}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                )}
                {shop.phone && (
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#525252] flex-shrink-0" />
                    <span className="text-[#A3A3A3]">{shop.phone}</span>
                  </div>
                )}
                {shop.email && (
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#525252] flex-shrink-0" />
                    <span className="text-[#A3A3A3] line-clamp-1">{shop.email}</span>
                  </div>
                )}
              </div>

              {shop.specialties && shop.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6 sm:mb-8">
                  {shop.specialties.slice(0, 3).map(spec => (
                    <span key={spec} className="px-2 py-0.5 rounded-md bg-[#141414] border border-[#262626] text-[10px] text-[#525252] font-medium">
                      {spec}
                    </span>
                  ))}
                  {shop.specialties.length > 3 && (
                    <span className="text-[10px] text-[#262626] font-bold">+{shop.specialties.length - 3}</span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {quoteDiagnosisId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestQuote(shop);
                    }}
                    className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Store className="w-3 h-3" /> Request Quote
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <ShopDetailModal 
        shop={selectedShop} 
        isOpen={!!selectedShop} 
        onClose={() => setSelectedShop(null)} 
        user={user}
      />
    </div>
  );
}
