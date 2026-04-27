import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Bell, Shield, Smartphone, LogOut, Save, Building2, Globe, Mail, Phone, Image as ImageIcon, CreditCard, Trash2, ExternalLink, Inbox, Star, CheckCircle2, AlertCircle, Clock, Users, Copy, RefreshCw } from 'lucide-react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { ShopInfo, Shop, ShopInquiry, UserProfile } from '../types';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import AlternatingText from './AlternatingText';
import { useDropzone } from 'react-dropzone';

interface SettingsProps {
  user: FirebaseUser;
}

export default function Settings({ user }: SettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'account' | 'billing' | 'users' | 'team' | 'shops'>('shop');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingAllShops, setLoadingAllShops] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [shopInfo, setShopInfo] = useState<ShopInfo>({
    name: '',
    logo: '',
    website: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isPublicShop, setIsPublicShop] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [userNotificationPreferences, setUserNotificationPreferences] = useState({
    emailDiagnosticReports: true,
    emailShopInquiries: true
  });
  const [shopNotificationPreferences, setShopNotificationPreferences] = useState({
    emailNewInquiries: true,
    emailMarketing: false
  });

  const onDropLogo = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `shops/${user.uid}/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const updatedShopInfo = { ...shopInfo, logo: downloadURL };
      setShopInfo(updatedShopInfo);
      
      // Auto-save to user profile
      await setDoc(doc(db, 'users', user.uid), {
        shopInfo: updatedShopInfo,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // If public shop, also update the shops collection
      if (isPublicShop) {
        await setDoc(doc(db, 'shops', user.uid), {
          logoUrl: downloadURL
        }, { merge: true });
      }

      toast.success('Logo uploaded and saved successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      if (error?.code === 'storage/unauthorized' || error?.message?.includes('unauthorized') || error?.message?.includes('bucket')) {
        toast.error('Storage not configured. Please enable Firebase Storage in your console.');
      } else if (error?.code === 'storage/retry-limit-exceeded') {
        toast.error('Upload timeout. Please ensure Firebase Storage is enabled in your Firebase Console.');
      } else {
        toast.error('Failed to upload logo');
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const { getRootProps: getLogoRootProps, getInputProps: getLogoInputProps, isDragActive: isLogoDragActive } = useDropzone({
    onDrop: onDropLogo,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.shopInfo) setShopInfo(data.shopInfo);
          if (data.notificationPreferences) {
            setUserNotificationPreferences(prev => ({ ...prev, ...data.notificationPreferences }));
          }
          setIsPublicShop(!!data.isPublicShop);
          setIsAdmin(data.role === 'admin');
          
          if (data.shopId && data.shopId !== user.uid) {
            setIsEmployee(true);
            setActiveTab('account'); // Employees shouldn't see shop settings by default
          } else {
            // If they are the shop owner, fetch the invite code
            const shopRef = doc(db, 'shops', user.uid);
            const shopSnap = await getDoc(shopRef);
            if (shopSnap.exists()) {
              if (shopSnap.data().inviteCode) {
                setInviteCode(shopSnap.data().inviteCode);
              }
              if (shopSnap.data().notificationPreferences) {
                setShopNotificationPreferences(prev => ({ ...prev, ...shopSnap.data().notificationPreferences }));
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin || activeTab !== 'users') return;
      setLoadingUsers(true);
      try {
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(usersData);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [isAdmin, activeTab]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (isEmployee || activeTab !== 'team') return;
      setLoadingTeam(true);
      try {
        const q = query(collection(db, 'users'), where('shopId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const teamData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setTeamMembers(teamData);
      } catch (err) {
        console.error('Failed to fetch team members:', err);
      } finally {
        setLoadingTeam(false);
      }
    };
    fetchTeam();
  }, [isEmployee, activeTab, user.uid]);

  useEffect(() => {
    const fetchAllShops = async () => {
      if (!isAdmin || activeTab !== 'shops') return;
      setLoadingAllShops(true);
      try {
        const q = query(collection(db, 'shops'));
        const querySnapshot = await getDocs(q);
        const shopsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
        setAllShops(shopsData);
      } catch (err) {
        console.error('Failed to fetch shops:', err);
      } finally {
        setLoadingAllShops(false);
      }
    };
    fetchAllShops();
  }, [isAdmin, activeTab]);

  const handleToggleShopVerification = async (shopId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), { isVerified: !currentStatus });
      setAllShops(allShops.map(s => s.id === shopId ? { ...s, isVerified: !currentStatus } : s));
      toast.success(`Shop ${!currentStatus ? 'verified' : 'unverified'} successfully`);
    } catch (err) {
      console.error('Failed to toggle shop verification:', err);
      toast.error('Failed to update shop verification status');
    }
  };

  const generateInviteCode = async () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(doc(db, 'shops', user.uid), { inviteCode: newCode }, { merge: true });
      setInviteCode(newCode);
      toast.success('New invite code generated');
    } catch (error) {
      console.error('Failed to generate invite code:', error);
      toast.error('Failed to generate invite code');
    }
  };

  const removeTeamMember = async (memberId: string) => {
    try {
      await updateDoc(doc(db, 'users', memberId), { shopId: null, role: 'user' });
      setTeamMembers(teamMembers.filter(m => m.uid !== memberId));
      toast.success('Team member removed');
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setAllUsers(allUsers.map(u => u.uid === userId ? { ...u, role: newRole } : u));
      toast.success('User role updated');
    } catch (err) {
      console.error('Failed to update user role:', err);
      toast.error('Failed to update user role');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update user profile
      await setDoc(doc(db, 'users', user.uid), {
        shopInfo,
        isPublicShop,
        notificationPreferences: userNotificationPreferences,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Always update the shop document to reflect the isPublicShop status
      let lat, lng;
      if (shopInfo.address && isPublicShop) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shopInfo.address)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lng = parseFloat(data[0].lon);
          }
        } catch (e) {
          console.error("Geocoding failed", e);
        }
      }

      const shopData: Partial<Shop> = {
        ownerId: user.uid,
        name: shopInfo.name || 'Unnamed Shop',
        address: shopInfo.address || '123 Main St, Detroit, MI 48201',
        city: shopInfo.address?.split(',')[1]?.trim() || 'Detroit',
        state: shopInfo.address?.split(',')[2]?.trim().split(' ')[0] || 'MI',
        zip: shopInfo.address?.split(',')[2]?.trim().split(' ')[1] || '48201',
        phone: shopInfo.phone || '555-000-0000',
        email: shopInfo.email || user.email || 'shop@example.com',
        website: shopInfo.website,
        hours: shopInfo.hours || '',
        about: shopInfo.about || '',
        specialties: shopInfo.specialties || ["General Repair", "Maintenance"],
        logoUrl: shopInfo.logo,
        isPublic: isPublicShop,
        notificationPreferences: shopNotificationPreferences
      };
      
      if (lat && lng) {
        shopData.lat = lat;
        shopData.lng = lng;
      }

      const shopRef = doc(db, 'shops', user.uid);
      const shopDoc = await getDoc(shopRef);
      
      if (!shopDoc.exists()) {
        shopData.rating = 5.0;
        shopData.reviewCount = 0;
        shopData.isVerified = false;
      } else {
        const existingData = shopDoc.data();
        if (existingData?.rating === undefined) shopData.rating = 5.0;
        if (existingData?.reviewCount === undefined) shopData.reviewCount = 0;
        if (existingData?.isVerified === undefined) shopData.isVerified = false;
      }

      await setDoc(shopRef, shopData, { merge: true });

      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };



  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            <AlternatingText text="Settings" />
          </h2>
          <p className="text-[#A3A3A3] text-sm md:text-base">
            Manage your account and shop preferences
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/80 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Navigation */}
        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 md:gap-2 pb-2 md:pb-0 scrollbar-hide space-y-0 md:space-y-2">
          {!isEmployee && (
            <button 
              onClick={() => setActiveTab('shop')}
              className={cn(
                "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
                activeTab === 'shop' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
              )}
            >
              <Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Shop Profile</span><span className="sm:hidden">Shop</span>
            </button>
          )}
          
          {!isEmployee && (
            <button 
              onClick={() => setActiveTab('team')}
              className={cn(
                "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
                activeTab === 'team' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
              )}
            >
              <Users className="w-4 h-4" /> <span className="hidden sm:inline">Team Management</span><span className="sm:hidden">Team</span>
            </button>
          )}

          <button 
            onClick={() => setActiveTab('account')}
            className={cn(
              "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
              activeTab === 'account' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
            )}
          >
            <User className="w-4 h-4" /> Account
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={cn(
              "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
              activeTab === 'billing' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
            )}
          >
            <CreditCard className="w-4 h-4" /> Billing
          </button>

          {isAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('users')}
                className={cn(
                  "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
                  activeTab === 'users' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
                )}
              >
                <Users className="w-4 h-4" /> User Management
              </button>
              <button 
                onClick={() => setActiveTab('shops')}
                className={cn(
                  "flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm text-left transition-all",
                  activeTab === 'shops' ? "bg-primary/10 text-primary" : "text-[#A3A3A3] hover:bg-[#141414]"
                )}
              >
                <Building2 className="w-4 h-4" /> Shop Management
              </button>
            </>
          )}
          <div className="pt-0 md:pt-4 flex-shrink-0 md:w-full">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 text-red-500 hover:bg-red-500/10 rounded-xl font-bold text-xs md:text-sm text-left transition-all"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span><span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'shop' && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Shop Information</h3>
                  <p className="text-xs text-[#525252]">This information will appear on your shared reports</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Shop Name</label>
                  <input 
                    type="text"
                    value={shopInfo.name}
                    onChange={(e) => setShopInfo({ ...shopInfo, name: e.target.value })}
                    placeholder="e.g. Precision Auto Repair"
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Shop Logo</label>
                  <div 
                    {...getLogoRootProps()} 
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
                      isLogoDragActive ? "border-primary bg-primary/5" : "border-[#262626] hover:border-[#404040] bg-[#0A0A0A]",
                      uploadingLogo && "opacity-50 pointer-events-none"
                    )}
                  >
                    <input {...getLogoInputProps()} />
                    {uploadingLogo ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-[#A3A3A3]">Uploading...</p>
                      </div>
                    ) : shopInfo.logo ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-xl border border-[#262626] overflow-hidden bg-white flex items-center justify-center p-2">
                          <img src={shopInfo.logo} alt="Shop Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <p className="text-xs text-primary font-medium hover:underline">Click or drag to change logo</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-[#141414] flex items-center justify-center text-[#525252] mb-2">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-white font-medium">Drag & drop your logo here</p>
                        <p className="text-xs text-[#525252]">or click to browse files</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
                      <input 
                        type="text"
                        value={shopInfo.website}
                        onChange={(e) => setShopInfo({ ...shopInfo, website: e.target.value })}
                        placeholder="www.yourshop.com"
                        className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
                      <input 
                        type="text"
                        value={shopInfo.phone}
                        onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                        placeholder="(555) 000-0000"
                        className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#525252]" />
                    <input 
                      type="email"
                      value={shopInfo.email}
                      onChange={(e) => setShopInfo({ ...shopInfo, email: e.target.value })}
                      placeholder="service@yourshop.com"
                      className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Physical Address</label>
                  <textarea 
                    value={shopInfo.address}
                    onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
                    placeholder="123 Mechanic St, Auto City, AC 12345"
                    rows={2}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Business Hours</label>
                  <input 
                    type="text"
                    value={shopInfo.hours || ''}
                    onChange={(e) => setShopInfo({ ...shopInfo, hours: e.target.value })}
                    placeholder="Mon-Fri: 8am - 6pm, Sat: 9am - 2pm"
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">About Your Shop</label>
                  <textarea 
                    value={shopInfo.about || ''}
                    onChange={(e) => setShopInfo({ ...shopInfo, about: e.target.value })}
                    placeholder="Tell customers about your experience, certifications, and what makes your shop special..."
                    rows={4}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#525252]">Specialties (Comma Separated)</label>
                  <input 
                    type="text"
                    value={shopInfo.specialties?.join(', ') || ''}
                    onChange={(e) => setShopInfo({ ...shopInfo, specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g. European Cars, Transmissions, EVs"
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="pt-4 border-t border-[#262626]">
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-xl mb-4">
                    <div>
                      <p className="text-white font-medium">Public Shop Profile</p>
                      <p className="text-xs text-[#525252]">List your shop in our directory to receive inquiries</p>
                    </div>
                    <button 
                      onClick={() => setIsPublicShop(!isPublicShop)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all duration-300",
                        isPublicShop ? "bg-primary" : "bg-[#262626]"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                        isPublicShop ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white">Shop Notifications</h4>
                    
                    <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-xl">
                      <div>
                        <p className="text-white font-medium">New Inquiries</p>
                        <p className="text-xs text-[#525252]">Receive an email when a customer requests a quote</p>
                      </div>
                      <button 
                        onClick={() => setShopNotificationPreferences(prev => ({ ...prev, emailNewInquiries: !prev.emailNewInquiries }))}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          shopNotificationPreferences.emailNewInquiries ? "bg-primary" : "bg-[#262626]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                          shopNotificationPreferences.emailNewInquiries ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-xl">
                      <div>
                        <p className="text-white font-medium">Marketing & Promotions</p>
                        <p className="text-xs text-[#525252]">Receive emails about new features and promotional opportunities</p>
                      </div>
                      <button 
                        onClick={() => setShopNotificationPreferences(prev => ({ ...prev, emailMarketing: !prev.emailMarketing }))}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          shopNotificationPreferences.emailMarketing ? "bg-primary" : "bg-[#262626]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                          shopNotificationPreferences.emailMarketing ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'team' && !isEmployee && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Team Management</h3>
                    <p className="text-xs text-[#525252]">Invite and manage your shop's employees</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h4 className="text-white font-bold mb-1">Shop Invite Code</h4>
                    <p className="text-xs text-[#A3A3A3]">Share this code with your employees so they can join your shop.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inviteCode ? (
                      <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#262626] rounded-lg px-4 py-2">
                        <span className="text-xl font-mono text-white tracking-widest">{inviteCode}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(inviteCode);
                            toast.success('Invite code copied to clipboard');
                          }}
                          className="p-2 text-[#A3A3A3] hover:text-white transition-colors"
                          title="Copy Code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={generateInviteCode}
                          className="p-2 text-[#A3A3A3] hover:text-white transition-colors"
                          title="Generate New Code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={generateInviteCode}
                        className="px-4 py-2 bg-primary text-black rounded-lg font-bold text-sm hover:bg-primary/90 transition-all"
                      >
                        Generate Invite Code
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-white font-bold">Current Team Members</h4>
                  {loadingTeam ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-[#A3A3A3] bg-[#1A1A1A] rounded-xl border border-[#262626]">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No team members yet.</p>
                      <p className="text-sm">Share your invite code to add employees.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map(member => (
                        <div key={member.uid} className="flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#262626] rounded-xl">
                          <div className="flex items-center gap-3">
                            <img 
                              src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} 
                              alt={member.displayName || 'User'} 
                              className="w-10 h-10 rounded-full"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-white font-medium">{member.displayName || 'Unnamed User'}</p>
                              <p className="text-xs text-[#A3A3A3]">{member.email}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${member.displayName || 'this user'} from your team?`)) {
                                removeTeamMember(member.uid);
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'account' && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Account Profile</h3>
                  <p className="text-xs text-[#525252]">Manage your personal information</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.displayName || 'User'} 
                  className="w-20 h-20 rounded-full border-2 border-primary p-1"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-white font-bold text-lg">{user.displayName}</h4>
                  <p className="text-[#525252]">{user.email}</p>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <h4 className="text-sm font-bold text-white">Email Notifications</h4>
                
                <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-xl">
                  <div>
                    <p className="text-white font-medium">Diagnostic Reports</p>
                    <p className="text-xs text-[#525252]">Receive an email when your AI diagnosis is complete</p>
                  </div>
                  <button 
                    onClick={() => setUserNotificationPreferences(prev => ({ ...prev, emailDiagnosticReports: !prev.emailDiagnosticReports }))}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      userNotificationPreferences.emailDiagnosticReports ? "bg-primary" : "bg-[#262626]"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      userNotificationPreferences.emailDiagnosticReports ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-xl">
                  <div>
                    <p className="text-white font-medium">Shop Inquiries</p>
                    <p className="text-xs text-[#525252]">Receive an email when a shop responds to your quote request</p>
                  </div>
                  <button 
                    onClick={() => setUserNotificationPreferences(prev => ({ ...prev, emailShopInquiries: !prev.emailShopInquiries }))}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      userNotificationPreferences.emailShopInquiries ? "bg-primary" : "bg-[#262626]"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      userNotificationPreferences.emailShopInquiries ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="pt-4 border-t border-[#262626]">
                  <button className="text-xs text-red-500 font-bold hover:underline flex items-center gap-2">
                    <Trash2 className="w-3 h-3" /> Delete Account
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'billing' && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Billing & Subscription</h3>
                  <p className="text-xs text-[#525252]">Manage your plan and payments</p>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6 flex justify-between items-center">
                <div>
                  <p className="text-white font-bold">Free Plan</p>
                  <p className="text-xs text-[#525252]">5 AI diagnoses remaining this month</p>
                </div>
                <button className="px-4 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary/80 transition-all">
                  Upgrade to Pro
                </button>
              </div>

              <div className="text-center py-8">
                <p className="text-sm text-[#A3A3A3] mb-4">No payment methods saved.</p>
                <button className="flex items-center gap-2 text-sm text-primary font-bold hover:underline mx-auto">
                  Add Payment Method <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </section>
          )}

          {activeTab === 'users' && isAdmin && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold">User Management</h3>
                  <p className="text-xs text-[#525252]">Assign roles and manage user access</p>
                </div>
              </div>

              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#525252]">
                  <Clock className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Loading Users...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allUsers.map((u) => (
                    <div key={u.uid} className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                          alt={u.displayName || 'User'} 
                          className="w-10 h-10 rounded-full border border-[#262626]"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="text-white font-bold text-sm">{u.displayName || 'Unknown User'}</p>
                          <p className="text-xs text-[#525252]">{u.email}</p>
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-auto">
                        <select
                          value={u.role || 'user'}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as UserProfile['role'])}
                          disabled={u.uid === user.uid} // Prevent changing own role
                          className="w-full sm:w-auto bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-all disabled:opacity-50"
                        >
                          <option value="user">User</option>
                          <option value="customer">Customer</option>
                          <option value="mechanic">Mechanic</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'shops' && isAdmin && (
            <section className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#262626]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Shop Management</h3>
                  <p className="text-xs text-[#525252]">Manage and verify shops on the platform</p>
                </div>
              </div>

              {loadingAllShops ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#525252]">
                  <Clock className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Loading Shops...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allShops.map((s) => (
                    <div key={s.id} className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-[#262626] bg-[#141414] flex items-center justify-center overflow-hidden shrink-0">
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 className="w-5 h-5 text-[#525252]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">{s.name}</p>
                            {s.isVerified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                          </div>
                          <p className="text-xs text-[#525252]">{s.email} • {s.city}, {s.state}</p>
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-xs text-[#A3A3A3] font-medium">Verified</span>
                        <button 
                          onClick={() => handleToggleShopVerification(s.id, !!s.isVerified)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all duration-300",
                            s.isVerified ? "bg-blue-500" : "bg-[#262626]"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                            s.isVerified ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {allShops.length === 0 && (
                    <div className="text-center py-8 text-[#A3A3A3]">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No shops found on the platform.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
