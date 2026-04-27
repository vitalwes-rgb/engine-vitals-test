import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, ArrowLeft, ArrowRight, Activity, Shield, ChevronRight, ShoppingBag, ExternalLink, RefreshCw, AlertTriangle, Zap, Thermometer, Gauge, Wrench, Share2, MapPin, BookOpen, Settings, FileText, Send, Book, Camera, Video, Clock, DollarSign, Printer, Calendar, Search, ChevronDown, ChevronUp, Store, Star, Phone, Mail, Globe, ShieldCheck } from 'lucide-react';
import { DiagnosisResult, DiagnosisRecord, RepairGuide, VehicleInfo, ScanToolData, Shop, ShopInfo } from '../types';
import { cn, calculateDistance } from '../lib/utils';
import { toast } from 'sonner';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import RepairGuideModal from './RepairGuideModal';
import ShopPickerModal from './ShopPickerModal';
import AlternatingText from './AlternatingText';
import { getDTCExplanation } from '../lib/dtcDictionary';
import ScanDataDisplay from './ScanDataDisplay';

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <section className="space-y-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#525252] hover:text-[#A3A3A3] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4" /> {title}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const inferTools = (description: string, existingTools?: string[]): string[] => {
  if (existingTools && existingTools.length > 0) return existingTools;
  
  const descLower = description.toLowerCase();
  const tools = new Set<string>();
  
  if (descLower.includes('wrench') || descLower.includes('socket') || descLower.includes('ratchet') || descLower.includes('bolt') || descLower.includes('nut')) tools.add('Socket Set');
  if (descLower.includes('screwdriver') || descLower.includes('phillips') || descLower.includes('flathead') || descLower.includes('screw')) tools.add('Screwdriver Set');
  if (descLower.includes('pliers') || descLower.includes('pinch') || descLower.includes('clamp')) tools.add('Pliers');
  if (descLower.includes('multimeter') || descLower.includes('voltage') || descLower.includes('ohm') || descLower.includes('continuity') || descLower.includes('electrical')) tools.add('Multimeter');
  if (descLower.includes('obd') || descLower.includes('scan tool') || descLower.includes('code reader') || descLower.includes('dtc')) tools.add('OBD-II Scanner');
  if (descLower.includes('jack') || descLower.includes('lift') || descLower.includes('hoist') || descLower.includes('raise')) tools.add('Floor Jack & Stands');
  if (descLower.includes('torque')) tools.add('Torque Wrench');
  if (descLower.includes('pry')) tools.add('Pry Bar');
  if (descLower.includes('hammer') || descLower.includes('mallet')) tools.add('Hammer / Mallet');
  if (descLower.includes('drain') || descLower.includes('pan') || descLower.includes('fluid') || descLower.includes('oil')) tools.add('Drain Pan');
  if (descLower.includes('funnel')) tools.add('Funnel');
  if (descLower.includes('gloves') || descLower.includes('safety') || descLower.includes('goggles')) tools.add('Safety Gear');
  if (descLower.includes('cleaner') || descLower.includes('brake clean') || descLower.includes('degreaser')) tools.add('Parts Cleaner');
  if (descLower.includes('rag') || descLower.includes('towel') || descLower.includes('wipe')) tools.add('Shop Towels');
  
  return Array.from(tools);
};

interface DiagnosisResultsProps {
  result: DiagnosisResult;
  onReset: () => void;
  recordId?: string | null;
  userId?: string | null;
  mediaUrls?: string[];
  vehicleInfo?: VehicleInfo;
  scanData?: ScanToolData | null;
  shopInfo?: ShopInfo;
  onRequestQuote?: (recordId: string) => void;
}

export default function DiagnosisResults({ result, onReset, recordId, userId, mediaUrls = [], vehicleInfo, scanData, shopInfo, onRequestQuote }: DiagnosisResultsProps) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<RepairGuide | null>(null);
  const [isShopPickerOpen, setIsShopPickerOpen] = useState(false);
  const [expandedGuides, setExpandedGuides] = useState<number[]>([]);
  const [workflowExpanded, setWorkflowExpanded] = useState(true);
  const [recommendedShops, setRecommendedShops] = useState<Shop[]>([]);

  useEffect(() => {
    const fetchRecommendedShops = async (userLat?: number, userLng?: number) => {
      try {
        const q = query(
          collection(db, 'shops'), 
          where('isPublic', '==', true)
        );
        const querySnapshot = await getDocs(q);
        const shopsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
        
        // Add random score for rotation among tied verified shops
        const shopsWithRandom = shopsData.map(shop => ({
          ...shop,
          _rand: Math.random()
        }));

        shopsWithRandom.sort((a, b) => {
          // If we have user location and both shops have location, 
          // factor in distance for a massive difference (e.g. out of state)
          let distA = 0, distB = 0;
          if (userLat && userLng) {
            distA = a.lat && a.lng ? calculateDistance(userLat, userLng, a.lat, a.lng) : 9999;
            distB = b.lat && b.lng ? calculateDistance(userLat, userLng, b.lat, b.lng) : 9999;
            
            // If one is significantly closer (>25 miles diff), prefer the closer one
            if (Math.abs(distA - distB) > 25) {
                return distA - distB;
            }
          }
          
          // Then prioritize verified shops
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

        // Limit to top 2 for display in the banner
        setRecommendedShops(shopsWithRandom.slice(0, 2));
      } catch (err) {
        console.error('Failed to fetch recommended shops:', err);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchRecommendedShops(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          fetchRecommendedShops(); // fallback if denied
        }
      );
    } else {
      fetchRecommendedShops();
    }
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'CRITICAL': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high':
      case 'HIGH': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium':
      case 'MODERATE': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'low':
      case 'LOW': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'CRITICAL':
      case 'high':
      case 'HIGH': return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
      case 'MODERATE': return <Info className="w-4 h-4" />;
      default: return <CheckCircle2 className="w-4 h-4" />;
    }
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [mediaUrls]);

  const toggleGuide = (index: number) => {
    setExpandedGuides(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  useEffect(() => {
    const fetchShareToken = async () => {
      if (!recordId) return;
      try {
        const docRef = doc(db, 'diagnoses', recordId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setShareToken(docSnap.data().shareToken);
        }
      } catch (err) {
        console.error('Failed to fetch share token:', err);
      }
    };
    fetchShareToken();
  }, [recordId]);

  const handleShare = async () => {
    if (!shareToken) {
      toast.error('Share link not available.');
      return;
    }
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to copy link.');
    }
  };

  const hasCriticalIssue = result.possibleIssues?.some(i => i.severity === 'critical') || false;

  return (
    <div className="space-y-8 pb-20">
      {/* Summary Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Activity className="w-32 h-32 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-3">
                <AlternatingText text="AI Diagnosis Summary" />
                {result.overallSeverity && (
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black tracking-widest border flex items-center gap-1.5", getSeverityColor(result.overallSeverity))}>
                    {getSeverityIcon(result.overallSeverity)}
                    {result.overallSeverity}
                  </span>
                )}
              </h2>
            </div>
            <div className="bg-[#141414] border-l-4 border-primary p-5 md:p-6 rounded-r-2xl mb-6 shadow-lg">
              {(() => {
                // Try to parse explicit format if present
                const primaryMatch = result.summary.match(/Primary Issue:\s*(.*?)(?=Recommended Action:|$)/i);
                const actionMatch = result.summary.match(/Recommended Action:\s*(.*)/i);

                if (primaryMatch && actionMatch) {
                  return (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Primary Issue</span>
                        <span className="text-lg md:text-xl font-medium text-white">{primaryMatch[1].trim()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] block mb-1">Recommended Action</span>
                        <span className="text-base md:text-lg text-[#A3A3A3]">{actionMatch[1].trim()}</span>
                      </div>
                    </div>
                  );
                }

                // Fallback: split by first period to separate issue and action
                const match = result.summary.match(/^([^.]+?\.)\s+(.*)$/);
                if (match) {
                  return (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Primary Issue</span>
                        <span className="text-lg md:text-xl font-medium text-white">{match[1].trim()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] block mb-1">Recommended Action</span>
                        <span className="text-base md:text-lg text-[#A3A3A3]">{match[2].trim()}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <p className="text-lg md:text-xl font-medium text-white max-w-3xl leading-relaxed">
                    {result.summary}
                  </p>
                );
              })()}
            </div>
            {vehicleInfo?.customPrompt && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Your Custom Instructions</p>
                <p className="text-sm text-[#A3A3A3] italic">"{vehicleInfo.customPrompt}"</p>
              </div>
            )}
          </div>
          
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex gap-3">
                <button 
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#262626] text-white rounded-xl font-bold text-sm hover:bg-[#323232] transition-all"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
              </div>
              <button 
                onClick={() => setIsShopPickerOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#262626] text-white rounded-xl font-bold text-sm hover:bg-[#323232] transition-all"
              >
                <Send className="w-4 h-4" /> Send to Shop
              </button>
              {hasCriticalIssue && (
              <button 
                onClick={() => window.open('https://www.google.com/maps/search/mechanic+near+me', '_blank')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all"
              >
                <MapPin className="w-4 h-4" /> Find a Mechanic
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Recommended Shops Banner */}
      {recommendedShops.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-widest text-sm">Recommended Partners</h3>
              <p className="text-sm text-[#A3A3A3]">Verified local shops ready to help</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedShops.map(shop => (
              <div key={shop.id} className="bg-[#141414] border border-white/5 rounded-2xl p-4 hover:border-primary/50 transition-all flex items-start gap-4 group">
                {shop.logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] border border-white/10 flex items-center justify-center shrink-0 p-1">
                    <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] border border-white/10 flex items-center justify-center shrink-0 text-lg font-bold text-primary">
                    {shop.name[0]}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-white truncate pr-2 flex items-center gap-2">
                      {shop.name}
                      {shop.isVerified && (
                        <span className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full" title="Verified AutoAI Partner">
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      )}
                    </h4>
                    {shop.rating > 0 && (
                      <div className="flex items-center gap-1 text-primary shrink-0">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs font-bold">{shop.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  {shop.address && (
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#A3A3A3] hover:text-primary transition-colors flex items-center gap-1 mb-3 group/link"
                    >
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{shop.address}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                    </a>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsShopPickerOpen(true)}
                      className="flex-1 bg-primary text-black py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-3 h-3" /> Send Report
                    </button>
                    {shop.phone && (
                      <a 
                        href={`tel:${shop.phone}`}
                        className="p-2 border border-white/10 rounded-lg hover:border-primary/50 hover:text-primary transition-all text-[#A3A3A3]"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {mediaUrls.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-4 relative group/carousel shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
              <Camera className="w-4 h-4" /> Media Evidence
            </h3>
            {mediaUrls.length > 1 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => scroll('left')}
                  className={cn(
                    "p-1.5 rounded-lg bg-[#0A0A0A] border border-[#262626] text-[#525252] hover:text-white hover:border-primary transition-all",
                    !showLeftArrow && "opacity-30 cursor-not-allowed"
                  )}
                  disabled={!showLeftArrow}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => scroll('right')}
                  className={cn(
                    "p-1.5 rounded-lg bg-[#0A0A0A] border border-[#262626] text-[#525252] hover:text-white hover:border-primary transition-all",
                    !showRightArrow && "opacity-30 cursor-not-allowed"
                  )}
                  disabled={!showRightArrow}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
          >
            {mediaUrls.map((url, i) => (
              <div key={i} className="flex-shrink-0 w-64 aspect-video rounded-xl overflow-hidden border border-[#262626] bg-[#0A0A0A] group relative">
                {url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov') ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <Video className="w-8 h-8 text-[#404040]" />
                    <video src={url} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  </div>
                ) : (
                  <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => window.open(url, '_blank')}
                    className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Possible Issues & Fixes */}
        <div className="lg:col-span-2 space-y-8">
          {scanData && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <Activity className="w-4 h-4" /> Scan Data
              </h3>
              <ScanDataDisplay data={scanData} />
            </section>
          )}

          {/* Possible Issues */}
          <CollapsibleSection title="Possible Issues" icon={AlertTriangle} defaultOpen={true}>
            <div className="grid grid-cols-1 gap-4">
              {result.possibleIssues?.map((issue, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 hover:border-primary/30 transition-all group shadow-xl"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{issue.title}</h4>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          issue.severity === 'critical' ? "bg-red-500/10 text-red-500" :
                          issue.severity === 'high' ? "bg-orange-500/10 text-orange-500" :
                          issue.severity === 'medium' ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-blue-500/10 text-blue-500"
                        )}>
                          {issue.severity} severity
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">
                          {Math.round((issue.probability > 1 ? issue.probability / 100 : (issue.probability || 0)) * 100)}% Probability
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[#0A0A0A] border border-[#262626] flex items-center justify-center">
                      <div className="relative w-8 h-8">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            className="text-[#262626]"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            strokeDasharray={88}
                            strokeDashoffset={88 - (88 * (issue.probability > 1 ? issue.probability / 100 : (issue.probability || 0)))}
                            className="text-primary"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="text-[#A3A3A3] text-sm leading-relaxed">{issue.description}</p>
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Diagnostic Workflow */}
          {result.diagnosticWorkflow && result.diagnosticWorkflow.length > 0 && (
            <section className="space-y-4">
              <button 
                onClick={() => setWorkflowExpanded(!workflowExpanded)}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#525252] hover:text-[#A3A3A3] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Diagnostic Workflow for Mechanics
                </span>
                {workflowExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {workflowExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl overflow-hidden mt-4 shadow-xl">
                      {result.diagnosticWorkflow?.map((step, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                          "p-6 flex gap-6 group/step",
                          i !== (result.diagnosticWorkflow?.length || 1) - 1 && "border-b border-[#262626]"
                        )}>
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0A0A0A] border border-[#262626] flex items-center justify-center text-[#525252] font-bold text-sm group-hover/step:border-primary/50 group-hover/step:text-primary transition-all">
                            {i + 1}
                          </div>
                          <div className="flex-grow space-y-2">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">{step.step}</h4>
                            <p className="text-[#A3A3A3] text-sm leading-relaxed">{step.description}</p>
                            {step.expectedResult && (
                              <div className="mt-3 p-3 bg-[#0A0A0A] border border-primary/10 rounded-lg flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Info className="w-3 h-3 text-primary" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Expected Result</p>
                                  <p className="text-xs text-[#A3A3A3] italic">{step.expectedResult}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Recommended Fixes */}
          {result.recommendedFixes && result.recommendedFixes.length > 0 && (
          <CollapsibleSection title="Recommended Fixes" icon={CheckCircle2} defaultOpen={true}>
            <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
              {result.recommendedFixes?.map((fix, i) => (
                <div key={i} className={cn(
                  "p-6 flex gap-6 group/fix",
                  i !== (result.recommendedFixes?.length || 1) - 1 && "border-b border-[#262626]"
                )}>
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#0A0A0A] border border-[#262626] flex items-center justify-center text-white font-bold text-lg group-hover/fix:border-primary/50 group-hover/fix:text-primary transition-all shadow-inner">
                    {i + 1}
                  </div>
                  <div className="flex-grow space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-bold text-white leading-tight">{fix.step}</h4>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                            fix.difficulty === 'easy' ? "bg-primary/10 text-primary" :
                            fix.difficulty === 'moderate' ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-red-500/10 text-red-500"
                          )}>
                            {fix.difficulty}
                          </span>
                        </div>
                        {fix.estimatedCost && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252] bg-[#0A0A0A] px-2 py-1 rounded border border-[#262626]">
                            Est. {fix.estimatedCost}
                          </span>
                        )}
                      </div>
                      <p className="text-[#A3A3A3] text-sm leading-relaxed max-w-2xl">{fix.description}</p>

                      {fix.recommendShop && (
                        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-4 items-start">
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Info className="w-4 h-4 text-red-500" />
                          </div>
                          <div className="space-y-2">
                             <p className="text-sm text-red-100 font-medium">Because of the severe complexity and required tools for this procedure, we strictly advise taking this vehicle to a certified shop.</p>
                             <button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth'})} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                               Find Local Shops Near Me
                             </button>
                          </div>
                        </div>
                      )}
                      
                      {fix.guide && (
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button 
                            onClick={() => toggleGuide(i)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm",
                              expandedGuides.includes(i) 
                                ? "bg-primary/10 border-primary/30 text-primary" 
                                : "bg-[#1A1A1A] border-[#262626] text-[#A3A3A3] hover:text-white hover:border-[#404040]"
                            )}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            {expandedGuides.includes(i) ? 'Hide Repair Steps' : 'View Repair Steps'}
                            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform ml-1", expandedGuides.includes(i) && "rotate-90")} />
                          </button>
                          <button 
                            onClick={() => setSelectedGuide(fix.guide!)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#525252] hover:text-primary transition-all group/modal"
                          >
                            <ExternalLink className="w-3.5 h-3.5 group-hover/modal:scale-110 transition-transform" />
                            Full Modal Guide
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Guide Steps */}
                    {fix.guide && expandedGuides.includes(i) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-8 mt-6 space-y-8 border-t border-[#262626]">
                          {fix.guide.title && (
                            <h4 className="text-2xl font-black text-white tracking-tight border-l-4 border-primary pl-4 py-1">{fix.guide.title}</h4>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#525252] flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Time Estimate
                              </span>
                              <span className="text-sm font-bold text-white">{fix.guide.estimatedTime || 'N/A'}</span>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#525252] flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Difficulty
                              </span>
                              <span className={cn(
                                "text-sm font-bold capitalize",
                                fix.guide.difficulty === 'easy' ? "text-primary" :
                                fix.guide.difficulty === 'moderate' ? "text-yellow-500" :
                                "text-red-500"
                              )}>
                                {fix.guide.difficulty}
                              </span>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#525252] flex items-center gap-1">
                                <Wrench className="w-3 h-3" /> Complexity
                              </span>
                              <span className="text-sm font-bold text-white">{fix.guide.steps.length} Steps</span>
                            </div>
                          </div>

                          {/* Tools Summary in Collapsible */}
                          {fix.guide.steps.some(s => inferTools(s.description, s.tools).length > 0) && (
                            <div className="p-5 bg-[#0A0A0A] border border-[#262626] rounded-2xl space-y-3">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                                <Wrench className="w-4 h-4" /> Required Tools for this Repair
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(fix.guide.steps.flatMap(s => inferTools(s.description, s.tools)))).map((tool, tIdx) => (
                                  <span key={tIdx} className="text-[10px] text-white bg-[#141414] px-3 py-2 rounded-lg border border-[#262626] flex items-center gap-2 hover:border-primary/30 transition-colors">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {tool}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-4">
                            {fix.guide.steps.map((step, stepIdx) => {
                              const inferredTools = inferTools(step.description, step.tools);
                              return (
                              <details key={stepIdx} className="group/accordion bg-[#0A0A0A] border border-[#262626] rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                                <summary className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#141414] transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-xs font-bold text-[#525252] group-hover/accordion:border-primary/50 group-hover/accordion:text-primary transition-all">
                                      {String(stepIdx + 1).padStart(2, '0')}
                                    </div>
                                    <h5 className="text-sm font-bold text-white group-hover/accordion:text-primary transition-colors">{step.title}</h5>
                                  </div>
                                  <ChevronDown className="w-4 h-4 text-[#525252] transition-transform group-open/accordion:rotate-180" />
                                </summary>
                                
                                <div className="p-5 pt-0 space-y-4 border-t border-[#262626]/50 mt-2">
                                  <p className="text-sm text-[#A3A3A3] leading-relaxed mt-4">
                                    {step.description}
                                  </p>
                                  
                                  {step.mediaUrl && (
                                    <div className="rounded-xl overflow-hidden border border-[#262626] bg-[#0A0A0A] max-w-md shadow-lg">
                                      <img 
                                        src={step.mediaUrl} 
                                        alt={step.title} 
                                        className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  )}
                                  
                                  <div className="flex flex-wrap gap-4">
                                    {inferredTools.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {inferredTools.map((tool, tIdx) => (
                                          <span key={tIdx} className="text-[9px] font-bold uppercase tracking-widest bg-[#141414] text-[#737373] px-2 py-1 rounded border border-[#262626] flex items-center gap-1.5">
                                            <Wrench className="w-3 h-3" /> {tool}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {step.warning && (
                                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-start gap-3 w-full">
                                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-red-500/70">Safety Warning</p>
                                          <p className="text-xs text-red-200/70 italic">{step.warning}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </details>
                            )})}
                          </div>

                          <button 
                            onClick={() => setSelectedGuide(fix.guide!)}
                            className="w-full py-4 bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] rounded-2xl text-[10px] font-bold uppercase tracking-widest text-primary flex items-center justify-center gap-3 transition-all group shadow-lg"
                          >
                            <Book className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Launch Interactive Repair Manual
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
          )}

          {/* TSBs & Recalls */}
          {result.tsbs && result.tsbs.length > 0 && (
            <CollapsibleSection title="TSBs & Recalls" icon={BookOpen} defaultOpen={false}>
              <div className="grid grid-cols-1 gap-4">
                {result.tsbs?.map((tsb, i) => (
                  <div key={i} className="bg-[#141414] border border-[#262626] rounded-2xl p-6 border-l-4 border-yellow-500/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-yellow-500 font-mono">{tsb.id}</span>
                      <h4 className="text-white font-bold">{tsb.title}</h4>
                    </div>
                    <p className="text-sm text-[#A3A3A3] leading-relaxed">{tsb.description}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Right Column: Parts, Specs, Locations */}
        <div className="space-y-8">
          {result.predictiveMaintenance && result.predictiveMaintenance.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Predictive Maintenance
              </h3>
              <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
                <div className="divide-y divide-[#262626]">
                  {result.predictiveMaintenance?.map((item, i) => (
                    <div key={i} className="p-4 sm:p-6 hover:bg-[#1A1A1A] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-white mb-1">{item.service}</h4>
                          <p className="text-sm text-[#A3A3A3] leading-relaxed">{item.description}</p>
                        </div>
                        <div className="bg-[#262626] text-white px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                          {item.mileageDue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Estimated Repair Cost */}
          {result.costEstimate && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Fair Price Estimate
              </h3>
              <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
                <div className="p-6 bg-primary/5 border-b border-[#262626]">
                  <p className="text-xs text-[#A3A3A3] mb-1">Total Estimated Cost</p>
                  <div className="text-4xl font-black text-white tracking-tight mb-4">
                    ${result.costEstimate.totalEstimatedCostRange?.min || 0} - ${result.costEstimate.totalEstimatedCostRange?.max || 0}
                  </div>
                  
                  {/* Visual Cost Breakdown Bar */}
                  {(() => {
                    const parts = result.costEstimate.totalPartsCost || 0;
                    const labor = result.costEstimate.totalLaborCostRange?.max || 0;
                    const tax = result.costEstimate.taxAmountRange?.max || 0;
                    const total = parts + labor + tax;
                    if (total === 0) return null;
                    
                    const partsPct = (parts / total) * 100;
                    const laborPct = (labor / total) * 100;
                    const taxPct = (tax / total) * 100;
                    
                    return (
                      <div className="space-y-2">
                        <div className="h-2 w-full flex rounded-full overflow-hidden">
                          <div style={{ width: `${partsPct}%` }} className="bg-blue-500" title="Parts" />
                          <div style={{ width: `${laborPct}%` }} className="bg-orange-500" title="Labor" />
                          <div style={{ width: `${taxPct}%` }} className="bg-gray-500" title="Tax" />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-blue-500">Parts {Math.round(partsPct)}%</span>
                          <span className="text-orange-500">Labor {Math.round(laborPct)}%</span>
                          <span className="text-gray-500">Tax {Math.round(taxPct)}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#A3A3A3] flex items-center gap-2">
                        <Wrench className="w-4 h-4" /> Parts Cost
                      </span>
                      <span className="font-bold text-white">${result.costEstimate.totalPartsCost}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#A3A3A3] flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Labor Cost
                      </span>
                      <span className="font-bold text-white">${result.costEstimate.totalLaborCostRange?.min || 0} - ${result.costEstimate.totalLaborCostRange?.max || 0}</span>
                    </div>
                    <div className="pl-6 text-[10px] text-[#525252] uppercase tracking-widest">
                      {result.costEstimate.laborHours} hr @ ${result.costEstimate.laborRateRange?.min || 0}-${result.costEstimate.laborRateRange?.max || 0}/hr
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2 border-t border-[#262626]">
                      <span className="text-[#A3A3A3] flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Estimated Tax ({result.costEstimate.taxRate}%)
                      </span>
                      <span className="font-bold text-white">${result.costEstimate.taxAmountRange?.min || 0} - ${result.costEstimate.taxAmountRange?.max || 0}</span>
                    </div>
                  </div>

                  {result.costEstimate.negotiationTips && result.costEstimate.negotiationTips.length > 0 && (
                    <div className="pt-6 border-t border-[#262626] space-y-3">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Negotiation Tips
                      </h4>
                      <ul className="space-y-2">
                        {result.costEstimate?.negotiationTips?.map((tip, i) => (
                          <li key={i} className="text-xs text-[#A3A3A3] flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span className="leading-relaxed">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Quick Specs */}
          {result.quickSpecs && result.quickSpecs.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <Settings className="w-4 h-4" /> Quick Specs
              </h3>
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
                <div className="grid grid-cols-1 gap-4">
                  {result.quickSpecs?.map((spec, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-[#262626] pb-2 last:border-0 last:pb-0">
                      <span className="text-xs text-[#525252] font-medium">{spec.label}</span>
                      <span className="text-sm text-white font-bold">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Component Locations */}
          {result.componentLocation && result.componentLocation.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Component Locations
              </h3>

              <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
                {result.componentLocation?.map((loc, i) => (
                  <div key={i} className="space-y-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {loc.component}
                    </h4>
                    <p className="text-xs text-[#A3A3A3] leading-relaxed pl-3.5 border-l border-[#262626]">
                      {loc.location}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Required Parts */}
          <CollapsibleSection title="Required Parts" icon={ShoppingBag} defaultOpen={true}>
            <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
              {result.partsNeeded?.map((part, i) => (
                <div key={i} className="flex justify-between items-center group">
                  <div className="space-y-0.5">
                    <p className="text-white font-medium group-hover:text-primary transition-colors">{part.name}</p>
                    <p className="text-xs text-[#525252]">{part.estimatedPrice || "Price varies"}</p>
                  </div>
                  {part.link ? (
                    <a 
                      href={part.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-[#A3A3A3] hover:text-white hover:border-primary transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <button 
                      onClick={() => {
                        const affiliateTag = (import.meta as any).env.VITE_AMAZON_AFFILIATE_TAG || 'autofixai-20';
                        const searchQuery = encodeURIComponent(`${part.name} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''} ${vehicleInfo?.year || ''}`.trim());
                        window.open(`https://www.amazon.com/s?k=${searchQuery}&tag=${affiliateTag}`, '_blank');
                      }}
                      className="p-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-[#A3A3A3] hover:text-white hover:border-primary transition-all"
                      title="Buy on Amazon"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={() => {
                  const affiliateTag = (import.meta as any).env.VITE_AMAZON_AFFILIATE_TAG || 'autofixai-20';
                  const partNames = result.partsNeeded?.map(p => p.name).join(' ') || '';
                  const searchQuery = encodeURIComponent(`${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''} ${partNames}`.trim().substring(0, 100));
                  window.open(`https://www.amazon.com/s?k=${searchQuery}&tag=${affiliateTag}`, '_blank');
                }}
                className="w-full bg-primary/10 hover:bg-primary/20 text-primary py-3 rounded-xl font-bold text-sm transition-all mt-4"
              >
                Shop All Parts
              </button>
            </div>
          </CollapsibleSection>

          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
              <Shield className="w-4 h-4" /> Professional Disclaimer
            </h3>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-white font-bold">Important Notice</h4>
              </div>
              <p className="text-sm text-[#A3A3A3] leading-relaxed">
                Engine Vitals provides diagnostic insights based on information provided and advanced AI analysis. While our system is highly accurate, it is intended for informational purposes only and should not replace professional mechanical advice.
              </p>
              <p className="text-sm text-amber-500/80 mt-3 font-medium italic">
                We strongly recommend seeking a physical inspection by a certified automotive technician for final verification before performing any repairs.
              </p>
            </div>
          </section>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            {recordId && onRequestQuote && (
              <button 
                onClick={() => onRequestQuote(recordId)}
                className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(126,211,33,0.3)]"
              >
                <Store className="w-4 h-4" /> Get Quotes from Local Shops
              </button>
            )}
            <button 
              onClick={onReset}
              className="w-full sm:flex-1 bg-[#262626] hover:bg-[#323232] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> New Diagnosis
            </button>
          </div>
        </div>
      </div>
      {/* Modals */}
      {selectedGuide && (
        <RepairGuideModal 
          guide={selectedGuide} 
          isOpen={!!selectedGuide} 
          onClose={() => setSelectedGuide(null)} 
        />
      )}

      {recordId && userId && (
        <ShopPickerModal 
          diagnosisId={recordId} 
          userId={userId} 
          isOpen={isShopPickerOpen} 
          onClose={() => setIsShopPickerOpen(false)} 
        />
      )}
    </div>
  );
}
