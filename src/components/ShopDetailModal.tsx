import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Phone, Globe, Star, Clock, Info, ShieldCheck, MessageSquare, Send, ExternalLink } from 'lucide-react';
import { Shop, Review } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';

interface ShopDetailModalProps {
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
}

export default function ShopDetailModal({ shop, isOpen, onClose, user }: ShopDetailModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && shop) {
      fetchReviews();
    }
  }, [isOpen, shop]);

  const fetchReviews = async () => {
    if (!shop) return;
    setLoadingReviews(true);
    try {
      const q = query(collection(db, 'shops', shop.id, 'reviews'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewsData);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please log in to leave a review');
      return;
    }
    if (!newReviewText.trim()) {
      toast.error('Please write a review');
      return;
    }
    if (!shop) return;

    setIsSubmitting(true);
    try {
      const reviewData = {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        rating: newReviewRating,
        text: newReviewText,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'shops', shop.id, 'reviews'), reviewData);
      
      toast.success('Review submitted successfully!');
      setNewReviewText('');
      setNewReviewRating(5);
      fetchReviews();
      
      // Note: In a real app, you'd also trigger a Cloud Function to update the shop's average rating
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${shop.id}/reviews`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shop) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#262626] bg-[#0A0A0A]">
              <div className="flex items-center gap-4">
                {shop.logoUrl ? (
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                    <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center text-2xl font-bold">
                    {shop.name[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{shop.name}</h2>
                    {shop.isVerified && (
                      <div className="bg-blue-500/20 text-blue-400 p-1 rounded-full" title="Verified by AutoAI">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center text-primary">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="ml-1 font-bold">{shop.rating ? shop.rating.toFixed(1) : 'New'}</span>
                    </div>
                    <span className="text-[#525252]">•</span>
                    <span className="text-[#A3A3A3] text-sm">{reviews.length} reviews</span>
                    <span className="text-[#525252]">•</span>
                    <a href={`/shop/${shop.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                      View Public Profile <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-[#262626] rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-[#A3A3A3]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#525252]">Contact Info</h3>
                  <div className="space-y-3">
                    {shop.address && (
                      <div className="flex items-start gap-3 text-[#A3A3A3]">
                        <MapPin className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex flex-col items-start">
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.address}, ${shop.city}, ${shop.state} ${shop.zip}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors flex items-center gap-1 group"
                          >
                            <span>{shop.address}, {shop.city}, {shop.state} {shop.zip}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </div>
                      </div>
                    )}
                    {shop.phone && (
                      <div className="flex items-center gap-3 text-[#A3A3A3]">
                        <Phone className="w-5 h-5 text-primary shrink-0" />
                        <a href={`tel:${shop.phone}`} className="hover:text-white transition-colors">{shop.phone}</a>
                      </div>
                    )}
                    {shop.website && (
                      <div className="flex items-center gap-3 text-[#A3A3A3]">
                        <Globe className="w-5 h-5 text-primary shrink-0" />
                        <a href={`https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                          {shop.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {shop.hours && (
                      <div className="flex items-start gap-3 text-[#A3A3A3]">
                        <Clock className="w-5 h-5 text-primary shrink-0" />
                        <span className="whitespace-pre-line">{shop.hours}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#525252]">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {shop.specialties?.map(spec => (
                      <span key={spec} className="bg-[#262626] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* About */}
              {shop.about && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                    <Info className="w-4 h-4" /> About Us
                  </h3>
                  <p className="text-[#A3A3A3] leading-relaxed whitespace-pre-line">
                    {shop.about}
                  </p>
                </div>
              )}

              {/* Reviews Section */}
              <div className="space-y-6 pt-6 border-t border-[#262626]">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Customer Reviews
                </h3>

                {/* Write Review */}
                {user ? (
                  <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">Rate your experience:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setNewReviewRating(star)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star className={`w-5 h-5 ${star <= newReviewRating ? 'fill-primary text-primary' : 'text-[#262626]'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Share your experience with this shop..."
                      className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-white placeholder-[#525252] focus:border-primary outline-none resize-none h-24 text-sm"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmitting || !newReviewText.trim()}
                        className="bg-primary text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                      >
                        {isSubmitting ? 'Submitting...' : <><Send className="w-4 h-4" /> Post Review</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 text-center">
                    <p className="text-sm text-[#A3A3A3]">Please log in to leave a review.</p>
                  </div>
                )}

                {/* Reviews List */}
                <div className="space-y-4">
                  {loadingReviews ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 animate-pulse">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-24 h-4 bg-[#262626] rounded-md"></div>
                            <div className="w-16 h-3 bg-[#262626] rounded-md"></div>
                          </div>
                          <div className="flex gap-1 mb-3">
                            {[1, 2, 3, 4, 5].map(star => (
                              <div key={star} className="w-3 h-3 bg-[#262626] rounded-sm"></div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="w-full h-3 bg-[#262626] rounded-md"></div>
                            <div className="w-3/4 h-3 bg-[#262626] rounded-md"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : reviews.length > 0 ? (
                    reviews.map(review => (
                      <div key={review.id} className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white">{review.userName}</span>
                          <span className="text-xs text-[#525252]">
                            {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                        <div className="flex gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-primary text-primary' : 'text-[#262626]'}`} />
                          ))}
                        </div>
                        <p className="text-sm text-[#A3A3A3]">{review.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-[#525252]">
                      No reviews yet. Be the first to review {shop.name}!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
