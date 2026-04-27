import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Wrench, ChevronRight, Loader2, Users, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';

interface RoleSelectionModalProps {
  onSelectRole: (role: 'user' | 'mechanic', shopId?: string) => Promise<void>;
}

export default function RoleSelectionModal({ onSelectRole }: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<'user' | 'mechanic' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJoinShop, setShowJoinShop] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const handleContinue = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    try {
      await onSelectRole(selectedRole);
    } catch (error) {
      console.error("Failed to set role:", error);
      setIsSubmitting(false);
    }
  };

  const handleJoinShop = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const q = query(collection(db, 'shops'), where('inviteCode', '==', inviteCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error('Invalid invite code. Please check and try again.');
        setIsVerifyingCode(false);
        return;
      }

      const shopDoc = querySnapshot.docs[0];
      await onSelectRole('mechanic', shopDoc.id);
    } catch (error) {
      console.error('Error verifying invite code:', error);
      toast.error('Failed to verify invite code');
      setIsVerifyingCode(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8 md:p-12"
      >
        <AnimatePresence mode="wait">
          {!showJoinShop ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Welcome to <span className="text-primary">AutoAI</span></h2>
                <p className="text-[#A3A3A3] text-lg">How will you be using the platform?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Vehicle Owner Option */}
                <button
                  onClick={() => setSelectedRole('user')}
                  className={cn(
                    "relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-300 group",
                    selectedRole === 'user' 
                      ? "border-primary bg-primary/10" 
                      : "border-[#262626] bg-[#0A0A0A] hover:border-[#404040] hover:bg-[#141414]"
                  )}
                >
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors",
                    selectedRole === 'user' ? "bg-primary text-black" : "bg-[#262626] text-[#A3A3A3] group-hover:text-white"
                  )}>
                    <Car className="w-10 h-10" />
                  </div>
                  <h3 className={cn(
                    "text-xl font-bold mb-3 transition-colors",
                    selectedRole === 'user' ? "text-white" : "text-[#A3A3A3] group-hover:text-white"
                  )}>
                    Vehicle Owner
                  </h3>
                  <p className={cn(
                    "text-sm transition-colors",
                    selectedRole === 'user' ? "text-white/80" : "text-[#525252] group-hover:text-[#A3A3A3]"
                  )}>
                    I want to diagnose my car's issues, understand repair estimates, and find local shops.
                  </p>
                  
                  {selectedRole === 'user' && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-black rounded-full" />
                    </div>
                  )}
                </button>

                {/* Mechanic / Shop Option */}
                <button
                  onClick={() => setSelectedRole('mechanic')}
                  className={cn(
                    "relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-300 group",
                    selectedRole === 'mechanic' 
                      ? "border-primary bg-primary/10" 
                      : "border-[#262626] bg-[#0A0A0A] hover:border-[#404040] hover:bg-[#141414]"
                  )}
                >
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors",
                    selectedRole === 'mechanic' ? "bg-primary text-black" : "bg-[#262626] text-[#A3A3A3] group-hover:text-white"
                  )}>
                    <Wrench className="w-10 h-10" />
                  </div>
                  <h3 className={cn(
                    "text-xl font-bold mb-3 transition-colors",
                    selectedRole === 'mechanic' ? "text-white" : "text-[#A3A3A3] group-hover:text-white"
                  )}>
                    Auto Shop Owner
                  </h3>
                  <p className={cn(
                    "text-sm transition-colors",
                    selectedRole === 'mechanic' ? "text-white/80" : "text-[#525252] group-hover:text-[#A3A3A3]"
                  )}>
                    I want to receive diagnostic reports from customers, provide quotes, and manage inquiries.
                  </p>

                  {selectedRole === 'mechanic' && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-black rounded-full" />
                    </div>
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleContinue}
                  disabled={!selectedRole || isSubmitting}
                  className="w-full md:w-auto px-12 py-4 rounded-xl font-bold text-lg bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Setting up your account...
                    </>
                  ) : (
                    <>
                      Continue <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowJoinShop(true)}
                  className="text-[#A3A3A3] hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Have an invite code from your shop? Join team
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="join-shop"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col items-center text-center"
            >
              <button
                onClick={() => setShowJoinShop(false)}
                className="absolute top-6 left-6 p-2 rounded-full bg-[#262626] text-[#A3A3A3] hover:text-white hover:bg-[#333] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-primary" />
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">Join Your Team</h2>
              <p className="text-[#A3A3A3] text-lg mb-8 max-w-md">
                Enter the invite code provided by your shop owner to join their workspace.
              </p>
              
              <div className="w-full max-w-sm space-y-6">
                <div>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter Invite Code"
                    className="w-full bg-[#0A0A0A] border-2 border-[#262626] rounded-xl px-6 py-4 text-center text-2xl font-mono text-white placeholder-[#404040] focus:ring-primary focus:border-primary outline-none transition-all uppercase tracking-widest"
                  />
                </div>
                
                <button
                  onClick={handleJoinShop}
                  disabled={!inviteCode.trim() || isVerifyingCode}
                  className="w-full py-4 rounded-xl font-bold text-lg bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isVerifyingCode ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Join Shop <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
