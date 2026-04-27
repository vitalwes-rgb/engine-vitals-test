import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inbox, Clock, Mail, ExternalLink, CheckCircle2, MessageSquare, Phone, MapPin, Calendar, Wrench, ChevronRight, Star } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { ShopInquiry } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import ChatModal from './ChatModal';

interface ShopDashboardProps {
  user: FirebaseUser | null;
}

export default function ShopDashboard({ user }: ShopDashboardProps) {
  const [inquiries, setInquiries] = useState<ShopInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeChat, setActiveChat] = useState<ShopInquiry | null>(null);

  useEffect(() => {
    const fetchInquiries = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // First, check if the user is an employee
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const shopId = userData?.shopId || user.uid;

        const q = query(collection(db, 'inquiries'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const inquiriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShopInquiry));
        setInquiries(inquiriesData);
        
        // Check if shop is premium
        const shopDocData = await getDoc(doc(db, 'shops', shopId));
        if (shopDocData.exists()) {
          setIsPremium(shopDocData.data().isPremium || false);
        }
      } catch (err) {
        console.error('Failed to fetch inquiries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInquiries();
  }, [user]);

  const handleInquiryStatus = async (inquiryId: string, status: 'pending' | 'responded' | 'closed') => {
    try {
      await updateDoc(doc(db, 'inquiries', inquiryId), { status });
      setInquiries(inquiries.map(i => i.id === inquiryId ? { ...i, status } : i));
      toast.success(`Inquiry marked as ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inquiries/${inquiryId}`);
    }
  };

  const pendingInquiries = inquiries.filter(i => i.status === 'pending');
  const respondedInquiries = inquiries.filter(i => i.status === 'responded');
  const closedInquiries = inquiries.filter(i => i.status === 'closed');

  const handleUpgradePremium = async () => {
    if (!user) return;
    try {
      // In a real app, this would redirect to Stripe Checkout
      // For this demo, we'll just update the Firestore document
      await updateDoc(doc(db, 'shops', user.uid), { isPremium: true });
      setIsPremium(true);
      setShowPremiumModal(false);
      toast.success('Successfully upgraded to Premium!');
    } catch (err) {
      toast.error('Failed to upgrade. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Shop Dashboard
            {isPremium && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> Premium
              </span>
            )}
          </h2>
          <p className="text-[#A3A3A3]">Manage your leads and diagnostic reports.</p>
        </div>
        {!isPremium && (
          <button 
            onClick={() => setShowPremiumModal(true)}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
          >
            <Star className="w-4 h-4 fill-current" /> Upgrade to Premium
          </button>
        )}
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <Inbox className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#A3A3A3]">New Leads</h3>
          </div>
          <p className="text-4xl font-black text-white">{pendingInquiries.length}</p>
        </div>
        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#A3A3A3]">In Progress</h3>
          </div>
          <p className="text-4xl font-black text-white">{respondedInquiries.length}</p>
        </div>
        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#A3A3A3]">Completed</h3>
          </div>
          <p className="text-4xl font-black text-white">{closedInquiries.length}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Column */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-yellow-500 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" /> Pending ({pendingInquiries.length})
            {pendingInquiries.reduce((acc, curr) => acc + (curr.unreadCountShop || 0), 0) > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-auto">
                {pendingInquiries.reduce((acc, curr) => acc + (curr.unreadCountShop || 0), 0)} new
              </span>
            )}
          </h3>
          <div className="space-y-4">
            {pendingInquiries.map(inquiry => (
              <InquiryCard 
                key={inquiry.id} 
                inquiry={inquiry} 
                onStatusChange={handleInquiryStatus} 
                onOpenChat={() => setActiveChat(inquiry)}
              />
            ))}
            {pendingInquiries.length === 0 && (
              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 border-dashed rounded-3xl p-8 text-center text-[#525252] shadow-inner">
                No pending inquiries
              </div>
            )}
          </div>
        </div>

        {/* Responded Column */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-blue-500 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Responded ({respondedInquiries.length})
            {respondedInquiries.reduce((acc, curr) => acc + (curr.unreadCountShop || 0), 0) > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-auto">
                {respondedInquiries.reduce((acc, curr) => acc + (curr.unreadCountShop || 0), 0)} new
              </span>
            )}
          </h3>
          <div className="space-y-4">
            {respondedInquiries.map(inquiry => (
              <InquiryCard 
                key={inquiry.id} 
                inquiry={inquiry} 
                onStatusChange={handleInquiryStatus} 
                onOpenChat={() => setActiveChat(inquiry)}
              />
            ))}
            {respondedInquiries.length === 0 && (
              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 border-dashed rounded-3xl p-8 text-center text-[#525252] shadow-inner">
                No active conversations
              </div>
            )}
          </div>
        </div>

        {/* Closed Column */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" /> Closed ({closedInquiries.length})
          </h3>
          <div className="space-y-4">
            {closedInquiries.map(inquiry => (
              <InquiryCard 
                key={inquiry.id} 
                inquiry={inquiry} 
                onStatusChange={handleInquiryStatus} 
                onOpenChat={() => setActiveChat(inquiry)}
              />
            ))}
            {closedInquiries.length === 0 && (
              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 border-dashed rounded-3xl p-8 text-center text-[#525252] shadow-inner">
                No closed inquiries
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      <AnimatePresence>
        {activeChat && (
          <ChatModal 
            inquiry={activeChat} 
            onClose={() => setActiveChat(null)} 
            isShop={true} 
          />
        )}
      </AnimatePresence>

      {/* Premium Upgrade Modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPremiumModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mx-auto">
                <Star className="w-8 h-8 fill-current" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">AutoAI Premium Shop</h3>
                <p className="text-[#A3A3A3]">Get more leads and stand out from the competition.</p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white">
                  <CheckCircle2 className="w-5 h-5 text-primary" /> Featured placement in Shop Directory
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                  <CheckCircle2 className="w-5 h-5 text-primary" /> "Premium" badge on your profile
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                  <CheckCircle2 className="w-5 h-5 text-primary" /> Priority customer support
                </li>
              </ul>
              <div className="pt-6 border-t border-[#262626]">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-white font-bold">Monthly Subscription</span>
                  <span className="text-2xl font-black text-white">$49<span className="text-sm text-[#A3A3A3] font-normal">/mo</span></span>
                </div>
                <button 
                  onClick={handleUpgradePremium}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  Subscribe with Stripe
                </button>
                <p className="text-center text-[10px] text-[#525252] mt-4">
                  This is a demo. No actual payment will be processed.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InquiryCard({ inquiry, onStatusChange, onOpenChat }: { inquiry: ShopInquiry, onStatusChange: (id: string, status: 'pending' | 'responded' | 'closed') => void, onOpenChat: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-5 space-y-4 hover:border-primary/30 transition-colors relative shadow-xl"
    >
      {inquiry.unreadCountShop ? (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-red-500/20">
          {inquiry.unreadCountShop}
        </div>
      ) : null}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-white font-bold text-xs">
            {inquiry.userId.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold text-sm">Customer Lead</p>
            <p className="text-[10px] text-[#525252]">{inquiry.createdAt?.toDate().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onOpenChat}
            className="p-2 bg-[#262626] rounded-lg text-[#A3A3A3] hover:text-white hover:bg-primary/20 hover:text-primary transition-all"
            title="Message Customer"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <a 
            href={`/report/${inquiry.diagnosisId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-white transition-colors p-2 bg-primary/10 rounded-lg"
            title="View Diagnostic Report"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {inquiry.message && (
        <div className="bg-[#0A0A0A] rounded-xl p-3 border border-[#262626]">
          <p className="text-xs text-[#A3A3A3] italic">"{inquiry.message}"</p>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-[#262626]">
        {inquiry.status === 'pending' && (
          <>
            <button 
              onClick={() => onStatusChange(inquiry.id, 'responded')}
              className="flex-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Mark Responded
            </button>
            <button 
              onClick={() => onStatusChange(inquiry.id, 'closed')}
              className="flex-1 bg-[#262626] text-[#A3A3A3] hover:bg-[#333] hover:text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Close
            </button>
          </>
        )}
        {inquiry.status === 'responded' && (
          <>
            <button 
              onClick={() => onStatusChange(inquiry.id, 'closed')}
              className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Mark Completed
            </button>
          </>
        )}
        {inquiry.status === 'closed' && (
          <button 
            onClick={() => onStatusChange(inquiry.id, 'responded')}
            className="flex-1 bg-[#262626] text-[#A3A3A3] hover:bg-[#333] hover:text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            Reopen
          </button>
        )}
      </div>
    </motion.div>
  );
}
