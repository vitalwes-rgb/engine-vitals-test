export interface DTCExplanation {
  code: string;
  description: string;
  isCommon: boolean;
  system?: string;
  type?: string;
  subsystem?: string;
}

export const getDTCExplanation = (dtc: string): DTCExplanation => {
  const code = dtc.toUpperCase();
  
  const commonCodes: Record<string, string> = {
    'P0100': 'Mass or Volume Air Flow Circuit Malfunction',
    'P0101': 'Mass or Volume Air Flow Circuit Range/Performance',
    'P0102': 'Mass or Volume Air Flow Circuit Low Input',
    'P0103': 'Mass or Volume Air Flow Circuit High Input',
    'P0104': 'Mass or Volume Air Flow Circuit Intermittent',
    'P0105': 'Manifold Absolute Pressure/Barometric Pressure Circuit Malfunction',
    'P0110': 'Intake Air Temperature Circuit Malfunction',
    'P0115': 'Engine Coolant Temperature Circuit Malfunction',
    'P0120': 'Throttle/Pedal Position Sensor/Switch "A" Circuit Malfunction',
    'P0130': 'O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)',
    'P0131': 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)',
    'P0132': 'O2 Sensor Circuit High Voltage (Bank 1 Sensor 1)',
    'P0133': 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)',
    'P0134': 'O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 1)',
    'P0135': 'O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 1)',
    'P0171': 'System Too Lean (Bank 1)',
    'P0172': 'System Too Rich (Bank 1)',
    'P0174': 'System Too Lean (Bank 2)',
    'P0175': 'System Too Rich (Bank 2)',
    'P0300': 'Random/Multiple Cylinder Misfire Detected',
    'P0301': 'Cylinder 1 Misfire Detected',
    'P0302': 'Cylinder 2 Misfire Detected',
    'P0303': 'Cylinder 3 Misfire Detected',
    'P0304': 'Cylinder 4 Misfire Detected',
    'P0305': 'Cylinder 5 Misfire Detected',
    'P0306': 'Cylinder 6 Misfire Detected',
    'P0307': 'Cylinder 7 Misfire Detected',
    'P0308': 'Cylinder 8 Misfire Detected',
    'P0400': 'Exhaust Gas Recirculation Flow Malfunction',
    'P0401': 'Exhaust Gas Recirculation Flow Insufficient Detected',
    'P0402': 'Exhaust Gas Recirculation Flow Excessive Detected',
    'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
    'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2)',
    'P0440': 'Evaporative Emission Control System Malfunction',
    'P0442': 'Evaporative Emission Control System Leak Detected (small leak)',
    'P0455': 'Evaporative Emission Control System Leak Detected (gross leak)',
    'P0500': 'Vehicle Speed Sensor Malfunction',
  };

  if (commonCodes[code]) {
    return {
      code,
      description: commonCodes[code],
      isCommon: true
    };
  }

  if (code.length === 5) {
    const system = code[0];
    const type = code[1];
    const subsystem = code[2];

    let systemDesc = '';
    switch (system) {
      case 'P': systemDesc = 'Powertrain'; break;
      case 'C': systemDesc = 'Chassis'; break;
      case 'B': systemDesc = 'Body'; break;
      case 'U': systemDesc = 'Network'; break;
      default: systemDesc = 'Unknown'; break;
    }

    let typeDesc = type === '0' ? 'Generic' : 'Manufacturer Specific';

    let subsystemDesc = '';
    if (system === 'P') {
      switch (subsystem) {
        case '1':
        case '2': subsystemDesc = 'Fuel and Air Metering'; break;
        case '3': subsystemDesc = 'Ignition System or Misfire'; break;
        case '4': subsystemDesc = 'Auxiliary Emission Controls'; break;
        case '5': subsystemDesc = 'Vehicle Speed Control and Idle Control System'; break;
        case '6': subsystemDesc = 'Computer Output Circuits'; break;
        case '7':
        case '8': subsystemDesc = 'Transmission'; break;
        default: subsystemDesc = 'Unknown Subsystem'; break;
      }
    } else if (system === 'C') {
      subsystemDesc = 'Chassis Systems (Brakes, Steering, Suspension)';
    } else if (system === 'B') {
      subsystemDesc = 'Body Systems (Airbags, AC, Lighting)';
    } else if (system === 'U') {
      subsystemDesc = 'Network Communication (CAN bus, Modules)';
    }

    const description = subsystemDesc 
      ? `${systemDesc} (${typeDesc}): ${subsystemDesc}`
      : `${systemDesc} (${typeDesc}) Code`;

    return {
      code,
      description,
      isCommon: false,
      system: systemDesc,
      type: typeDesc,
      subsystem: subsystemDesc
    };
  }

  return {
    code,
    description: 'Diagnostic Trouble Code',
    isCommon: false
  };
};
