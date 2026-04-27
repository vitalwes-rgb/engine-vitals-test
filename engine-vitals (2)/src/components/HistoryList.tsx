import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Search, Activity, ChevronRight, History, AlertCircle, CheckCircle2, Info, ArrowLeft, ArrowRight, Loader2, X, Plus, Calendar, Clock, Trash2, MessageSquare, Building2, ExternalLink, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { DiagnosisRecord, ShopInquiry } from '../types';
import { toast } from 'sonner';
import ChatModal from './ChatModal';

interface HistoryListProps {
  user: FirebaseUser;
  onSelect: (record: DiagnosisRecord) => void;
}

export default function HistoryList({ user, onSelect }: HistoryListProps) {
  const [history, setHistory] = useState<DiagnosisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'diagnoses'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DiagnosisRecord[];
      setHistory(records);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'diagnoses');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const filteredHistory = history.filter(item => 
    item.vehicleInfo.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.vehicleInfo.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.result.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const confirmDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'diagnoses', reportToDelete));
      toast.success('Report deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `diagnoses/${reportToDelete}`);
      toast.error('Failed to delete report');
    } finally {
      setIsDeleting(false);
      setReportToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            Your <span className="text-primary">History</span>
          </h1>
          <p className="text-[#A3A3A3] text-sm md:text-base max-w-2xl">
            Keep track of all your previous vehicle scans and diagnostic reports.
          </p>
        </div>
        <div className="relative group w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252] group-hover:text-[#A3A3A3] transition-colors" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full md:w-64 bg-[#141414] border border-[#262626] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#404040] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 animate-pulse flex flex-col md:flex-row gap-6 shadow-xl">
              <div className="flex-shrink-0 w-16 h-16 bg-[#262626] rounded-xl"></div>
              <div className="flex-grow space-y-3">
                <div className="w-1/3 h-6 bg-[#262626] rounded-lg"></div>
                <div className="w-2/3 h-4 bg-[#262626] rounded-lg"></div>
                <div className="flex gap-2 pt-2">
                  <div className="w-20 h-6 bg-[#262626] rounded-full"></div>
                  <div className="w-20 h-6 bg-[#262626] rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredHistory.map((item, i) => {
            const date = item.createdAt?.toDate() || new Date();
            const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            // Find highest severity
            const highestSeverity = item.result.possibleIssues.reduce((prev, curr) => {
              const weights = { low: 1, medium: 2, high: 3, critical: 4 };
              return weights[curr.severity] > weights[prev] ? curr.severity : prev;
            }, 'low' as any);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onSelect(item)}
                className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-4 sm:p-6 hover:border-primary/30 transition-all group cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 shadow-xl"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#0A0A0A] border border-[#262626] flex flex-col items-center justify-center text-[#525252] group-hover:text-primary transition-colors shrink-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">{dateStr}</span>
                </div>

                <div className="flex-grow space-y-1 w-full">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors">
                      {item.vehicleInfo.year} {item.vehicleInfo.make} {item.vehicleInfo.model}
                    </h3>
                    <span className={cn(
                      "text-[8px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                      highestSeverity === 'critical' ? "bg-red-500/10 text-red-500" :
                      highestSeverity === 'high' ? "bg-orange-500/10 text-orange-500" :
                      highestSeverity === 'medium' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-blue-500/10 text-blue-500"
                    )}>
                      {highestSeverity} severity
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#A3A3A3] line-clamp-2 sm:line-clamp-1">{item.vehicleInfo.symptoms}</p>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#525252]">
                      <Clock className="w-3 h-3" /> {timeStr}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-primary font-bold">
                      <Activity className="w-3 h-3" /> {item.result.summary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportToDelete(item.id);
                    }}
                    className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626] text-[#525252] hover:text-red-500 hover:border-red-500/50 transition-all"
                    title="Delete Report"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="hidden sm:flex p-3 rounded-xl bg-[#0A0A0A] border border-[#262626] text-[#525252] group-hover:text-white group-hover:border-primary transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredHistory.length === 0 && (
            <div className="text-center py-20 bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl border-dashed shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
              <div className="relative z-10">
                <div className="w-20 h-20 rounded-full bg-[#1A1A1A] flex items-center justify-center mx-auto mb-6 border border-[#262626] shadow-xl">
                  <History className="w-8 h-8 text-[#525252]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Diagnostic History</h3>
                <p className="text-[#A3A3A3] max-w-sm mx-auto mb-6">You haven't run any AI diagnostics yet. Connect your scanner or enter symptoms to get started.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {reportToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141414] border border-[#262626] rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Delete Report?</h3>
              </div>
              <p className="text-[#A3A3A3] text-sm mb-6">
                Are you sure you want to delete this diagnosis report? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReportToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#262626] text-white hover:bg-[#262626] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
