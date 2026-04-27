import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wrench, Clock, AlertTriangle, CheckCircle2, ChevronRight, Shield, ChevronDown } from 'lucide-react';
import { RepairGuide } from '../types';
import { cn } from '../lib/utils';

interface RepairGuideModalProps {
  guide: RepairGuide;
  isOpen: boolean;
  onClose: () => void;
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

export default function RepairGuideModal({ guide, isOpen, onClose }: RepairGuideModalProps) {
  const allTools = Array.from(new Set(guide.steps.flatMap(s => inferTools(s.description, s.tools))));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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
            className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#262626] flex justify-between items-center bg-[#1A1A1A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{guide.title}</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3]">
                      <Clock className="w-3 h-3" /> {guide.estimatedTime || 'N/A'}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5",
                      guide.difficulty === 'easy' ? "bg-primary/10 text-primary" :
                      guide.difficulty === 'moderate' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                      <Shield className="w-3 h-3" /> {guide.difficulty} difficulty
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-[#262626] rounded-full text-[#525252] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Tools Summary */}
              {allTools.length > 0 && (
                <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#525252] flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Tools Required
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allTools.map((tool, i) => (
                      <span key={i} className="bg-[#0A0A0A] border border-[#262626] text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {guide.steps.map((step, index) => {
                  const inferredTools = inferTools(step.description, step.tools);
                  return (
                  <details key={index} className="group/accordion bg-[#0A0A0A] border border-[#262626] rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#141414] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-xs font-bold text-[#525252] group-hover/accordion:border-primary/50 group-hover/accordion:text-primary transition-all">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <h3 className="text-base font-bold text-white group-hover/accordion:text-primary transition-colors">{step.title}</h3>
                      </div>
                      <ChevronDown className="w-5 h-5 text-[#525252] transition-transform group-open/accordion:rotate-180" />
                    </summary>

                    <div className="p-5 pt-0 space-y-4 border-t border-[#262626]/50 mt-2">
                      <p className="text-[#A3A3A3] leading-relaxed mt-4">{step.description}</p>
                      
                      {step.mediaUrl && (
                        <div className="rounded-2xl overflow-hidden border border-[#262626] bg-[#0A0A0A]">
                          <img 
                            src={step.mediaUrl} 
                            alt={step.title} 
                            className="w-full h-auto object-cover max-h-[400px]"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      
                      {inferredTools.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {inferredTools.map((tool, i) => (
                            <span key={i} className="text-[10px] font-bold uppercase tracking-widest bg-[#262626] text-[#A3A3A3] px-2 py-1 rounded-md flex items-center gap-1">
                              <Wrench className="w-3 h-3" /> {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {step.warning && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200/80 italic">{step.warning}</p>
                        </div>
                      )}
                    </div>
                  </details>
                )})}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center space-y-4 mt-12">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-xl font-bold text-white">Repair Complete!</h3>
                <p className="text-[#A3A3A3] max-w-md mx-auto">
                  Once you've finished these steps, clear any DTC codes and perform a test drive to verify the fix.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
