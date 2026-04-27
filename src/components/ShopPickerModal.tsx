import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Phone, Mail, Star, Search, Send, Loader2, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Shop, ShopInquiry } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { cn, calculateDistance } from '../lib/utils';
import { toast } from 'sonner';

interface ShopPickerModalProps {
  diagnosisId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShopPickerModal({ diagnosisId, userId, isOpen, onClose }: ShopPickerModalProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchShops = async (userLat?: number, userLng?: number) => {
      try {
        const q = query(collection(db, 'shops'), where('isPublic', '==', true));
        const querySnapshot = await getDocs(q);
        const shopsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
        
        // Add random score for rotation among tied verified shops
        const shopsWithRandom = shopsData.map(shop => ({
          ...shop,
          _rand: Math.random()
        }));

        shopsWithRandom.sort((a, b) => {
          let distA = 0, distB = 0;
          if (userLat && userLng) {
            distA = a.lat && a.lng ? calculateDistance(userLat, userLng, a.lat, a.lng) : 9999;
            distB = b.lat && b.lng ? calculateDistance(userLat, userLng, b.lat, b.lng) : 9999;
            
            // If one is significantly closer (>25 miles diff), prefer the closer one
            if (Math.abs(distA - distB) > 25) {
                return distA - distB;
            }
          }

          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          
          // Rotate equally ranked verified shops using random score
          if (a.isVerified && b.isVerified) {
             return b._rand - a._rand;
          }

          return (b.rating || 0) - (a.rating || 0);
        });
        
        setShops(shopsWithRandom);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'shops');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetchShops(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            fetchShops(); // fallback if denied
          }
        );
      } else {
        fetchShops();
      }
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!selectedShop) return;
    
    setIsSending(true);
    try {
      const inquiry: Omit<ShopInquiry, 'id'> = {
        shopId: selectedShop.id,
        userId,
        diagnosisId,
        status: 'pending',
        createdAt: Timestamp.now(),
        message: message || `Hi, I have a diagnostic report for my vehicle. Please review it and let me know if you can help.`
      };

      await addDoc(collection(db, 'inquiries'), inquiry);
      setIsSuccess(true);
      toast.success(`Report sent to ${selectedShop.name}!`);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setSelectedShop(null);
        setMessage('');
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inquiries');
      toast.error('Failed to send report. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredShops = shops.filter(shop => 
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
    shop.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#262626] flex justify-between items-center bg-[#1A1A1A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Send Report to Shop</h2>
                  <p className="text-xs text-[#A3A3A3]">Share your diagnosis with a local professional.</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-[#262626] rounded-full text-[#525252] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center space-y-4"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Report Sent!</h3>
                  <p className="text-[#A3A3A3] max-w-xs">
                    {selectedShop?.name} has received your diagnostic report and will contact you soon.
                  </p>
                </motion.div>
              ) : selectedShop ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="bg-[#0A0A0A] p-6 rounded-2xl border border-[#262626] space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          {selectedShop.name}
                          {selectedShop.isVerified && (
                            <span className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full" title="Verified AutoAI Partner">
                              <ShieldCheck className="w-4 h-4" />
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-[#A3A3A3]">{selectedShop.address}, {selectedShop.city}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedShop(null)}
                        className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        Change Shop
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedShop.specialties.map((s, i) => (
                        <span key={i} className="text-[10px] font-bold uppercase tracking-widest bg-[#262626] text-[#A3A3A3] px-2 py-1 rounded-md">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Add a Message (Optional)</label>
                    <textarea 
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="e.g. Hi, I'm seeing a check engine light and my car is idling rough. Can you provide a quote for the recommended fixes?"
                      className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 text-white placeholder-[#404040] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all min-h-[120px]"
                    />
                  </div>

                  <button 
                    onClick={handleSend}
                    disabled={isSending}
                    className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" /> Sending Report...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" /> Send to {selectedShop.name}
                      </>
                    )}
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#404040]" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by shop name, specialty, or city..."
                      className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-4 text-white placeholder-[#404040] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[#525252]">
                      <Loader2 className="w-8 h-8 animate-spin mb-4" />
                      <p className="text-sm font-bold uppercase tracking-widest">Finding Local Shops...</p>
                    </div>
                  ) : filteredShops.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredShops.map((shop) => (
                        <motion.div 
                          key={shop.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectedShop(shop)}
                          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                                {shop.name}
                                {shop.isVerified && (
                                  <span className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full" title="Verified AutoAI Partner">
                                    <ShieldCheck className="w-3 h-3" />
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-[#A3A3A3] flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" /> {shop.city}, {shop.state}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-xs font-bold">{shop.rating}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-4">
                            {shop.specialties.slice(0, 3).map((s, i) => (
                              <span key={i} className="text-[10px] font-bold uppercase tracking-widest bg-[#262626] text-[#525252] px-2 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                            {shop.specialties.length > 3 && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252] px-1 py-0.5">
                                +{shop.specialties.length - 3} more
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
                            <div className="flex items-center gap-4 text-[#525252]">
                              <Phone className="w-3 h-3" />
                              <Mail className="w-3 h-3" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              Select Shop
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#525252]">
                      <p className="text-sm font-bold uppercase tracking-widest">No shops found matching your search.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
