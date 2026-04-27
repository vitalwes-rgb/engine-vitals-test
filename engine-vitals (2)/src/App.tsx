import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Joyride, Step, EventData, STATUS } from 'react-joyride';
import { Search, History, Settings as SettingsIcon, Activity, Shield, ChevronRight, Upload, Camera, Video, AlertCircle, CheckCircle2, Info, ArrowLeft, ArrowRight, Loader2, LogOut, LogIn, User as UserIcon, Share2, ShoppingBag, Zap, Download, MessageSquare, LayoutDashboard, Car } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';
import { VehicleInfo, ScanToolData, DiagnosisResult, MediaFile, DiagnosisRecord } from './types';
import { analyzeVehicle } from './services/geminiService';
import { auth, googleProvider, db, handleFirestoreError, OperationType, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, serverTimestamp } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, Timestamp, doc, setDoc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { Mail, Lock, User as UserIconAlt, ArrowRight as ArrowRightAlt } from 'lucide-react';

// Components
import DiagnosisWizard from './components/DiagnosisWizard';
import DiagnosisResults from './components/DiagnosisResults';
import HistoryList from './components/HistoryList';
import SettingsTab from './components/Settings';
import ShopDirectory from './components/ShopDirectory';
import ShopDashboard from './components/ShopDashboard';
import UserDashboard from './components/UserDashboard';
import MyGarage from './components/MyGarage';
import Logo from './components/Logo';
import AlternatingText from './components/AlternatingText';
import MechanicChat from './components/MechanicChat';
import SEO from './components/SEO';

// New Component for Public Sharing
import PublicReport from './components/PublicReport';
import PublicShopProfile from './components/PublicShopProfile';
import RoleSelectionModal from './components/RoleSelectionModal';
import ReloadPrompt from './components/ReloadPrompt';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<><SEO title="Shared Diagnostic Report" /><PublicReport /></>} />
        <Route path="/report/:id" element={<><SEO title="Diagnostic Report" /><PublicReport /></>} />
        <Route path="/shop/:shopId" element={<><SEO title="Auto Shop Profile" /><PublicShopProfile /></>} />
        <Route path="/*" element={<><SEO /><MainApp /></>} />
      </Routes>
    </BrowserRouter>
  );
}

function MainApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'social' | 'email-login' | 'email-signup'>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnose' | 'ask' | 'history' | 'shops' | 'dashboard' | 'settings' | 'garage'>('diagnose');
  const [quoteDiagnosisId, setQuoteDiagnosisId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [userData, setUserData] = useState<any>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    make: '',
    model: '',
    year: '',
    symptoms: '',
    customPrompt: ''
  });
  const [scanData, setScanData] = useState<ScanToolData | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [lastDiagnosisId, setLastDiagnosisId] = useState<string | null>(null);
  const [lastMediaUrls, setLastMediaUrls] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<DiagnosisRecord | null>(null);
  const [runTour, setRunTour] = useState(false);

  const tourSteps: Step[] = [
    {
      target: '.tour-vehicle-info',
      content: 'Start by entering your vehicle details here. This helps the AI provide accurate, model-specific diagnostics.',
      skipBeacon: true,
    },
    {
      target: '.tour-scan-input',
      content: 'Connect your Bluetooth scanner to pull codes, or just type what you are experiencing (e.g., "Check engine light is on").',
    },
    {
      target: '.tour-analyze-btn',
      content: 'Click here to let the AI analyze the data and generate a full diagnostic report with cost estimates!',
    }
  ];

  useEffect(() => {
    // Check if the user has seen the tour
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour && user) {
      setRunTour(true);
    }
  }, [user]);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  useEffect(() => {
    const seedShops = async () => {
      if (!user || user.email !== 'vitalwes@gmail.com') return;
      
      try {
        const shopsRef = collection(db, 'shops');
        const snapshot = await getDocs(shopsRef);
        if (snapshot.empty) {
          const sampleShops = [
            {
              name: "Elite Auto Care",
              address: "123 Mechanic St",
              city: "Detroit",
              state: "MI",
              zip: "48201",
              phone: "(313) 555-0123",
              email: "service@eliteautocare.com",
              rating: 4.8,
              specialties: ["Engine Diagnostics", "Transmission", "Electrical"],
              isPublic: true
            },
            {
              name: "Precision Motors",
              address: "456 Performance Ave",
              city: "Detroit",
              state: "MI",
              zip: "48202",
              phone: "(313) 555-0456",
              email: "info@precisionmotors.com",
              rating: 4.9,
              specialties: ["European Cars", "Performance Tuning", "Brakes"],
              isPublic: true
            },
            {
              name: "The Engine Room",
              address: "789 Cylinder Rd",
              city: "Detroit",
              state: "MI",
              zip: "48203",
              phone: "(313) 555-0789",
              email: "hello@engineroom.com",
              rating: 4.7,
              specialties: ["Classic Cars", "Engine Rebuilds", "Oil Changes"],
              isPublic: true
            }
          ];

          for (const shop of sampleShops) {
            await addDoc(shopsRef, shop);
          }
          console.log("Sample shops seeded!");
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'shops');
      }
    };
    
    if (isAuthReady) {
      seedShops();
    }
  }, [user, isAuthReady]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            if (currentUser.email === 'vitalwes@gmail.com') {
              // Admin bypasses role selection
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                role: 'admin'
              });
              setUserRole('admin');
            } else {
              // Show role selection for new normal users
              setShowRoleSelection(true);
            }
          } else {
            const data = userDoc.data();
            if (currentUser.email === 'vitalwes@gmail.com' && data.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' });
              setUserRole('admin');
              setUserData({ ...data, role: 'admin' });
            } else {
              setUserRole(data.role || 'user');
              setUserData(data);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      } else {
        setUserRole('user');
        setUserData(null);
        setShowRoleSelection(false);
        if (['history', 'garage', 'settings', 'dashboard'].includes(activeTabRef.current)) {
          setActiveTab('diagnose');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRoleSelection = async (role: 'user' | 'mechanic', shopId?: string) => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData: any = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role
      };
      
      if (shopId) {
        updateData.shopId = shopId;
      }
      
      await setDoc(userRef, updateData);
      
      setUserRole(role);
      setUserData(updateData);
      setShowRoleSelection(false);
      
      // If they joined a shop, take them to dashboard
      if (shopId) {
        setActiveTab('dashboard');
        toast.success('Successfully joined the shop team!');
      } else if (role === 'mechanic') {
        // If they chose mechanic without a shop ID, take them to settings to set up their shop
        setActiveTab('settings');
        toast.success('Welcome! Please set up your shop profile.');
      } else {
        // Scroll to Vehicle Information for first-time users
        setTimeout(() => {
          const element = document.querySelector('.tour-vehicle-info');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 800);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      toast.error('Failed to set role. Please try again.');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Successfully logged in with Google!');
    } catch (error: any) {
      console.error(error);
      toast.error(`Google Login Failed: ${error.message}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }
    
    setIsAuthenticating(true);
    try {
      if (authMode === 'email-signup') {
        if (!displayName) {
          toast.error('Please enter your name.');
          setIsAuthenticating(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        toast.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Logged in successfully!');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Authentication failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info('Logged out.');
      resetDiagnosis();
    } catch (error) {
      console.error(error);
      toast.error('Failed to log out.');
    }
  };

  const uploadMedia = async (files: MediaFile[], userId: string): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      const storageRef = ref(storage, `diagnoses/${userId}/${Date.now()}_${file.file.name}`);
      const snapshot = await uploadBytes(storageRef, file.file);
      return getDownloadURL(snapshot.ref);
    });
    return Promise.all(uploadPromises);
  };

  const cleanObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    // Preserve Firestore FieldValue and other non-plain objects
    if (obj.constructor !== Object && !Array.isArray(obj)) return obj;
    
    if (Array.isArray(obj)) return obj.map(cleanObject);
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanObject(v)])
    );
  };

  const handleStartDiagnosis = async (labTestData?: any) => {
    // Prevent React Synthetic Events or standard DOM events from being passed as labTestData
    if (labTestData && (labTestData._reactName || labTestData.nativeEvent || labTestData instanceof Event)) {
      labTestData = undefined;
    }
    
    if (!user && !isDemoMode) {
      toast.error('Please log in to save your diagnosis history.');
      return;
    }

    if (!vehicleInfo.make || !vehicleInfo.model || !vehicleInfo.year) {
      toast.error('Please provide Make, Model, and Year before analyzing.');
      setWizardStep(0);
      return;
    }

    if (!vehicleInfo.symptoms && !scanData) {
      toast.error('Please provide Symptoms or perform an OBD-II scan before analyzing.');
      setWizardStep(0);
      return;
    }

    const finalVehicleInfo = {
      ...vehicleInfo,
      symptoms: vehicleInfo.symptoms || 'General health check based on live OBD2 data'
    };

    setIsAnalyzing(true);
    try {
      // Convert media files to base64 for Gemini API
      const mediaData = await Promise.all(mediaFiles.map(async (m) => {
        const reader = new FileReader();
        return new Promise<{ data: string; mimeType: string }>((resolve) => {
          reader.onloadend = () => resolve({ data: reader.result as string, mimeType: m.file.type });
          reader.readAsDataURL(m.file);
        });
      }));

      const result = await analyzeVehicle(finalVehicleInfo, scanData, mediaData, undefined, labTestData);
      setDiagnosisResult(result);
      
      // Upload media to Firebase Storage for persistence (skip in demo mode)
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0 && user && !isDemoMode) {
        try {
          mediaUrls = await uploadMedia(mediaFiles, user.uid);
          setLastMediaUrls(mediaUrls);
        } catch (uploadError: any) {
          console.error('Media upload failed:', uploadError);
          if (uploadError?.code === 'storage/retry-limit-exceeded' || uploadError?.code === 'storage/unauthorized') {
            toast.error('Storage not configured. Please enable Firebase Storage in your console. Diagnosis was saved without media.');
          } else {
            toast.error('Some media files failed to upload, but diagnosis was saved.');
          }
        }
      }

      if (user && !isDemoMode) {
        // Fetch shop info from user profile
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const shopInfo = userDoc.exists() ? (userDoc.data().shopInfo || null) : null;

        // Generate a unique share token
        const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Save to Firestore
        const diagnosisRecord: Omit<DiagnosisRecord, 'id'> = {
          uid: user.uid,
          vehicleInfo: finalVehicleInfo,
          scanData,
          result,
          mediaUrls,
          createdAt: serverTimestamp() as any,
          shopInfo,
          shareToken
        };
        
        try {
          console.log("Saving diagnosis record:", JSON.stringify(diagnosisRecord, null, 2));
          const docRef = await addDoc(collection(db, 'diagnoses'), cleanObject(diagnosisRecord));
          setLastDiagnosisId(docRef.id);
          toast.success('Diagnosis saved to history!');
          
          // State Persistence for My Garage
          if (finalVehicleInfo.vin || (finalVehicleInfo.make && finalVehicleInfo.model)) {
            const vehiclesRef = collection(db, 'vehicles');
            let q;
            if (finalVehicleInfo.vin) {
              q = query(vehiclesRef, where('userId', '==', user.uid), where('vin', '==', finalVehicleInfo.vin));
            } else {
              q = query(vehiclesRef, where('userId', '==', user.uid), where('make', '==', finalVehicleInfo.make), where('model', '==', finalVehicleInfo.model), where('year', '==', Number(finalVehicleInfo.year) || new Date().getFullYear()));
            }
            const snap = await getDocs(q);
            
            // Calculate Volumetric Efficiency (VE) if applicable
            let calculatedVE: number | undefined = undefined;
            if (scanData?.maf && scanData?.intakeAirTemp && scanData?.rpm) {
               // Approximate VE: VE = (MAF * (IAT + 273.15) * 287.05) / (Displacement * RPM / 2 * Pressure)
               // Since we don't have exact displacement, but we might have calculated it or AI did.
               // We will just store what VE we get if we know it, otherwise leave it.
               // We can extract VE from AI summary if needed, but for now we will check if it was part of labTestData or results.
               // If not, we just store the available metrics.
            }

            const currentMileage = Number(finalVehicleInfo.mileage) || 0;
            
            const newHistoryItem = {
              date: new Date().toISOString(),
              mileage: currentMileage,
              dtcCount: scanData?.dtcs?.length || 0,
              misfires: scanData?.totalMisfires || 0,
              fuelTrimShortTerm: scanData?.liveData?.fuelTrimShortTerm ?? scanData?.fuelTrimShortTerm,
              fuelTrimLongTerm: scanData?.liveData?.fuelTrimLongTerm ?? scanData?.fuelTrimLongTerm,
              overallSeverity: result.overallSeverity || 'Unknown',
              diagnosisId: docRef.id
            };

            if (!snap.empty) {
              const vehicleDoc = snap.docs[0];
              const existingData = vehicleDoc.data();
              const history = existingData.scanHistory || [];
              await updateDoc(vehicleDoc.ref, {
                scanHistory: [...history, newHistoryItem],
                mileage: Math.max(existingData.mileage || 0, currentMileage)
              });
            } else {
              // Add a new vehicle to My Garage automatically
              await addDoc(vehiclesRef, {
                userId: user.uid,
                make: finalVehicleInfo.make,
                model: finalVehicleInfo.model,
                year: Number(finalVehicleInfo.year) || new Date().getFullYear(),
                vin: finalVehicleInfo.vin || '',
                mileage: currentMileage,
                maintenanceSchedule: [], 
                scanHistory: [newHistoryItem],
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'diagnoses');
        }
      } else if (isDemoMode) {
        toast.info('Demo diagnosis complete! Results are not saved.');
      }

      setWizardStep(4); // Show results
    } catch (error: any) {
      console.error(error);
      toast.error(`Analysis Failed: ${error.message || 'Please try again.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetDiagnosis = () => {
    setWizardStep(0);
    setVehicleInfo({ make: '', model: '', year: '', symptoms: '', customPrompt: '' });
    setScanData(null);
    setMediaFiles([]);
    setDiagnosisResult(null);
    setLastMediaUrls([]);
    setSelectedRecord(null);
    if (isDemoMode) {
      setIsDemoMode(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Logo size="xl" />
          </div>
          
          <Logo size="lg" />
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              <AlternatingText text="Engine Vitals" />
            </h1>
            <p className="text-sm text-[#A3A3A3]">
              Connect your vehicle's data to our AI engine for professional-grade diagnostics.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {authMode === 'social' ? (
              <motion.div
                key="social"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                <button
                  onClick={handleLogin}
                  className="w-full bg-white text-black py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#E5E5E5] transition-all"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                  Continue with Google
                </button>
                <button
                  onClick={() => setAuthMode('email-login')}
                  className="w-full bg-[#1A1A1A] border border-[#262626] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#262626] transition-all"
                >
                  <Mail className="w-5 h-5 text-primary" />
                  Sign In with Email
                </button>
                <button
                  onClick={() => setAuthMode('email-signup')}
                  className="w-full bg-[#1A1A1A] border border-[#262626] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#262626] transition-all"
                >
                  <UserIconAlt className="w-5 h-5 text-primary" />
                  Create an Account
                </button>
                
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#262626]"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-[#141414] px-4 text-[#525252]">Or</span></div>
                </div>

                <button
                  onClick={() => {
                    setIsDemoMode(true);
                    setVehicleInfo({
                      year: '2018',
                      make: 'Toyota',
                      model: 'Camry',
                      vin: '5T1BK1FK1JU000000',
                      mileage: '85,000',
                      symptoms: 'Rough idle, check engine light is on, whistling sound from engine bay, poor fuel economy.',
                      customPrompt: 'Focus on the fuel system and check for vacuum leaks.'
                    });
                    setScanData({
                      dtcs: ['P0300', 'P0171'],
                      fuelTrimShortTerm: 15.4,
                      fuelTrimLongTerm: 22.1,
                      coolantTemp: 92,
                      rpm: 850,
                      load: 18.5,
                      maf: 4.2,
                      o2Voltage: 0.12
                    });
                    setWizardStep(3);
                    toast.success('Entering Demo Mode...');
                  }}
                  className="w-full bg-primary/10 border border-primary/20 text-primary py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-primary/20 transition-all"
                >
                  <Zap className="w-5 h-5" />
                  Try Demo Mode
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <button 
                  onClick={() => setAuthMode('social')}
                  className="text-xs font-bold uppercase tracking-widest text-[#525252] hover:text-white flex items-center gap-2 mb-4"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Social
                </button>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {authMode === 'email-signup' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#525252] ml-1">Full Name</label>
                      <div className="relative">
                        <UserIconAlt className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404040]" />
                        <input 
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#525252] ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404040]" />
                      <input 
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#525252] ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404040]" />
                      <input 
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-12 pr-4 py-3 text-white focus:border-primary outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full bg-primary text-black py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-primary/80 transition-all disabled:opacity-50"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {authMode === 'email-login' ? 'Sign In' : 'Create Account'}
                        <ArrowRightAlt className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center">
                  <button 
                    onClick={() => setAuthMode(authMode === 'email-login' ? 'email-signup' : 'email-login')}
                    className="text-xs text-[#A3A3A3] hover:text-primary transition-colors"
                  >
                    {authMode === 'email-login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold">
            Secure AI Diagnostics for Professionals
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans selection:bg-primary selection:text-white">
      <Helmet>
        <title>Engine Vitals - AI Auto Diagnostics</title>
        <meta name="description" content="Connect your OBD2 scanner and get instant, AI-powered vehicle diagnostics, repair estimates, and mechanic recommendations." />
      </Helmet>
      <Toaster position="top-center" richColors />
      
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        onEvent={handleJoyrideCallback}
        options={{
          primaryColor: '#22c55e',
          backgroundColor: '#141414',
          textColor: '#fff',
          arrowColor: '#141414',
          overlayColor: 'rgba(0, 0, 0, 0.8)',
          showProgress: true,
          buttons: ['skip', 'back', 'close', 'primary']
        }}
        styles={{
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonPrimary: {
            backgroundColor: '#22c55e',
            borderRadius: '8px',
            fontWeight: 'bold',
          },
          buttonBack: {
            color: '#a3a3a3',
          },
          buttonSkip: {
            color: '#a3a3a3',
          }
        }}
      />
      <ReloadPrompt />

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#262626] bg-[#141414] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-bold tracking-widest uppercase text-sm">Engine Vitals</span>
        </div>
        <div className="flex items-center gap-4">
          {isInstallable && (
            <button onClick={handleInstallClick} className="text-[#525252] hover:text-primary">
              <Download className="w-5 h-5" />
            </button>
          )}
          {user ? (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#262626]">
              <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <button 
              onClick={() => setIsDemoMode(false)}
              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Rail / Bottom Bar */}
      <nav className="fixed bottom-0 left-0 w-full h-16 md:h-full md:w-20 md:top-0 bg-[#141414] border-t md:border-t-0 md:border-r border-[#262626] flex flex-row md:flex-col items-center justify-around md:justify-start py-2 md:py-8 md:gap-8 z-50">
        <div className="hidden md:block">
          <Logo size="sm" />
        </div>
        
        <NavButton 
          icon={<Activity className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'diagnose'} 
          onClick={() => setActiveTab('diagnose')} 
          label="Diagnose"
        />
        <NavButton 
          icon={<MessageSquare className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'ask'} 
          onClick={() => setActiveTab('ask')} 
          label="Ask AI"
        />
        <NavButton 
          icon={<History className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')} 
          label="Activity"
          disabled={!user && !isDemoMode}
        />
        <NavButton 
          icon={<Car className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'garage'} 
          onClick={() => setActiveTab('garage')} 
          label="Garage"
          disabled={!user}
        />
        <NavButton 
          icon={<ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'shops'} 
          onClick={() => setActiveTab('shops')} 
          label="Shops"
        />
        <NavButton 
          icon={<LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          label="Dashboard"
          disabled={!user}
        />
        <NavButton 
          icon={<SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />} 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          label="Settings"
          disabled={!user}
        />
        <div className="mt-auto hidden md:flex flex-col gap-8 items-center">
          {isInstallable && (
            <button 
              onClick={handleInstallClick}
              className="text-[#525252] hover:text-primary transition-colors p-3 rounded-xl hover:bg-primary/10 relative group"
              title="Install App"
            >
              <Download className="w-6 h-6" />
              <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#262626] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Install App
              </span>
            </button>
          )}
          {user && (
            <button 
              onClick={handleLogout}
              className="text-[#525252] hover:text-red-500 transition-colors p-3 rounded-xl hover:bg-red-500/10"
            >
              <LogOut className="w-6 h-6" />
            </button>
          )}
          {user ? (
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#262626]">
              <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <button 
              onClick={() => setIsDemoMode(false)}
              className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
              title="Exit Demo Mode"
            >
              <LogIn className="w-5 h-5" />
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-24 pt-6 md:pt-8 md:pb-8 md:ml-20 px-4 md:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'diagnose' && (
            <motion.div
              key="diagnose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                    <AlternatingText text="Engine Vitals" />
                  </h1>
                  <p className="max-w-2xl text-[#A3A3A3] text-sm md:text-base">
                    {isDemoMode ? (
                      <span className="flex items-center gap-2 text-primary font-bold">
                        <Zap className="w-4 h-4 fill-primary" /> Demo Mode Active
                      </span>
                    ) : (
                      <span>
                        Welcome back, <span className="text-white font-medium">{user?.displayName}</span>. Professional-grade vehicle diagnostics powered by AI.
                      </span>
                    )}
                  </p>
                </div>
                {wizardStep > 0 && wizardStep < 4 && (
                  <button 
                    onClick={resetDiagnosis}
                    className="text-[#A3A3A3] hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Reset
                  </button>
                )}
              </header>

              <div className="grid grid-cols-1 gap-8">
                {selectedRecord ? (
                  <DiagnosisResults 
                    result={selectedRecord.result} 
                    onReset={resetDiagnosis} 
                    recordId={selectedRecord.id}
                    userId={user?.uid}
                    mediaUrls={selectedRecord.mediaUrls}
                    vehicleInfo={selectedRecord.vehicleInfo}
                    scanData={selectedRecord.scanData}
                    shopInfo={selectedRecord.shopInfo}
                    onRequestQuote={(id) => {
                      setQuoteDiagnosisId(id);
                      setActiveTab('shops');
                    }}
                  />
                ) : diagnosisResult ? (
                  <DiagnosisResults 
                    result={diagnosisResult} 
                    onReset={resetDiagnosis} 
                    recordId={lastDiagnosisId}
                    userId={user?.uid}
                    mediaUrls={lastMediaUrls}
                    vehicleInfo={vehicleInfo}
                    scanData={scanData}
                    shopInfo={userData?.shopInfo}
                    onRequestQuote={(id) => {
                      setQuoteDiagnosisId(id);
                      setActiveTab('shops');
                    }}
                  />
                ) : (
                  <DiagnosisWizard 
                    step={wizardStep} 
                    setStep={setWizardStep}
                    vehicleInfo={vehicleInfo}
                    setVehicleInfo={setVehicleInfo}
                    scanData={scanData}
                    setScanData={setScanData}
                    mediaFiles={mediaFiles}
                    setMediaFiles={setMediaFiles}
                    onAnalyze={handleStartDiagnosis}
                    isAnalyzing={isAnalyzing}
                    isDemoMode={isDemoMode}
                  />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'ask' && (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MechanicChat />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {isDemoMode ? (
                <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-12 text-center space-y-6 shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                    <History className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    <AlternatingText text="History Unavailable" />
                  </h2>
                  <p className="text-[#A3A3A3] max-w-md mx-auto">
                    Diagnosis history is only available for registered users. Please log in to save and track your vehicle's health over time.
                  </p>
                  <button 
                    onClick={() => setIsDemoMode(false)}
                    className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-[#E5E5E5] transition-all"
                  >
                    Log In to Save History
                  </button>
                </div>
              ) : (
                <HistoryList 
                  user={user!} 
                  onSelect={(record) => {
                    setSelectedRecord(record);
                    setActiveTab('diagnose');
                  }} 
                />
              )}
            </motion.div>
          )}

          {activeTab === 'garage' && (
            <motion.div
              key="garage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {isDemoMode ? (
                <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-12 text-center space-y-6 shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                    <Car className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    <AlternatingText text="Garage Unavailable" />
                  </h2>
                  <p className="text-[#A3A3A3] max-w-md mx-auto">
                    The digital garage is only available for registered users. Please log in to save your vehicles and track maintenance.
                  </p>
                  <button 
                    onClick={() => setIsDemoMode(false)}
                    className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-[#E5E5E5] transition-all"
                  >
                    Log In to Access Garage
                  </button>
                </div>
              ) : (
                <MyGarage user={user!} />
              )}
            </motion.div>
          )}

          {activeTab === 'shops' && (
            <motion.div
              key="shops"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ShopDirectory 
                user={user} 
                quoteDiagnosisId={quoteDiagnosisId} 
                onClearQuote={() => setQuoteDiagnosisId(null)} 
              />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {(userRole === 'mechanic' || userRole === 'admin') ? (
                <ShopDashboard user={user} />
              ) : (
                <UserDashboard user={user} />
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SettingsTab user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      {/* Role Selection Modal for New Users */}
      <AnimatePresence>
        {showRoleSelection && (
          <RoleSelectionModal onSelectRole={handleRoleSelection} />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ icon, active, onClick, label, disabled }: { icon: React.ReactNode; active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "Please log in to access this feature" : label}
      className={cn(
        "relative group flex flex-col items-center gap-1 transition-all duration-300",
        disabled ? "opacity-30 cursor-not-allowed text-[#525252]" : active ? "text-primary" : "text-[#525252] hover:text-[#A3A3A3]"
      )}
    >
      <div className={cn(
        "p-2 md:p-3 rounded-xl transition-all duration-300",
        disabled ? "" : active ? "bg-primary/10" : "group-hover:bg-[#262626]"
      )}>
        {icon}
      </div>
      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {label}
      </span>
      {active && !disabled && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -top-2 md:top-1/2 left-1/2 md:left-auto md:-right-10 -translate-x-1/2 md:translate-x-0 md:-translate-y-1/2 w-8 md:w-1 h-1 md:h-8 bg-primary rounded-b-full md:rounded-b-none md:rounded-l-full shadow-[0_0_10px_rgba(126,211,33,0.5)]"
        />
      )}
    </button>
  );
}
