import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Play, Square, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { ScanToolData } from '../../types';
import { cn } from '../../lib/utils';
import { diagnosticProcedures, speakTTS } from '../../lib/diagnosticProcedures';

interface VacuumLeakTestProps {
  scanData: ScanToolData | null;
  onComplete: (testResults: any) => void;
  onClose: () => void;
  isStreaming: boolean;
}

export default function VacuumLeakTest({ scanData, onComplete, onClose, isStreaming }: VacuumLeakTestProps) {
  const [testState, setTestState] = useState<'IDLE_TARGET' | 'IDLE_RECORDING' | 'RPM_TARGET' | 'RPM_RECORDING' | 'DONE'>('IDLE_TARGET');
  const [countdown, setCountdown] = useState(5);
  const [idleData, setIdleData] = useState<any[]>([]);
  const [rpmData, setRpmData] = useState<any[]>([]);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  const spokenRef = useRef<Record<string, boolean>>({});

  const currentLiveData = scanData?.liveData;
  const rpm = currentLiveData?.rpm || 0;
  const stft = currentLiveData?.fuelTrimShortTerm || 0;
  const ltft = currentLiveData?.fuelTrimLongTerm || 0;
  const totalTrim = stft + ltft;

  const inIdleTarget = rpm > 500 && rpm < 1000;
  const inRevTarget = rpm >= 2400 && rpm <= 2600;

  // Phase 1: Idle Targeting
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (testState === 'IDLE_TARGET') {
      if (!spokenRef.current['IDLE_TARGET']) {
        speakTTS("Let the engine idle without touching the accelerator.");
        spokenRef.current['IDLE_TARGET'] = true;
      }
      
      if (inIdleTarget) {
        timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              setTestState('IDLE_RECORDING');
              setTestStartTime(Date.now());
              speakTTS("Idle stable. Recording fuel trims.");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setCountdown(5);
      }
    }
    return () => clearInterval(timer);
  }, [testState, inIdleTarget]);

  // Phase 2: Idle Recording
  useEffect(() => {
    if (testState === 'IDLE_RECORDING' && isStreaming && currentLiveData) {
      setIdleData(prev => {
        const newData = [...prev, {
          time: ((Date.now() - (testStartTime || Date.now())) / 1000).toFixed(1),
          totalTrim: totalTrim,
          rpm: currentLiveData.rpm
        }];
        
        if (newData.length > 20 || (Date.now() - (testStartTime || Date.now()) > 10000)) {
           setTestState('RPM_TARGET');
           setCountdown(5);
           speakTTS("Idle recording complete. Now, slowly bring the engine to 2500 R P M and hold it steady.");
        }
        return newData;
      });
    }
  }, [scanData?.liveDataHistory, testState]);

  // Phase 3: Rev Targeting
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (testState === 'RPM_TARGET') {
      if (inRevTarget) {
        timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              setTestState('RPM_RECORDING');
              setTestStartTime(Date.now());
              speakTTS("R P M stable. Recording loaded fuel trims. Keep holding.");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setCountdown(5);
      }
    }
    return () => clearInterval(timer);
  }, [testState, inRevTarget]);

  // Phase 4: Rev Recording
  useEffect(() => {
    if (testState === 'RPM_RECORDING' && isStreaming && currentLiveData) {
      setRpmData(prev => {
        const newData = [...prev, {
          time: ((Date.now() - (testStartTime || Date.now())) / 1000).toFixed(1),
          totalTrim: totalTrim,
          rpm: currentLiveData.rpm
        }];
        
        if (newData.length > 20 || (Date.now() - (testStartTime || Date.now()) > 10000)) {
           setTestState('DONE');
           speakTTS("Test complete. You can release the pedal. Analyzing data.");
           calculateResults(idleData, newData);
        }
        return newData;
      });
    }
  }, [scanData?.liveDataHistory, testState]);

  const calculateResults = (idle: any[], rev: any[]) => {
    if (idle.length === 0 || rev.length === 0) return;
    
    const avgIdleTrim = idle.reduce((a, b) => a + b.totalTrim, 0) / idle.length;
    const avgRevTrim = rev.reduce((a, b) => a + b.totalTrim, 0) / rev.length;

    onComplete({
      testName: diagnosticProcedures.vacuumLeak.name,
      theory: diagnosticProcedures.vacuumLeak.theory,
      payload: {
        idlePhase: {
          durationSeconds: 10,
          averageRpm: idle.reduce((a, b) => a + b.rpm, 0) / idle.length,
          averageTotalTrim: avgIdleTrim.toFixed(1) + '%'
        },
        revPhase: {
          durationSeconds: 10,
          averageRpm: rev.reduce((a, b) => a + b.rpm, 0) / rev.length,
          averageTotalTrim: avgRevTrim.toFixed(1) + '%'
        },
        trimShift: (avgIdleTrim - avgRevTrim).toFixed(1) + '%'
      }
    });
  };

  if (!isStreaming) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center">
        <Activity className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Live Stream Required</h2>
        <p className="text-gray-400 mb-6">You must connect the scanner and start Live Data before running interactive tests.</p>
        <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">Go Back</button>
      </div>
    );
  }

  const isIdlePhase = testState === 'IDLE_TARGET' || testState === 'IDLE_RECORDING';
  const renderData = isIdlePhase ? idleData : rpmData;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Activity className="w-6 h-6 text-purple-500 mr-2" />
          Vacuum Leak Test
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      {(testState === 'IDLE_TARGET' || testState === 'RPM_TARGET') && (
        <div className="text-center py-8">
          <Activity className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-2xl font-bold text-white mb-2">
            {testState === 'IDLE_TARGET' ? 'Let Engine Idle' : 'Hold RPM at 2500'}
          </h3>
          <p className="text-gray-400 mb-8">
            {testState === 'IDLE_TARGET' 
              ? 'Keep your foot off the pedal. Wait for the green zone.'
              : 'Slowly press the accelerator until the needle reaches the green zone.'}
          </p>
          
          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" />
              {testState === 'IDLE_TARGET' ? (
                <path d="M 10 50 A 40 40 0 0 1 20 28" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
              ) : (
                <path d="M 50 10 A 40 40 0 0 1 73 17" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
              )}
              <g style={{ transform: `rotate(${Math.min(180, (rpm / 4000) * 180)}deg)`, transformOrigin: '50px 50px', transition: 'transform 0.2s ease-out' }}>
                <path d="M 48 50 L 50 15 L 52 50 Z" fill="#ef4444" />
                <circle cx="50" cy="50" r="4" fill="#ef4444" />
              </g>
            </svg>
            <div className="absolute bottom-0 left-0 w-full text-center">
              <span className={cn(
                "text-3xl font-mono font-bold",
                (testState === 'IDLE_TARGET' ? inIdleTarget : inRevTarget) ? "text-green-500" : "text-white"
              )}>{rpm}</span>
              <span className="text-gray-500 ml-1">RPM</span>
            </div>
          </div>

          <div className={cn(
            "inline-flex items-center px-4 py-2 rounded-lg font-bold transition-colors",
            (testState === 'IDLE_TARGET' ? inIdleTarget : inRevTarget) ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400"
          )}>
            {(testState === 'IDLE_TARGET' ? inIdleTarget : inRevTarget) ? `Holding... ${countdown}s remaining` : 'Waiting for Target RPM'}
          </div>
        </div>
      )}

      {(testState === 'IDLE_RECORDING' || testState === 'RPM_RECORDING') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                Recording Fuel Trims ({testState === 'IDLE_RECORDING' ? 'Idle' : '2500 RPM'})
              </h3>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg font-mono text-white">
               Trim: {totalTrim.toFixed(1)}%
            </div>
          </div>

          <div className="h-64 bg-black/40 rounded-xl p-4 border border-gray-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={renderData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis domain={[-25, 25]} stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Legend />
                <Line type="stepAfter" name="Total Fuel Trim (%)" dataKey="totalTrim" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {testState === 'DONE' && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Test Complete!</h3>
          <p className="text-gray-400 mb-8">Data captured successfully. The AI will analyze the shift in fuel trims to detect unmetered air leaks.</p>
        </div>
      )}
    </div>
  );
}
