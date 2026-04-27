import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Clock, Star, CheckCircle2, AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { ShopInquiry } from '../types';
import { toast } from 'sonner';
import ChatModal from './ChatModal';
import { cn } from '../lib/utils';
import SEO from './SEO';

interface UserDashboardProps {
  user: FirebaseUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const [inquiries, setInquiries] = useState<ShopInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<ShopInquiry | null>(null);
  const [reviewModalInquiry, setReviewModalInquiry] = useState<ShopInquiry | null>(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'inquiries'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShopInquiry[];
      setInquiries(records);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inquiries');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const submitReview = async () => {
    if (!reviewModalInquiry || !reviewModalInquiry.id || !user) return;
    
    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        shopId: reviewModalInquiry.shopId,
        userId: user.uid,
        inquiryId: reviewModalInquiry.id,
        rating: reviewData.rating,
        comment: reviewData.comment,
        createdAt: serverTimestamp(),
        userName: user.displayName || 'Anonymous User'
      });

      await updateDoc(doc(db, 'inquiries', reviewModalInquiry.id), {
        isReviewed: true
      });
      
      toast.success('Review submitted successfully!');
      setReviewModalInquiry(null);
      setReviewData({ rating: 5, comment: '' });
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const activeInquiries = inquiries.filter(i => i.status !== 'closed');
  const closedInquiries = inquiries.filter(i => i.status === 'closed');

  return (
    <div className="space-y-8">
      <SEO 
        title="My Dashboard" 
        description="Manage your vehicle diagnostics, shop inquiries, and repair history in your Engine Vitals dashboard."
      />
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            Your <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-[#A3A3A3] text-sm md:text-base max-w-2xl">
            Track your active shop inquiries and messages.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Inquiries */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Active Inquiries
              {activeInquiries.reduce((acc, curr) => acc + (curr.unreadCountUser || 0), 0) > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                  {activeInquiries.reduce((acc, curr) => acc + (curr.unreadCountUser || 0), 0)} new
                </span>
              )}
            </h2>
            
            {activeInquiries.length === 0 ? (
              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 border-dashed rounded-3xl p-8 text-center text-[#525252]">
                No active inquiries. Find a shop to get started!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeInquiries.map((inquiry) => (
                  <InquiryCard 
                    key={inquiry.id} 
                    inquiry={inquiry} 
                    onOpenChat={() => setActiveChat(inquiry)} 
                  />
                ))}
              </div>
            )}
          </section>

          {/* Past Inquiries */}
          {closedInquiries.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#525252]" /> Past Inquiries
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {closedInquiries.map((inquiry) => (
                  <InquiryCard 
                    key={inquiry.id} 
                    inquiry={inquiry} 
                    onOpenChat={() => setActiveChat(inquiry)}
                    onReview={() => setReviewModalInquiry(inquiry)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Chat Modal */}
      <AnimatePresence>
        {activeChat && (
          <ChatModal 
            inquiry={activeChat} 
            onClose={() => setActiveChat(null)} 
            isShop={false} 
          />
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewModalInquiry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewModalInquiry(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <h3 className="text-xl font-bold text-white mb-2">Leave a Review</h3>
              <p className="text-sm text-[#A3A3A3] mb-6">How was your experience with this shop?</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#525252] mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewData({ ...reviewData, rating: star })}
                        className={cn(
                          "p-2 rounded-xl transition-colors",
                          reviewData.rating >= star ? "text-yellow-500 bg-yellow-500/10" : "text-[#404040] hover:text-[#A3A3A3]"
                        )}
                      >
                        <Star className="w-6 h-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#525252] mb-2">Comment</label>
                  <textarea
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    placeholder="Tell others about your experience..."
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl p-3 text-sm text-white placeholder-[#404040] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none h-24"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setReviewModalInquiry(null)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-[#262626] hover:bg-[#333] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReview}
                    disabled={isSubmittingReview || !reviewData.comment.trim()}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-black bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingReview ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Submit'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InquiryCard({ inquiry, onOpenChat, onReview }: { inquiry: ShopInquiry, onOpenChat: () => void, onReview?: () => void }) {
  const date = inquiry.createdAt?.toDate() || new Date();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-5 space-y-4 hover:border-primary/30 transition-colors relative shadow-xl"
    >
      {inquiry.unreadCountUser ? (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-red-500/20">
          {inquiry.unreadCountUser}
        </div>
      ) : null}
      
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
              inquiry.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" :
              inquiry.status === 'responded' ? "bg-blue-500/10 text-blue-500" :
              "bg-[#262626] text-[#A3A3A3]"
            )}>
              {inquiry.status}
            </span>
            <span className="text-[10px] text-[#525252] flex items-center gap-1">
              <Clock className="w-3 h-3" /> {date.toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-white font-bold text-sm truncate max-w-[200px]">
            {inquiry.vehicleInfo ? `${inquiry.vehicleInfo.year} ${inquiry.vehicleInfo.make} ${inquiry.vehicleInfo.model}` : 'Vehicle Inquiry'}
          </h3>
        </div>
      </div>

      {inquiry.message && (
        <div className="bg-[#0A0A0A] rounded-xl p-3 border border-[#262626]">
          <p className="text-xs text-[#A3A3A3] line-clamp-2">"{inquiry.message}"</p>
        </div>
      )}

      {inquiry.appointment && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-bold text-white">Appointment {inquiry.appointment.status}</p>
            <p className="text-[10px] text-primary">{inquiry.appointment.date} at {inquiry.appointment.time}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-[#262626]">
        <button 
          onClick={onOpenChat}
          className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-3 h-3" /> Messages
        </button>
        
        <a 
          href={`/report/${inquiry.diagnosisId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 bg-[#262626] text-[#A3A3A3] hover:bg-[#333] hover:text-white py-2 rounded-lg transition-colors flex items-center justify-center"
          title="View Original Report"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        {inquiry.status === 'closed' && !inquiry.isReviewed && onReview && (
          <button 
            onClick={onReview}
            className="px-3 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 py-2 rounded-lg transition-colors flex items-center justify-center"
            title="Leave a Review"
          >
            <Star className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
