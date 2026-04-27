import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, User, Building2, Paperclip, Loader2, Image as ImageIcon, Sparkles, FileText, Check, XCircle, Calendar } from 'lucide-react';
import { db, auth, storage } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { InquiryMessage, ShopInquiry } from '../types';
import { generateSmartReplyAPI } from '../services/geminiService';
import { toast } from 'sonner';

interface ChatModalProps {
  inquiry: ShopInquiry;
  onClose: () => void;
  isShop: boolean;
}

export default function ChatModal({ inquiry, onClose, isShop }: ChatModalProps) {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [estimateData, setEstimateData] = useState({ parts: 0, labor: 0, tax: 0, notes: '' });
  const [appointmentData, setAppointmentData] = useState({ date: '', time: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inquiry.id) return;

    // Reset unread count when opening chat
    const resetUnread = async () => {
      try {
        const inquiryRef = doc(db, 'inquiries', inquiry.id!);
        if (isShop) {
          await updateDoc(inquiryRef, { unreadCountShop: 0 });
        } else {
          await updateDoc(inquiryRef, { unreadCountUser: 0 });
        }
      } catch (error) {
        console.error('Error resetting unread count:', error);
      }
    };
    resetUnread();

    const q = query(
      collection(db, 'inquiries', inquiry.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InquiryMessage));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [inquiry.id]);

  const handleEstimateAction = async (messageId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'inquiries', inquiry.id!, 'messages', messageId), {
        'estimateDetails.status': status
      });
      
      // Send a system message about the action
      await addDoc(collection(db, 'inquiries', inquiry.id!, 'messages'), {
        inquiryId: inquiry.id,
        senderId: 'system',
        text: `Estimate was ${status} by customer.`,
        createdAt: serverTimestamp(),
        type: 'system'
      });
    } catch (error) {
      console.error('Error updating estimate:', error);
      toast.error('Failed to update estimate');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, mediaType?: 'image' | 'video', isEstimate: boolean = false) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaUrl && !isEstimate) || !inquiry.id || !auth.currentUser) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      const messageData: any = {
        inquiryId: inquiry.id,
        userId: inquiry.userId,
        shopId: inquiry.shopId,
        senderId: auth.currentUser.uid,
        text: msgText,
        createdAt: serverTimestamp(),
        ...(mediaUrl && { mediaUrl, mediaType }),
        type: isEstimate ? 'estimate' : 'text'
      };

      if (isEstimate) {
        messageData.estimateDetails = {
          ...estimateData,
          total: Number(estimateData.parts) + Number(estimateData.labor) + Number(estimateData.tax),
          status: 'pending'
        };
        setShowEstimateForm(false);
        setEstimateData({ parts: 0, labor: 0, tax: 0, notes: '' });
      }

      // Add message
      await addDoc(collection(db, 'inquiries', inquiry.id, 'messages'), messageData);

      // Update inquiry with unread count and last message time
      const inquiryRef = doc(db, 'inquiries', inquiry.id);
      await updateDoc(inquiryRef, {
        lastMessageAt: serverTimestamp(),
        [isShop ? 'unreadCountUser' : 'unreadCountShop']: increment(1),
        status: 'responded' // Automatically mark as responded if there's activity
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleAppointmentAction = async (action: 'confirmed' | 'declined') => {
    try {
      const inquiryRef = doc(db, 'inquiries', inquiry.id!);
      await updateDoc(inquiryRef, {
        'appointment.status': action
      });

      // Add a system message
      await addDoc(collection(db, 'inquiries', inquiry.id!, 'messages'), {
        inquiryId: inquiry.id,
        userId: inquiry.userId,
        shopId: inquiry.shopId,
        senderId: 'system',
        text: `Appointment was ${action} by shop.`,
        createdAt: serverTimestamp(),
        type: 'system'
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const handleRequestAppointment = async () => {
    if (!appointmentData.date || !appointmentData.time || !inquiry.id) return;

    try {
      const inquiryRef = doc(db, 'inquiries', inquiry.id);
      await updateDoc(inquiryRef, {
        appointment: {
          ...appointmentData,
          status: 'requested'
        }
      });

      // Add a system message
      await addDoc(collection(db, 'inquiries', inquiry.id, 'messages'), {
        inquiryId: inquiry.id,
        userId: inquiry.userId,
        shopId: inquiry.shopId,
        senderId: 'system',
        text: `Customer requested an appointment for ${appointmentData.date} at ${appointmentData.time}.`,
        createdAt: serverTimestamp(),
        type: 'system'
      });

      setShowAppointmentForm(false);
      setAppointmentData({ date: '', time: '' });
    } catch (error) {
      console.error('Error requesting appointment:', error);
    }
  };

  const generateSmartReply = async () => {
    setIsGeneratingReply(true);
    try {
      const text = await generateSmartReplyAPI(inquiry.issueDescription, inquiry.vehicleInfo);
      if (text) {
        setNewMessage(text.trim());
      }
    } catch (error) {
      console.error('Error generating smart reply:', error);
      toast.error('Failed to generate smart reply.');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !inquiry.id || !auth.currentUser) return;

    setIsUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, `inquiries/${inquiry.id}/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      await handleSendMessage(undefined, downloadUrl, isVideo ? 'video' : 'image');
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        className="relative w-full max-w-lg bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl flex flex-col h-[600px] max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#262626] flex justify-between items-center bg-[#0A0A0A] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center text-white">
              {isShop ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-white">{isShop ? 'Customer' : 'Shop'}</h3>
              <p className="text-[10px] text-[#A3A3A3]">Inquiry #{inquiry.id?.substring(0, 6)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#262626] rounded-full transition-colors text-[#A3A3A3] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {inquiry.appointment && (
            <div className="flex justify-center my-4">
              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-2xl p-4 max-w-sm w-full text-center shadow-lg">
                <div className="flex items-center justify-center gap-2 text-primary font-bold mb-2">
                  <Calendar className="w-4 h-4" /> Appointment Request
                </div>
                <p className="text-white text-sm mb-1">{inquiry.appointment.date} at {inquiry.appointment.time}</p>
                
                {inquiry.appointment.status === 'requested' ? (
                  isShop ? (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleAppointmentAction('confirmed')} className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-600">
                        <Check className="w-3 h-3" /> Confirm
                      </button>
                      <button onClick={() => handleAppointmentAction('declined')} className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-600">
                        <XCircle className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest mt-2">Pending Shop Confirmation</p>
                  )
                ) : (
                  <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${inquiry.appointment.status === 'confirmed' ? 'text-green-500' : 'text-red-500'}`}>
                    {inquiry.appointment.status}
                  </p>
                )}
              </div>
            </div>
          )}

          {inquiry.message && (
            <div className="flex justify-start">
              <div className="bg-[#262626] text-white rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%] text-sm">
                <p className="text-[10px] text-[#A3A3A3] mb-1 font-bold uppercase tracking-widest">Initial Message</p>
                {inquiry.message}
              </div>
            </div>
          )}
          
          {messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-[#262626] text-[#A3A3A3] text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm ${
                  isMe 
                    ? 'bg-primary text-black rounded-tr-none' 
                    : 'bg-[#262626] text-white rounded-tl-none'
                }`}>
                  {msg.mediaUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      {msg.mediaType === 'video' ? (
                        <video src={msg.mediaUrl} controls className="max-w-full h-auto max-h-48 object-cover" />
                      ) : (
                        <img src={msg.mediaUrl} alt="Attachment" className="max-w-full h-auto max-h-48 object-cover" />
                      )}
                    </div>
                  )}
                  {msg.text && <p>{msg.text}</p>}
                  
                  {msg.type === 'estimate' && msg.estimateDetails && (
                    <div className={`mt-3 p-3 rounded-xl border ${isMe ? 'bg-black/10 border-black/20' : 'bg-[#141414] border-[#404040]'}`}>
                      <div className="flex items-center gap-2 mb-2 font-bold">
                        <FileText className="w-4 h-4" /> Formal Estimate
                      </div>
                      <div className="space-y-1 text-xs mb-3">
                        <div className="flex justify-between"><span>Parts:</span> <span>${msg.estimateDetails.parts.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Labor:</span> <span>${msg.estimateDetails.labor.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Tax:</span> <span>${msg.estimateDetails.tax.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold pt-1 border-t border-current/20">
                          <span>Total:</span> <span>${msg.estimateDetails.total.toFixed(2)}</span>
                        </div>
                      </div>
                      {msg.estimateDetails.notes && (
                        <p className="text-xs italic mb-3 opacity-80">"{msg.estimateDetails.notes}"</p>
                      )}
                      
                      {msg.estimateDetails.status === 'pending' ? (
                        !isShop ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleEstimateAction(msg.id!, 'approved')} className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-600">
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => handleEstimateAction(msg.id!, 'rejected')} className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-600">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs font-bold uppercase tracking-widest opacity-70">
                            Pending Approval
                          </div>
                        )
                      ) : (
                        <div className={`text-center text-xs font-bold uppercase tracking-widest ${msg.estimateDetails.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                          {msg.estimateDetails.status}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#262626] bg-[#0A0A0A] rounded-b-2xl">
          {showAppointmentForm && (
            <div className="mb-4 p-4 bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-2xl shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Request Appointment</h4>
                <button onClick={() => setShowAppointmentForm(false)} className="text-[#525252] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Date</label>
                  <input type="date" value={appointmentData.date} onChange={e => setAppointmentData({...appointmentData, date: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Time</label>
                  <input type="time" value={appointmentData.time} onChange={e => setAppointmentData({...appointmentData, time: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <button onClick={handleRequestAppointment} disabled={!appointmentData.date || !appointmentData.time} className="w-full bg-primary text-black font-bold py-2 rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
                Send Request
              </button>
            </div>
          )}

          {showEstimateForm && (
            <div className="mb-4 p-4 bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-2xl shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Create Estimate</h4>
                <button onClick={() => setShowEstimateForm(false)} className="text-[#525252] hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Parts ($)</label>
                  <input type="number" value={estimateData.parts || ''} onChange={e => setEstimateData({...estimateData, parts: Number(e.target.value)})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Labor ($)</label>
                  <input type="number" value={estimateData.labor || ''} onChange={e => setEstimateData({...estimateData, labor: Number(e.target.value)})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Tax ($)</label>
                  <input type="number" value={estimateData.tax || ''} onChange={e => setEstimateData({...estimateData, tax: Number(e.target.value)})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Notes (Optional)</label>
                <input type="text" value={estimateData.notes} onChange={e => setEstimateData({...estimateData, notes: e.target.value})} placeholder="e.g. Includes synthetic oil and filter" className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <button onClick={() => handleSendMessage(undefined, undefined, undefined, true)} className="w-full bg-primary text-black font-bold py-2 rounded-lg text-sm hover:bg-primary/90">
                Send Estimate (${(Number(estimateData.parts) + Number(estimateData.labor) + Number(estimateData.tax)).toFixed(2)})
              </button>
            </div>
          )}

          <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-3 text-[#A3A3A3] hover:text-white hover:bg-[#262626] rounded-xl transition-all disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all text-sm"
            />
            {isShop ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowEstimateForm(!showEstimateForm)}
                  className="p-3 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                  title="Create Estimate"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={generateSmartReply}
                  disabled={isGeneratingReply}
                  className="p-3 text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-all disabled:opacity-50"
                  title="Draft reply with AI"
                >
                  {isGeneratingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAppointmentForm(!showAppointmentForm)}
                className="p-3 text-primary hover:bg-primary/10 rounded-xl transition-all"
                title="Request Appointment"
              >
                <Calendar className="w-5 h-5" />
              </button>
            )}
            <button 
              type="submit"
              disabled={(!newMessage.trim() && !isUploading) || isUploading}
              className="bg-primary hover:bg-primary/80 disabled:opacity-50 text-black p-3 rounded-xl transition-all flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
