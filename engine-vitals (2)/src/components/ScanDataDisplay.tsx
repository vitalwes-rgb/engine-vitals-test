import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarRadiusAxis, Radar } from 'recharts';
import { Activity, Thermometer, Gauge, Zap, Info, CheckCircle2, ExternalLink, ChevronRight, ChevronDown, ChevronUp, Loader2, History as HistoryIcon, Clock } from 'lucide-react';
import { ScanToolData, VehicleInfo } from '../types';
import { cn } from '../lib/utils';
import { getDTCExplanation } from '../lib/dtcDictionary';
import { fetchDTCExplanations, consultCylinderAnomaly } from '../services/geminiService';

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

interface ScanDataDisplayProps {
  data: ScanToolData;
  vehicleInfo?: VehicleInfo;
}

export default function ScanDataDisplay({ data, vehicleInfo }: ScanDataDisplayProps) {
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingExplanations, setLoadingExplanations] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [consultingCyl, setConsultingCyl] = useState<number | null>(null);
  const [cylConsultations, setCylConsultations] = useState<Record<number, string>>({});

  useEffect(() => {
    if (data.dtcs && data.dtcs.length > 0) {
      const codesToFetch = data.dtcs.filter(dtc => !getDTCExplanation(dtc).isCommon);
      if (codesToFetch.length > 0) {
        setLoadingExplanations(true);
        fetchDTCExplanations(codesToFetch).then(res => {
          setAiExplanations(res);
          setLoadingExplanations(false);
        }).catch(() => {
          setLoadingExplanations(false);
        });
      }
    }
  }, [data.dtcs]);

  // Accumulate history for live charts
  useEffect(() => {
    if (data.rpm !== undefined || data.load !== undefined || data.coolantTemp !== undefined) {
      setHistory(prev => {
        const next = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          rpm: data.rpm || 0,
          load: data.load || 0,
          temp: data.coolantTemp || 0,
          speed: data.vehicleSpeed || 0
        }];
        // Keep last 30 points
        return next.slice(-30);
      });
    }
  }, [data.rpm, data.load, data.coolantTemp, data.vehicleSpeed]);

  const fuelTrimData = [
    { name: 'Short Term', value: data.fuelTrimShortTerm || 0 },
    { name: 'Long Term', value: data.fuelTrimLongTerm || 0 }
  ];

  const getTrimColor = (value: number) => {
    if (Math.abs(value) > 15) return '#EF4444'; // Red (Secondary)
    if (Math.abs(value) > 10) return '#F59E0B'; // Yellow
    return '#22C55E'; // Green (Primary)
  };

  const handleConsultCylinder = async (cylinder: number, count: number) => {
    if (cylConsultations[cylinder] || !vehicleInfo) return;
    setConsultingCyl(cylinder);
    try {
      const result = await consultCylinderAnomaly(vehicleInfo, cylinder, count);
      setCylConsultations(prev => ({ ...prev, [cylinder]: result }));
    } catch (err) {
      console.error(err);
    } finally {
      setConsultingCyl(null);
    }
  };

  // Ambient Health Aura calculations
  const hasMisfire = (data.totalMisfires && data.totalMisfires > 0) || (data.misfireData && data.misfireData.some(m => m.count > 0));
  const lowVoltage = data.liveData?.controlModuleVoltage !== undefined && data.liveData.controlModuleVoltage < 11.5;
  const isHealthy = !hasMisfire && !lowVoltage && data.misfireMonitorActive; // Very rudimentary check for "Green" state
  
  const auraClass = hasMisfire || lowVoltage 
    ? "shadow-[inset_0_0_100px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20" 
    : isHealthy 
      ? "shadow-[inset_0_0_100px_rgba(34,197,94,0.1)] ring-1 ring-green-500/20" 
      : "bg-transparent ring-1 ring-white/5";

  // Action Island Info
  const vehicleTitle = vehicleInfo ? `${vehicleInfo.year || ''} ${vehicleInfo.make || ''} ${vehicleInfo.model || ''}`.trim() : 'Unknown Vehicle';

  const displayDtcs = data.dtcInfo && data.dtcInfo.length > 0 
    ? Array.from(data.dtcInfo.reduce((acc, dtc) => {
        const precedence: Record<'PERMANENT' | 'STORED' | 'PENDING', number> = { 'PERMANENT': 3, 'STORED': 2, 'PENDING': 1 };
        if (!acc.has(dtc.code) || precedence[dtc.status] > precedence[acc.get(dtc.code)!.status]) {
          acc.set(dtc.code, dtc);
        }
        return acc;
      }, new Map<string, {code: string, status: 'PENDING' | 'STORED' | 'PERMANENT'}>()).values())
    : (data.dtcs && Array.from(new Set(data.dtcs)).map(code => ({ code, status: 'STORED' as const }))) || [];

  return (
    <div className={cn("space-y-6 p-4 md:p-6 rounded-3xl transition-all duration-1000", auraClass)}>
      
      {/* Action Island (Sticky System Tray) */}
      <div className="sticky top-4 z-50 mx-auto max-w-sm rounded-[2rem] bg-black/80 backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-3 flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-white text-xs font-bold leading-tight">{vehicleTitle || (data.vin ? `VIN: ${data.vin}` : 'Live Diagnostics')}</span>
          <span className="text-[#A3A3A3] text-[10px] uppercase tracking-widest leading-tight">{data.protocol || 'OBD-II'} Connected</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-[#525252] leading-tight">Voltage</span>
            <span className={cn(
              "text-xs font-mono font-bold leading-tight", 
              data.liveData?.controlModuleVoltage && data.liveData.controlModuleVoltage < 11.5 ? "text-red-400" : "text-green-400"
            )}>
              {data.liveData?.controlModuleVoltage ? `${data.liveData.controlModuleVoltage}V` : '--V'}
            </span>
          </div>
          
          <div className="w-px h-6 bg-white/10"></div>
          
          <div className="flex flex-col items-center justify-center">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-500",
              data.misfireMonitorActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-red-500"
            )} title={data.misfireMonitorActive ? "Active Monitoring: Yes" : "Active Monitoring: No"}></div>
          </div>
        </div>
      </div>

      {/* Vital Gauges Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RechartsGauge 
          label="Coolant" 
          value={data.coolantTemp} 
          min={-20} max={130} unit="°C"
          color={data.coolantTemp && data.coolantTemp > 105 ? '#EF4444' : data.coolantTemp && data.coolantTemp < 75 ? '#3B82F6' : '#22C55E'}
          icon={<Thermometer className="w-3 h-3" />}
        />
        <RechartsGauge 
          label="Engine RPM" 
          value={data.rpm} 
          min={0} max={8000} unit=""
          color={data.rpm && data.rpm > 5000 ? '#EF4444' : data.rpm && data.rpm > 3000 ? '#F59E0B' : '#22C55E'}
          icon={<Activity className="w-3 h-3" />}
        />
        <RechartsGauge 
          label="Load" 
          value={data.load} 
          min={0} max={100} unit="%"
          color={data.load && data.load > 80 ? '#EF4444' : data.load && data.load > 50 ? '#F59E0B' : '#22C55E'}
          icon={<Gauge className="w-3 h-3" />}
        />
        <RechartsGauge 
          label="O2 Sensor" 
          value={data.o2VoltageBank1Sensor1 ?? data.o2Voltage} 
          min={0} max={1.2} unit="V"
          color={(data.o2VoltageBank1Sensor1 ?? data.o2Voltage) && ((data.o2VoltageBank1Sensor1 ?? data.o2Voltage!) < 0.1 || (data.o2VoltageBank1Sensor1 ?? data.o2Voltage!) > 0.9) ? '#F59E0B' : '#22C55E'}
          icon={<Zap className="w-3 h-3" />}
        />
      </div>

      {/* Network Topology Map */}
      {data.networkTopology && data.networkTopology.length > 0 && (
        <CollapsibleSection title={`Network Topology (${data.networkTopology.filter(m => m.status !== 'offline').length} Responding)`} icon={Activity} defaultOpen={true}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.networkTopology.map((mod) => (
               <div key={mod.address} className={cn(
                 "p-3 rounded-xl border flex flex-col items-center text-center justify-center min-h-[90px] relative overflow-hidden transition-all",
                 mod.status === 'fault' ? "bg-red-500/10 border-red-500/30" :
                 mod.status === 'locked' ? "bg-yellow-500/10 border-yellow-500/30" :
                 mod.status === 'ok' ? "bg-green-500/10 border-green-500/30" :
                 "bg-[#1A1A1A] border-[#262626] opacity-60"
               )}>
                 {mod.status === 'locked' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500" />
                 )}
                 {mod.status === 'fault' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
                 )}
                 <div className="text-[10px] font-mono text-[#737373] mb-1">0x{mod.address}</div>
                 <div className={cn(
                   "text-xs font-bold leading-tight",
                   mod.status === 'fault' ? "text-red-400" :
                   mod.status === 'locked' ? "text-yellow-400" :
                   mod.status === 'ok' ? "text-green-400" :
                   "text-[#525252]"
                 )}>
                   {mod.name}
                 </div>
                 {mod.status === 'offline' && <div className="text-[9px] text-[#525252] mt-1 uppercase tracking-widest">No Comm</div>}
                 {mod.status === 'locked' && <div className="text-[9px] text-yellow-500 mt-1 uppercase tracking-widest">SGW Locked</div>}
                 {mod.status === 'fault' && <div className="text-[9px] text-red-500 mt-1 uppercase tracking-widest">DTCs Found</div>}
                 {mod.status === 'ok' && <div className="text-[9px] text-green-500 mt-1 uppercase tracking-widest">System OK</div>}
               </div>
            ))}
          </div>
          {data.networkTopology.some(m => m.status === 'locked') && (
            <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-xs text-yellow-200">
                <strong>Security Gateway (SGW) Detected:</strong> Your vehicle manufacturer has locked these modules behind a firewall. A bypass cable or authorized gateway subscription is required to read/clear codes from these systems.
              </p>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Live History Chart */}
      {history.length > 1 && (
        <CollapsibleSection title="Live Metric History" icon={HistoryIcon} defaultOpen={true}>
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Clock className="w-24 h-24 text-primary" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis yAxisId="left" orientation="left" stroke="#22C55E" tick={{fontSize: 10}} label={{ value: 'RPM', angle: -90, position: 'insideLeft', fill: '#22C55E', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" tick={{fontSize: 10}} label={{ value: 'Load (%)', angle: 90, position: 'insideRight', fill: '#F59E0B', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="rpm" stroke="#22C55E" fillOpacity={1} fill="url(#colorRpm)" isAnimationActive={false} />
                  <Area yAxisId="right" type="monotone" dataKey="load" stroke="#F59E0B" fillOpacity={1} fill="url(#colorLoad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CollapsibleSection>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.misfireData && data.misfireData.length > 0 && (
          <CollapsibleSection title="Misfire Monitor (Mode 06)" icon={Activity} defaultOpen={true}>
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-lg col-span-1 md:col-span-2 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    data.misfireMonitorActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" : "bg-[#525252]"
                  )} />
                  <span className="text-xs font-mono font-bold text-[#A3A3A3]">
                    {data.misfireMonitorActive ? "STATUS: MONITORING..." : "STATUS: IDLE"}
                  </span>
                </div>
                {data.totalMisfires !== undefined && (
                  <div className="text-xs text-[#A3A3A3] font-mono">
                    TOTAL (Last 1000 Revs): <span className={data.totalMisfires > 0 ? "text-red-400 font-bold" : "text-white"}>{data.totalMisfires}</span>
                  </div>
                )}
              </div>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.misfireData}>
                    <PolarGrid stroke="#262626" />
                    <PolarAngleAxis dataKey="cylinder" tickFormatter={(val) => `Cyl ${val}`} tick={{ fill: '#A3A3A3', fontSize: 12, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 5']} tick={{ fill: '#525252', fontSize: 10 }} />
                    <Radar
                      name="Misfires"
                      dataKey="count"
                      stroke="#EF4444"
                      fill="#EF4444"
                      fillOpacity={0.4}
                      dot={{ r: 4, fill: '#EF4444' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                      formatter={(value: number) => [value, 'Misfires']}
                      labelFormatter={(label) => `Cylinder ${label}`}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Consultation Buttons for Anomalies */}
              {data.misfireData.filter(d => d.count > 0).length > 0 && vehicleInfo && (
                <div className="pt-4 border-t border-[#262626] mt-4">
                  <h4 className="text-xs font-bold text-[#A3A3A3] mb-3 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-primary" /> Anomalies Detected
                  </h4>
                  <div className="flex flex-col gap-3">
                    {data.misfireData.filter(d => d.count > 0).map((cyl) => (
                      <div key={cyl.cylinder} className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleConsultCylinder(cyl.cylinder, cyl.count)}
                          disabled={consultingCyl === cyl.cylinder}
                          className="flex items-center justify-between bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-primary/50 text-left px-4 py-3 rounded-xl transition-all"
                        >
                          <span className="text-sm text-white font-medium">Consult AI: Cylinder {cyl.cylinder}</span>
                          {consultingCyl === cyl.cylinder ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#525252]" />
                          )}
                        </button>
                        {cylConsultations[cyl.cylinder] && (
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 ml-4">
                            <p className="text-sm text-[#D4D4D4] whitespace-pre-wrap">{cylConsultations[cyl.cylinder]}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#525252] mt-4 italic">
                * Misfire counts per cylinder. Values &gt; 0 indicate potential ignition or fuel issues even without a Check Engine Light.
              </p>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Fuel Trims (%)" icon={Activity} defaultOpen={true}>
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-lg">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fuelTrimData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[-25, 25]} tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} width={80} />
                  <Tooltip 
                    cursor={{ fill: '#1A1A1A' }}
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: number) => [`${value}%`, 'Trim']}
                  />
                  <ReferenceLine x={0} stroke="#262626" />
                  <Bar dataKey="value" barSize={24} radius={4}>
                    {fuelTrimData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getTrimColor(entry.value)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-[#525252] mt-4 italic">
              * Values outside ±10% may indicate a vacuum leak or fuel delivery issue.
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Diagnostic Trouble Codes" icon={Zap} defaultOpen={true}>
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-lg">
            <div className="space-y-3">
              {displayDtcs.length > 0 ? (
                displayDtcs.map(({ code, status }, i) => (
                  <details key={i} className="bg-[#141414] border border-white/5 rounded-xl group [&_summary::-webkit-details-marker]:hidden hover:border-primary/30 transition-all shadow-md">
                    <summary className="p-3 flex items-center justify-between cursor-pointer list-none flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {status === 'STORED' && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" title="Active/Stored Code" />}
                        {status === 'PENDING' && <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" title="Pending Code" />}
                        {status === 'PERMANENT' && <div className="w-2 h-2 rounded-full bg-red-900 shadow-[0_0_4px_rgba(127,29,29,0.8)]" title="Permanent Code" />}
                        <span className="text-white font-mono font-bold text-lg">{code}</span>
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border",
                          status === 'PENDING' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                          status === 'STORED' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          "bg-red-900/30 text-red-400 border-red-900/50"
                        )}>
                          {status}
                        </div>
                        <span className="text-xs text-[#525252] group-open:hidden flex items-center gap-1 ml-2">
                          <Info className="w-3 h-3" /> Info
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <a 
                          href={`https://www.obd-codes.com/${code.toLowerCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-[#0A0A0A] border border-white/10 rounded-lg text-[#525252] hover:text-white hover:border-primary transition-all"
                          title="Lookup Code"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <ChevronRight className="w-4 h-4 text-[#525252] transition-transform group-open:rotate-90" />
                      </div>
                    </summary>
                    <div className="px-3 pb-3 pt-1 border-t border-[#262626]/50 mt-1">
                      <p className="text-xs text-[#A3A3A3] leading-relaxed">
                        {aiExplanations[code] || getDTCExplanation(code).description}
                        {loadingExplanations && !aiExplanations[code] && !getDTCExplanation(code).isCommon && (
                          <span className="inline-flex items-center ml-2 text-primary/70">
                            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Fetching AI insight...
                          </span>
                        )}
                      </p>
                      {data.freezeFrames && data.freezeFrames.find(ff => ff.dtc === code) && (
                        <div className="mt-3 p-3 bg-[#0A0A0A] rounded-lg border border-[#262626]">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-2">Freeze Frame Data</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(data.freezeFrames.find(ff => ff.dtc === code) || {}).filter(([k]) => k !== 'dtc').map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="text-[#A3A3A3] capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-white font-mono">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-[#525252]">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No DTCs detected</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {data.liveData && Object.entries(data.liveData).filter(([k, v]) => !['rpm', 'load', 'coolantTemp', 'fuelTrimShortTerm', 'fuelTrimLongTerm'].includes(k) && v !== undefined && v !== null && !Number.isNaN(v)).length > 0 && (
        <CollapsibleSection title="Additional Live Data" icon={Activity} defaultOpen={true}>
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(data.liveData)
                .filter(([k, v]) => !['rpm', 'load', 'coolantTemp', 'fuelTrimShortTerm', 'fuelTrimLongTerm'].includes(k) && v !== undefined && v !== null && !Number.isNaN(v))
                .map(([k, v]) => {
                const config = getMetricConfig(k, v as number);
                return (
                  <MetricGauge 
                    key={k} 
                    label={k.replace(/([A-Z])/g, ' $1').trim()} 
                    value={v as number} 
                    config={config} 
                  />
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function getMetricConfig(key: string, value: number) {
  let min = 0, max = 100, unit = '', color = 'bg-primary';
  
  switch (key) {
    case 'rpm':
      max = 8000; unit = ' RPM';
      color = value > 5000 ? 'bg-red-500' : value > 3000 ? 'bg-yellow-500' : 'bg-primary';
      break;
    case 'load':
    case 'throttlePosition':
      max = 100; unit = '%';
      color = value > 80 ? 'bg-red-500' : value > 50 ? 'bg-yellow-500' : 'bg-primary';
      break;
    case 'coolantTemp':
      min = 0; max = 130; unit = '°C';
      color = value > 115 ? 'bg-red-500' : value > 105 ? 'bg-yellow-500' : value < 75 ? 'bg-blue-500' : 'bg-primary';
      break;
    case 'intakeAirTemp':
      min = -20; max = 100; unit = '°C';
      color = value > 60 ? 'bg-yellow-500' : 'bg-primary';
      break;
    case 'vehicleSpeed':
      max = 160; unit = ' mph';
      break;
    case 'maf':
      max = 50; unit = ' g/s';
      break;
    case 'fuelPressure':
      max = 100; unit = ' psi';
      break;
    case 'map':
    case 'barometricPressure':
      max = 150; unit = ' kPa';
      break;
    case 'controlModuleVoltage':
      max = 16; unit = ' V';
      color = value < 12 || value > 15 ? 'bg-red-500' : 'bg-primary';
      break;
    case 'engineOilTemp':
      min = -20; max = 150; unit = '°C';
      color = value > 130 ? 'bg-red-500' : value > 120 ? 'bg-yellow-500' : 'bg-primary';
      break;
    case 'fuelLevel':
      max = 100; unit = '%';
      color = value < 15 ? 'bg-yellow-500' : 'bg-primary';
      break;
    case 'timingAdvance':
      min = -20; max = 60; unit = '°';
      break;
    case 'evapPurge':
      max = 100; unit = '%';
      break;
    case 'evapVaporPressure':
      min = -8000; max = 8000; unit = ' Pa';
      color = 'bg-blue-500';
      break;
    default:
      if (key.includes('o2Voltage')) {
        max = 1.2; unit = 'V';
      } else if (key.includes('fuelTrim')) {
        min = -25; max = 25; unit = '%';
        color = Math.abs(value) > 10 ? 'bg-red-500' : Math.abs(value) > 5 ? 'bg-yellow-500' : 'bg-primary';
      } else if (key.includes('catTemp')) {
        max = 1000; unit = '°C';
        color = value > 800 ? 'bg-red-500' : 'bg-orange-500';
      }
  }

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  
  return { min, max, unit, color, percentage };
}

function MetricGauge({ label, value, config }: { label: string, value: number, config: any }) {
  return (
    <div className="bg-[#141414] border border-[#262626] rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">{label}</span>
        <span className="text-sm font-mono text-white font-bold">{value}{config.unit}</span>
      </div>
      <div className="h-2 w-full bg-[#0A0A0A] rounded-full overflow-hidden border border-[#262626]">
        <div 
          className={cn("h-full transition-all duration-500", config.color)} 
          style={{ width: `${config.percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-[8px] text-[#525252] font-mono">
        <span>{config.min}</span>
        <span>{config.max}</span>
      </div>
    </div>
  );
}

function RechartsGauge({ value, min, max, label, unit, color, icon }: { value: number | undefined, min: number, max: number, label: string, unit: string, color: string, icon?: React.ReactNode }) {
  const safeValue = value !== undefined ? value : min;
  const data = [{ name: label, value: Math.min(Math.max(safeValue, min), max) }];
  
  return (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center relative h-40 shadow-xl overflow-hidden group">
      <div className="absolute top-2 left-3 flex items-center gap-1.5 z-10">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#525252] group-hover:text-[#A3A3A3] transition-colors">{label}</span>
      </div>
      
      <div className="absolute top-8 left-0 right-0 h-28 transform group-hover:scale-105 transition-transform duration-500">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="100%" 
            innerRadius="75%" 
            outerRadius="105%" 
            barSize={6} 
            data={data} 
            startAngle={180} 
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[min, max]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#141414' }}
              dataKey="value"
              cornerRadius={10}
              fill={value !== undefined ? color : '#262626'}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="absolute bottom-4 flex flex-col items-center z-10">
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-black text-white tracking-tighter">
            {value !== undefined ? Math.round(value * 10) / 10 : '??'}
          </span>
          <span className="text-[10px] font-bold text-[#525252] ml-0.5">{unit}</span>
        </div>
        {icon && <div className="text-[#262626] mt-0.5">{icon}</div>}
      </div>
    </div>
  );
}
