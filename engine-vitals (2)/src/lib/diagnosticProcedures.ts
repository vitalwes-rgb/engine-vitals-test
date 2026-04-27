export interface DiagnosticProcedure {
  id: string;
  name: string;
  description: string;
  requiredPids: string[];
  durationMinutes: number;
  theory: string;
  isHybridOnly?: boolean;
}

export const diagnosticProcedures: Record<string, DiagnosticProcedure> = {
  catalyst: {
    id: 'catalyst',
    name: 'Catalyst Efficiency Monitor',
    description: 'Measures B1S2 downstream oxygen sensor variance against B1S1 at a steady 2500 RPM.',
    requiredPids: ['010C', '0114', '0115'],
    durationMinutes: 2,
    theory: `Look at the relationship between B1S1 and B1S2. 
- If B1S2 mimics the oscillations of B1S1 (the 'Upstream Mimic' effect), flag the catalytic converter as DEGRADED or FAILED. 
- If B1S2 stays relatively flat between 0.6V and 0.8V despite B1S1 switching, the converter is HEALTHY.
Generate a direct, concise "Pass/Fail" summary and percentage efficiency rating based on these variances.`
  },
  vacuumLeak: {
    id: 'vacuumLeak',
    name: 'Vacuum Leak Fuel Trim Test',
    description: 'Analyzes Total Fuel Trim at Idle (800 RPM) vs Load (2500 RPM) to mathematically prove the existence of an unmetered air leak.',
    requiredPids: ['010C', '0106', '0107'],
    durationMinutes: 2,
    theory: `Analyze the shift in Total Fuel Trim (STFT + LTFT) from Idle to 2500 RPM.
- If Total Trim is highly positive (e.g. > +10%) at Idle, but drops back to near 0% at 2500 RPM, it mathematically CONFIRMS a Vacuum Leak. (Unmetered air represents a large percentage of intake at idle, but a negligible percentage at open throttle).
- If trims stay positive/high at 2500 RPM, flag it as a Fuel Delivery issue (weak fuel pump, clogged injector, bad MAF) rather than a vacuum leak.
- If trims are normal throughout, the system is perfectly sealed.
Generate a definitive "Pass/Fail" verdict regarding vacuum system integrity.`
  },
  turboHealth: {
    id: 'turboHealth',
    name: 'Forced Induction (Turbo) Health',
    description: 'Monitors Commanded Boost vs Actual Boost alongside Wastegate Duty Cycle to detect lag or leaks.',
    requiredPids: ['010C', '0170', 'ProprietaryWastegate'],
    durationMinutes: 2,
    theory: `Analyze Commanded Boost vs. Actual Boost during the recorded WOT pull.
- The AI must look for "Boost Lag" (Actual takes too long to meet Target). If Boost lag is >2 seconds, specifically suggest checking 'Intercooler Couplers' and 'Vacuum lines to the Actuator'.
- Evaluate the Wastegate Duty Cycle Sweep: If duty cycle is pegged at 95% but boost is low, the turbo is physically incapable of making pressure (worn bearings or internal damage).
Generate a definitive "Pass/Fail" verdict regarding the forced induction system.`
  },
  egrAnalysis: {
    id: 'egrAnalysis',
    name: 'EGR Flow Efficiency Analysis',
    description: 'Monitors MAP shifting during a forced EGR step sequence during deceleration.',
    requiredPids: ['010B', '012C'],
    durationMinutes: 2,
    theory: `Analyze the "EGR Step" Pressure Test:
- Look at the MAP sensor (Manifold Absolute Pressure) when the vehicle cruises and then rapidly decelerates.
- When the EGR valve opens (Target > 0%), the intake manifold pressure MUST increase relative to deep vacuum.
- If the EGR valve command changes but the MAP sensor doesn't budge, the EGR passages are clogged with carbon.
Generate a definitive "Pass/Fail" verdict regarding EGR flow. Explain that this causes Engine Knock and high NOx emissions if clogged.`
  },
  evBattery: {
    id: 'evBattery',
    name: 'EV/Hybrid Battery Cell Forensics',
    description: 'Tracks "Cell Drift" and Internal Resistance during high electrical load.',
    requiredPids: ['ProprietaryBatVoltages', 'ProprietaryBatCurrent'],
    durationMinutes: 2,
    isHybridOnly: true,
    theory: `Analyze the "Cell Drift" Balance Test & Internal Resistance Check:
- Look at High Voltage Battery Cell Voltages while under heavy electrical load (max A/C & acceleration).
- In a healthy pack, all cells should stay within 0.02V to 0.05V of each other.
- If one cell drops significantly lower than the others under load (e.g. 3.1V vs 3.6V), that module is FAILING.
- Also evaluate Internal Resistance drop (V = I * R). High calculated resistance indicates chemical aging and reduced range.
Generate a definitive "Pass/Fail" verdict on the High Voltage Pack health.`
  },
  tccSlip: {
    id: 'tccSlip',
    name: 'Transmission TCC Slip Test',
    description: 'Monitors Engine RPM vs. Transmission Input Shaft Speed while cruising.',
    requiredPids: ['010C', 'ProprietaryInputShaft'],
    durationMinutes: 2,
    theory: `Analyze the "TCC Slip" Test (Torque Converter Clutch):
- Monitor Engine RPM and Transmission Input Shaft Speed while cruising.
- Once the Torque Converter "Locks" in overdrive, the engine and input shaft must spin at exactly the same speed (0 RPM slip).
- If you see 50-100 RPM of slip while the command states LOCKED, the Torque Converter is wearing out, leading to shuddering and overheating.
Generate a definitive "Pass/Fail" verdict regarding transmission health.`
  }
};

export const speakTTS = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
};
