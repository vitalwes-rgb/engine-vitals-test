import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { DiagnosisRecord } from '../types';
import { Loader2, AlertCircle, Activity, Zap, Shield, Info, ShoppingBag, ExternalLink, MapPin, Phone, Globe, BookOpen, Settings, Mail, AlertTriangle, CheckCircle2, Camera, Video, Book, Clock, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import Logo from './Logo';
import AlternatingText from './AlternatingText';
import RepairGuideModal from './RepairGuideModal';
import { RepairGuide } from '../types';

export default function PublicReport() {
  const { token, id } = useParams<{ token?: string, id?: string }>();
  const [record, setRecord] = useState<DiagnosisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<RepairGuide | null>(null);
  const [expandedGuides, setExpandedGuides] = useState<number[]>([]);

  const toggleGuide = (index: number) => {
    setExpandedGuides(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  useEffect(() => {
    const fetchReport = async () => {
      if (!token && !id) return;
      try {
        if (id) {
          const docRef = doc(db, 'diagnoses', id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            setError('Report not found or you do not have permission to view it.');
          } else {
            setRecord({ id: docSnap.id, ...docSnap.data() } as DiagnosisRecord);
          }
        } else if (token) {
          const q = query(
            collection(db, 'diagnoses'),
            where('shareToken', '==', token),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            setError('Report not found or link has expired.');
          } else {
            setRecord({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as DiagnosisRecord);
          }
        }
      } catch (err) {
        console.error('Error fetching public report:', err);
        setError('Failed to load report. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-[#A3A3A3] animate-pulse">Loading secure report...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-[#A3A3A3] max-w-md">{error || 'This report is no longer available.'}</p>
        <a href="/" className="mt-8 text-primary font-bold hover:underline">Back to Engine Vitals</a>
      </div>
    );
  }

  const { result, vehicleInfo, shopInfo, createdAt } = record;
  const reportDate = createdAt?.seconds ? new Date(createdAt.seconds * 1000) : new Date();

  return (
    <div className="min-h-screen bg-[#050505] text-[#A3A3A3] font-sans selection:bg-primary/30">
      {/* Shop Header */}
      <header className="border-b border-[#1A1A1A] bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {shopInfo?.logoUrl ? (
              <img src={shopInfo.logoUrl} alt={shopInfo.name} className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Logo size="sm" />
            )}
            <div className="h-8 w-px bg-[#1A1A1A] hidden sm:block" />
            <div>
              <h1 className="text-white font-bold leading-none mb-1">
                {shopInfo?.name || <AlternatingText text="Engine Vitals Report" />}
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#525252]">
                Diagnostic Report • {reportDate.toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {shopInfo && (
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              {shopInfo.phone && (
                <a href={`tel:${shopInfo.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Phone className="w-3 h-3" /> {shopInfo.phone}
                </a>
              )}
              {shopInfo.website && (
                <a href={`https://${shopInfo.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Vehicle Info Card */}
        <section className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Activity className="w-48 h-48 text-primary" />
          </div>
          
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">Vehicle Inspected</h2>
            <div className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
              {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
            </div>
            <p className="text-lg text-[#525252] font-medium">
              {vehicleInfo.mileage ? `${vehicleInfo.mileage} miles` : 'Mileage not specified'}
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center md:items-end gap-2">
            <div className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest",
              result.possibleIssues.some(i => i.severity === 'critical') 
                ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                : "bg-primary/10 text-primary border border-primary/20"
            )}>
              {result.possibleIssues.some(i => i.severity === 'critical') ? 'Attention Required' : 'System Analysis Complete'}
            </div>
            <p className="text-[10px] text-[#525252] font-bold uppercase tracking-widest">Report ID: {(token || id || '').slice(0, 8)}</p>
          </div>
        </section>

        {/* AI Summary */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">AI Diagnostic Summary</h3>
          </div>
          <p className="text-2xl text-white font-medium leading-relaxed max-w-4xl">
            {result.summary}
          </p>

          {record.mediaUrls && record.mediaUrls.length > 0 && (
            <div className="pt-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4" /> Media Evidence
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {record.mediaUrls.map((url, i) => (
                  <div key={i} className="flex-shrink-0 w-64 aspect-video rounded-2xl overflow-hidden border border-[#1A1A1A] bg-[#0A0A0A] group relative">
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
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Issues */}
            <section className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Identified Concerns
              </h3>
              <div className="space-y-4">
                {result.possibleIssues.map((issue, i) => (
                  <div key={i} className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-white mb-1">{issue.title}</h4>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          issue.severity === 'critical' ? "bg-red-500/10 text-red-500" :
                          issue.severity === 'high' ? "bg-orange-500/10 text-orange-500" :
                          "bg-yellow-500/10 text-yellow-500"
                        )}>
                          {issue.severity} severity
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{Math.round(issue.probability * 100)}%</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Probability</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{issue.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Diagnostic Workflow */}
            {result.diagnosticWorkflow && result.diagnosticWorkflow.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Diagnostic Workflow
                </h3>
                <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl overflow-hidden divide-y divide-[#1A1A1A]">
                  {result.diagnosticWorkflow.map((step, i) => (
                    <div key={i} className="p-6 flex gap-6 group/step">
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#141414] border border-[#1A1A1A] flex items-center justify-center text-[#525252] font-bold text-xs group-hover/step:border-primary/50 group-hover/step:text-primary transition-all">
                        {i + 1}
                      </div>
                      <div className="flex-grow space-y-2">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{step.step}</h4>
                        <p className="text-[#A3A3A3] text-sm leading-relaxed">{step.description}</p>
                        {step.expectedResult && (
                          <div className="mt-3 p-3 bg-[#050505] border border-primary/10 rounded-lg flex items-start gap-3">
                            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Info className="w-2.5 h-2.5 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Expected Result</p>
                              <p className="text-xs text-[#A3A3A3] italic">{step.expectedResult}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Fixes */}
            <section className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Recommended Action Plan
              </h3>
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl overflow-hidden divide-y divide-[#1A1A1A]">
                {result.recommendedFixes.map((fix, i) => (
                  <div key={i} className="p-6 flex gap-6">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#141414] border border-[#1A1A1A] flex items-center justify-center text-white font-bold text-xs">
                      {i + 1}
                    </div>
                    <div className="flex-grow space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-white font-bold">{fix.step}</h4>
                          {fix.guide && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => toggleGuide(i)}
                                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                              >
                                {expandedGuides.includes(i) ? 'Hide Steps' : 'Show Steps'}
                              </button>
                              <span className="text-[#262626]">|</span>
                              <button 
                                onClick={() => setSelectedGuide(fix.guide!)}
                                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                              >
                                <Book className="w-3 h-3" /> Full Guide
                              </button>
                            </div>
                          )}
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                            fix.difficulty === 'easy' ? "bg-primary/10 text-primary" :
                            fix.difficulty === 'moderate' ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-red-500/10 text-red-500"
                          )}>
                            {fix.difficulty}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{fix.description}</p>
                      </div>

                      {/* Collapsible Guide Steps */}
                      {fix.guide && expandedGuides.includes(i) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 space-y-4 border-t border-[#1A1A1A]">
                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-[#525252]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {fix.guide.estimatedTime || 'N/A'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" /> {fix.guide.steps.length} Steps
                              </span>
                            </div>
                            <div className="space-y-3">
                              {fix.guide.steps.map((step, stepIdx) => (
                                <div key={stepIdx} className="flex gap-3 group/step">
                                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#141414] border border-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-[#525252] group-hover/step:border-primary/50 group-hover/step:text-primary transition-colors">
                                    {stepIdx + 1}
                                  </div>
                                  <div className="space-y-1">
                                    <h5 className="text-xs font-bold text-white/90">{step.title}</h5>
                                    <p className="text-xs text-[#737373] leading-relaxed line-clamp-2 group-hover/step:line-clamp-none transition-all">
                                      {step.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* TSBs */}
            {result.tsbs && result.tsbs.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Technical Service Bulletins
                </h3>
                <div className="space-y-4">
                  {result.tsbs.map((tsb, i) => (
                    <div key={i} className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6 border-l-4 border-yellow-500/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-yellow-500 font-mono">{tsb.id}</span>
                        <h4 className="text-white font-bold">{tsb.title}</h4>
                      </div>
                      <p className="text-sm leading-relaxed">{tsb.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-12">
            {/* Quick Specs */}
            {result.quickSpecs && result.quickSpecs.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Technical Specs
                </h3>
                <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6 space-y-4">
                  {result.quickSpecs.map((spec, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-[#1A1A1A] pb-2 last:border-0 last:pb-0">
                      <span className="text-xs text-[#525252] font-medium">{spec.label}</span>
                      <span className="text-sm text-white font-bold">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Locations */}
            {result.componentLocation && result.componentLocation.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Component Locations
                </h3>
                <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6 space-y-6">
                  {result.componentLocation.map((loc, i) => (
                    <div key={i} className="space-y-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {loc.component}
                      </h4>
                      <p className="text-xs leading-relaxed pl-3.5 border-l border-[#1A1A1A]">
                        {loc.location}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Parts */}
            <section className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Estimated Parts
              </h3>
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6 space-y-4">
                {result.partsNeeded.map((part, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{part.name}</p>
                      <p className="text-[10px] text-[#525252] font-bold uppercase tracking-widest">{part.estimatedPrice || 'Price Varies'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Disclaimer */}
            <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-white font-bold">Professional Disclaimer</h4>
              </div>
              <p className="text-xs text-[#A3A3A3] leading-relaxed">
                Engine Vitals provides diagnostic insights based on information provided and advanced AI analysis. While our system is highly accurate, it is intended for informational purposes only and should not replace professional mechanical advice.
              </p>
              <p className="text-xs text-amber-500/80 mt-3 font-medium italic">
                We strongly recommend seeking a physical inspection by a certified automotive technician for final verification before performing any repairs.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="text-xs max-w-xs">
              Advanced AI-powered vehicle diagnostics for professional mechanics and car enthusiasts.
            </p>
          </div>
          
          {shopInfo && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Contact {shopInfo.name}</h4>
              <div className="space-y-2 text-xs">
                {shopInfo.address && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {shopInfo.address}</p>}
                {shopInfo.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {shopInfo.phone}</p>}
                {shopInfo.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {shopInfo.email}</p>}
              </div>
            </div>
          )}
        </div>
        <div className="max-w-5xl mx-auto px-6 mt-12 pt-8 border-t border-[#1A1A1A] text-[10px] uppercase tracking-widest font-bold text-[#525252] flex justify-between">
          <p>© {new Date().getFullYear()} Engine Vitals</p>
          <p>Confidential Diagnostic Report</p>
        </div>
      </footer>

      {/* Modals */}
      {selectedGuide && (
        <RepairGuideModal 
          guide={selectedGuide} 
          isOpen={!!selectedGuide} 
          onClose={() => setSelectedGuide(null)} 
        />
      )}
    </div>
  );
}
