import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Plus, Trash2, Calendar, AlertCircle, CheckCircle2, Loader2, Wrench, X, Activity, TrendingDown } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Vehicle, MaintenanceItem } from '../types';
import { toast } from 'sonner';
import { generateMaintenanceScheduleAPI } from '../services/geminiService';
import SEO from './SEO';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MyGarageProps {
  user: any;
}

export default function MyGarage({ user }: MyGarageProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    mileage: 0,
    vin: ''
  });

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  const fetchVehicles = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'vehicles'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const vehicleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(vehicleData);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load garage');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMaintenanceSchedule = async (make: string, model: string, year: number, mileage: number): Promise<MaintenanceItem[]> => {
    try {
      const text = await generateMaintenanceScheduleAPI(make, model, year, mileage);
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error generating maintenance schedule:', error);
      return [];
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newVehicle.make || !newVehicle.model) return;

    setIsGeneratingSchedule(true);
    try {
      const schedule = await generateMaintenanceSchedule(newVehicle.make, newVehicle.model, newVehicle.year, newVehicle.mileage);
      
      const vehicleData: Omit<Vehicle, 'id'> = {
        ...newVehicle,
        userId: user.uid,
        maintenanceSchedule: schedule,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'vehicles'), vehicleData);
      setVehicles([...vehicles, { id: docRef.id, ...vehicleData } as Vehicle]);
      
      setShowAddForm(false);
      setNewVehicle({ make: '', model: '', year: new Date().getFullYear(), mileage: 0, vin: '' });
      toast.success('Vehicle added to garage!');
    } catch (error) {
      console.error('Error adding vehicle:', error);
      toast.error('Failed to add vehicle');
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'vehicles', id));
      setVehicles(vehicles.filter(v => v.id !== id));
      toast.success('Vehicle removed');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast.error('Failed to remove vehicle');
    }
  };

  const toggleMaintenanceItem = async (vehicleId: string, itemIndex: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;

      const updatedSchedule = [...vehicle.maintenanceSchedule];
      updatedSchedule[itemIndex].completed = !updatedSchedule[itemIndex].completed;

      await updateDoc(doc(db, 'vehicles', vehicleId), {
        maintenanceSchedule: updatedSchedule
      });

      setVehicles(vehicles.map(v => v.id === vehicleId ? { ...v, maintenanceSchedule: updatedSchedule } : v));
    } catch (error) {
      console.error('Error updating maintenance item:', error);
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="w-48 h-8 bg-[#262626] rounded-lg animate-pulse"></div>
            <div className="w-64 h-4 bg-[#262626] rounded-lg animate-pulse"></div>
          </div>
          <div className="w-32 h-10 bg-[#262626] rounded-xl animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-6 animate-pulse shadow-xl">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="w-40 h-6 bg-[#262626] rounded-lg"></div>
                  <div className="w-24 h-4 bg-[#262626] rounded-lg"></div>
                </div>
                <div className="w-12 h-12 bg-[#262626] rounded-xl"></div>
              </div>
              <div className="space-y-3">
                <div className="w-full h-12 bg-[#262626] rounded-xl"></div>
                <div className="w-full h-12 bg-[#262626] rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SEO 
        title="My Garage" 
        description="Manage your vehicles, track upcoming maintenance schedules, and keep your cars running smoothly with Engine Vitals."
      />
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            My <span className="text-primary">Garage</span>
          </h1>
          <p className="text-[#A3A3A3] text-sm md:text-base">
            Manage your vehicles and track upcoming maintenance.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-primary text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Vehicle
          </button>
        )}
      </header>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddVehicle}
            className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-6 space-y-4 overflow-hidden shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" /> New Vehicle
              </h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-[#525252] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Make</label>
                <input required type="text" value={newVehicle.make} onChange={e => setNewVehicle({...newVehicle, make: e.target.value})} placeholder="e.g. Toyota" className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Model</label>
                <input required type="text" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} placeholder="e.g. Camry" className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Year</label>
                <input required type="number" value={newVehicle.year} onChange={e => setNewVehicle({...newVehicle, year: Number(e.target.value)})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-bold">Current Mileage</label>
                <input required type="number" value={newVehicle.mileage} onChange={e => setNewVehicle({...newVehicle, mileage: Number(e.target.value)})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all" />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isGeneratingSchedule}
                className="bg-primary text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isGeneratingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isGeneratingSchedule ? 'Generating Schedule...' : 'Save Vehicle'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {vehicles.map((vehicle) => (
          <motion.div
            key={vehicle.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-xl"
          >
            <div className="p-6 border-b border-[#262626] flex justify-between items-start bg-[#0A0A0A]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#262626] flex items-center justify-center text-white">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                  <p className="text-sm text-[#A3A3A3]">{vehicle.mileage.toLocaleString()} miles</p>
                </div>
              </div>
              <button onClick={() => handleDeleteVehicle(vehicle.id!)} className="p-2 text-[#525252] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" /> Maintenance Schedule
              </h4>
              
              {vehicle.maintenanceSchedule && vehicle.maintenanceSchedule.length > 0 ? (
                <div className="space-y-3">
                  {vehicle.maintenanceSchedule.map((item, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                        item.completed 
                          ? 'bg-green-500/5 border-green-500/20 opacity-60' 
                          : 'bg-[#0A0A0A] border-[#262626] hover:border-primary/30'
                      }`}
                    >
                      <button 
                        onClick={() => toggleMaintenanceItem(vehicle.id!, idx)}
                        className={`mt-0.5 shrink-0 transition-colors ${item.completed ? 'text-green-500' : 'text-[#525252] hover:text-primary'}`}
                      >
                        {item.completed ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <span className={`font-bold text-sm ${item.completed ? 'text-green-500 line-through' : 'text-white'}`}>{item.service}</span>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {item.dueAtMileage.toLocaleString()} mi
                          </span>
                        </div>
                        <p className="text-xs text-[#A3A3A3] mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#525252] italic">No maintenance schedule available.</p>
              )}

              {vehicle.scanHistory && vehicle.scanHistory.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[#262626]">
                  <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Health Degradation Trends
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vehicle.scanHistory.map(h => ({
                        ...h,
                        dateShort: new Date(h.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
                        shortTrim: h.fuelTrimShortTerm || 0,
                        longTrim: h.fuelTrimLongTerm || 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="dateShort" stroke="#525252" fontSize={10} tickMargin={8} />
                        <YAxis stroke="#525252" fontSize={10} width={30} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #262626', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          labelStyle={{ color: '#A3A3A3', fontSize: '10px', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line type="monotone" name="Misfires" dataKey="misfires" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" name="DTCs" dataKey="dtcCount" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" name="Short Fuel Trim %" dataKey="shortTrim" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" name="Long Fuel Trim %" dataKey="longTrim" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                        {(vehicle.scanHistory && vehicle.scanHistory.some(h => h.volumetricEfficiency !== undefined)) && (
                          <Line type="monotone" name="VE %" dataKey="volumetricEfficiency" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {vehicle.scanHistory.length >= 2 && (
                    <div className="mt-4 bg-primary/10 border border-primary/20 p-3 rounded-xl flex items-start gap-3">
                      <TrendingDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-[#A3A3A3] leading-relaxed">
                        <strong className="text-primary uppercase tracking-wider block mb-1">AI Predictive Note</strong>
                        Tracking consecutive scans. Fuel trims outside ±10%, declining VE %, or rising misfire trends indicate a developing vacuum leak, clogged exhaust, or ignition degradation before the CEL illuminates.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {vehicles.length === 0 && !showAddForm && (
          <div className="col-span-full text-center py-20 bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl border-dashed shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-full bg-[#1A1A1A] flex items-center justify-center mx-auto mb-6 border border-[#262626] shadow-xl">
                <Car className="w-8 h-8 text-[#525252]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your Garage is Empty</h3>
              <p className="text-[#A3A3A3] max-w-sm mx-auto mb-6">Add your vehicles to track their maintenance schedules, save diagnostic reports, and get personalized advice.</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-primary text-black px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Add Your First Vehicle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
