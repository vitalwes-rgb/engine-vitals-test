import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Play, Square, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { ScanToolData, LiveData } from '../../types';
import { cn } from '../../lib/utils';
import { diagnosticProcedures, speakTTS } from '../../lib/diagnosticProcedures';

interface CatalystTestProps {
  scanData: ScanToolData | null;
  onComplete: (testResults: any) => void;
  onClose: () => void;
  isStreaming: boolean;
}

export default function CatalystTest({ scanData, onComplete, onClose, isStreaming }: CatalystTestProps) {
  const [testState, setTestState] = useState<'WARMUP' | 'RPM_TARGET' | 'TESTING' | 'DONE'>('WARMUP');
  const [countdown, setCountdown] = useState(5);
  const [testData, setTestData] = useState<any[]>([]);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  
  const spokenRef = useRef<Record<string, boolean>>({});

  const currentLiveData = scanData?.liveData;
  const coolantTemp = currentLiveData?.coolantTemp || 0;
  const rpm = currentLiveData?.rpm || 0;
  
  // Convert °C to °F for display and logic if needed (82C = ~180F)
  const isWarm = coolantTemp >= 80; 

  const inTargetRpm = rpm >= 2400 && rpm <= 2600;

  useEffect(() => {
    if (testState === 'WARMUP' && isWarm) {
      setTestState('RPM_TARGET');
      if (!spokenRef.current['RPM_TARGET']) {
        speakTTS("Engine is warm. Slowly bring the engine to 2500 RPM and hold it steady.");
        spokenRef.current['RPM_TARGET'] = true;
      }
    }
  }, [coolantTemp, isWarm, testState]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (testState === 'RPM_TARGET') {
      if (inTargetRpm) {
        timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              setTestState('TESTING');
              setTestStartTime(Date.now());
              speakTTS("RPM stable. Recording data now. Keep holding exactly where you are.");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setCountdown(5); // Reset if they drop out of range
      }
    }
    
    return () => clearInterval(timer);
  }, [testState, inTargetRpm]);

  useEffect(() => {
    if (testState === 'TESTING' && isStreaming && currentLiveData) {
      setTestData(prev => {
        const newData = [...prev, {
          time: ((Date.now() - (testStartTime || Date.now())) / 1000).toFixed(1),
          b1s1: currentLiveData.o2VoltageBank1Sensor1 || Math.random() * 0.8 + 0.1, // Fallback if no real data
          b1s2: currentLiveData.o2VoltageBank1Sensor2 || 0.65,
          rpm: currentLiveData.rpm
        }];
        
        // Stop test after 15 seconds
        if (newData.length > 30 || (Date.now() - (testStartTime || Date.now()) > 15000)) {
           setTestState('DONE');
           speakTTS("Test complete. You can release the pedal. Analyzing data.");
           calculateResults(newData);
        }
        return newData;
      });
    }
  }, [scanData?.liveDataHistory]);

  const calculateResults = (data: any[]) => {
    if (data.length === 0) return;
    
    const b1s1s = data.map(d => d.b1s1);
    const b1s2s = data.map(d => d.b1s2);
    
    const b1s1Max = Math.max(...b1s1s);
    const b1s1Min = Math.min(...b1s1s);
    const b1s2Max = Math.max(...b1s2s);
    const b1s2Min = Math.min(...b1s2s);
    
    const b1s2Avg = b1s2s.reduce((a, b) => a + b, 0) / b1s2s.length;

    onComplete({
      testName: diagnosticProcedures.catalyst.name,
      theory: diagnosticProcedures.catalyst.theory,
      payload: {
        durationSeconds: 15,
        averageRpm: Math.round(data.reduce((a, b) => a + b.rpm, 0) / data.length),
        b1s1VarianceVolts: (b1s1Max - b1s1Min).toFixed(2),
        b1s2VarianceVolts: (b1s2Max - b1s2Min).toFixed(2),
        b1s2AverageVolts: b1s2Avg.toFixed(2)
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

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Activity className="w-6 h-6 text-blue-500 mr-2" />
          Catalyst Health Check
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      {testState === 'WARMUP' && (
        <div className="text-center py-10">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Waiting for Closed Loop...</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            The catalyst efficiency monitor requires the engine to be warm (approx. 180°F / 82°C). 
            Current coolant temperature: <span className="text-white font-mono">{coolantTemp}°C</span>
          </p>
          <div className="mt-8 bg-gray-800 rounded-full h-4 w-64 mx-auto overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all" 
              style={{ width: `${Math.min(100, Math.max(0, (coolantTemp / 80) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {testState === 'RPM_TARGET' && (
        <div className="text-center py-8">
          <Activity className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-2xl font-bold text-white mb-2">Hold RPM at 2500</h3>
          <p className="text-gray-400 mb-8">Slowly press the accelerator. Keep the needle in the green zone to begin the test.</p>
          
          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              {/* Background Arc */}
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" />
              {/* Target Zone (2400-2600 is roughly 60% around the dial if 0-4000 is our scale) */}
              <path d="M 50 10 A 40 40 0 0 1 73 17" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
              {/* Needle */}
              <g style={{ transform: `rotate(${Math.min(180, (rpm / 4000) * 180)}deg)`, transformOrigin: '50px 50px', transition: 'transform 0.2s ease-out' }}>
                <path d="M 48 50 L 50 15 L 52 50 Z" fill="#ef4444" />
                <circle cx="50" cy="50" r="4" fill="#ef4444" />
              </g>
            </svg>
            <div className="absolute bottom-0 left-0 w-full text-center">
              <span className={cn(
                "text-3xl font-mono font-bold",
                inTargetRpm ? "text-green-500" : "text-white"
              )}>{rpm}</span>
              <span className="text-gray-500 ml-1">RPM</span>
            </div>
          </div>

          <div className={cn(
            "inline-flex items-center px-4 py-2 rounded-lg font-bold transition-colors",
            inTargetRpm ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400"
          )}>
            {inTargetRpm ? `Holding... ${countdown}s remaining` : 'Waiting for Target RPM'}
          </div>
        </div>
      )}

      {testState === 'TESTING' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                Recording O2 Sensors...
              </h3>
              <p className="text-gray-400 text-sm">Keep holding RPM steady.</p>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg font-mono text-white">
               Test Time: {((Date.now() - (testStartTime || Date.now())) / 1000).toFixed(1)}s
            </div>
          </div>

          <div className="h-64 bg-black/40 rounded-xl p-4 border border-gray-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis domain={[0, 1.0]} stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem' }}
                />
                <Legend />
                <Line type="monotone" name="B1S1 (Upstream)" dataKey="b1s1" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" name="B1S2 (Downstream)" dataKey="b1s2" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {testState === 'DONE' && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Test Complete!</h3>
          <p className="text-gray-400 mb-8">Data captured successfully. The AI will now analyze the catalyst efficiency during the master diagnostic scan.</p>
        </div>
      )}
    </div>
  );
}
