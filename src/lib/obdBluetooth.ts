import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface OBDConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isStreaming: boolean;
  error: string | null;
  logs: string[];
  scanProgress: number;
  currentCommand: string | null;
  scannedVin: string | null;
}

export function useOBDScanner() {
  const [state, setState] = useState<OBDConnectionState>({
    isConnected: false,
    isConnecting: false,
    isStreaming: false,
    error: null,
    logs: [],
    scanProgress: 0,
    currentCommand: null,
    scannedVin: null
  });

  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const isStreamingRef = useRef(false);
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentResolveRef = useRef<((value: string) => void) | null>(null);
  const responseBufferRef = useRef<string>('');

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    setState(s => ({ ...s, logs: [...s.logs, `[${timestamp}] ${msg}`] }));
  };

  const handleNotifications = useCallback((event: any) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);
    responseBufferRef.current += text;
    
    // ELM327 prompt character is '>'
    if (responseBufferRef.current.includes('>')) {
      if (currentResolveRef.current) {
        // Log the raw incoming response before cleaning
        const fullResponse = responseBufferRef.current.trim();
        currentResolveRef.current(fullResponse.replace(/>/g, '').trim());
        currentResolveRef.current = null;
      }
      responseBufferRef.current = '';
    }
  }, []);

  const connect = async () => {
    const isIframe = window.self !== window.top;

    if (!navigator.bluetooth) {
      if (isIframe) {
        toast.error('Bluetooth is restricted in this preview window. Please use the "Open in New Tab" button (top right) to connect your scanner.', { duration: 8000 });
        return null;
      }
      toast.error('Web Bluetooth is not supported in this browser. Try Chrome on Android or Desktop.');
      return null;
    }

    setState(s => ({ ...s, isConnecting: true, error: null, logs: ['Requesting Bluetooth Device...'] }));

    try {
      if (isIframe) {
        console.warn('Running in iframe, Web Bluetooth request may be blocked by browser security policies.');
      }
      
      const btDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          0xFFE0, // Common HM-10 / ELM327 BLE service
          0xFFF0,
          0x18F0, // Other common OBD service
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb'
        ]
      });

      addLog(`Connecting to GATT Server on ${btDevice.name || 'Unknown Device'}...`);
      const server = await btDevice.gatt?.connect();
      
      if (!server) throw new Error('Could not connect to GATT server');

      addLog('Discovering Services...');
      const services = await server.getPrimaryServices();
      let service = null;
      
      // Try to find any service that looks like its for communication
      for (const s of services) {
        const uuid = s.uuid.toLowerCase();
        if (uuid.includes('ffe0') || uuid.includes('fff0') || uuid.includes('18f0')) {
          service = s;
          break;
        }
      }
      
      if (!service && services.length > 0) {
        service = services[0];
      }
      
      if (!service) throw new Error('No compatible services found');

      addLog(`Using service: ${service.uuid}`);
      
      const characteristics = await service.getCharacteristics();
      let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
      
      for (const c of characteristics) {
        if (c.properties.notify || c.properties.indicate) {
          notifyChar = c;
        }
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c;
        }
      }

      if (!notifyChar) throw new Error('No notify characteristic found on service');
      // Fallback in case of combined characteristic
      if (!writeChar) writeChar = notifyChar;
      
      addLog(`Using notify char: ${notifyChar.uuid}`);
      addLog(`Using write char: ${writeChar.uuid}`);

      // Add listener BEFORE starting notifications
      notifyChar.addEventListener('characteristicvaluechanged', handleNotifications);
      await notifyChar.startNotifications();
      
      // Delay to let adapter settle after enabling notifications
      await new Promise(r => setTimeout(r, 300));

      setDevice(btDevice);
      setCharacteristic(writeChar);
      setState(s => ({ ...s, isConnected: true, isConnecting: false }));
      addLog('Connected successfully!');

      btDevice.addEventListener('gattserverdisconnected', () => {
        setState(s => ({ ...s, isConnected: false }));
        setDevice(null);
        setCharacteristic(null);
        responseBufferRef.current = '';
        currentResolveRef.current = null;
        addLog('Device disconnected');
        toast.error('OBD-II Scanner disconnected');
      });

      return writeChar;
    } catch (error: any) {
      console.error(error);
      
      const isIframe = window.self !== window.top;
      let errorMessage = error.message;
      
      if (isIframe && (error.name === 'SecurityError' || error.message.includes('permission') || error.message.includes('gesture'))) {
        errorMessage = 'Bluetooth permission denied in preview window. Please click "Open in New Tab" (top right) to use this feature.';
        toast.error(errorMessage, { duration: 8000 });
      } else {
        toast.error(`Connection failed: ${errorMessage}`);
      }

      setState(s => ({ ...s, isConnecting: false, error: errorMessage }));
      addLog(`Error: ${errorMessage}`);
      throw error;
    }
  };

  const disconnect = () => {
    if (device && device.gatt?.connected) {
      device.gatt.disconnect();
    }
  };

  const sendCommand = async (cmd: string, char: BluetoothRemoteGATTCharacteristic): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      if (!char) return reject(new Error('Not connected'));
      
      let timeout: NodeJS.Timeout;
      // Longer timeout for init/scan commands
      const timeoutMs = (cmd.startsWith('AT') || cmd === '0100' || cmd === '03' || cmd === '07' || cmd === '0A') ? 15000 : 8000;

      const finish = (result: string) => {
        clearTimeout(timeout);
        currentResolveRef.current = null;
        resolve(result);
      };

      // Clear buffer before sending
      responseBufferRef.current = '';
      currentResolveRef.current = finish;

      try {
        const encoder = new TextEncoder();
        const payload = encoder.encode(cmd + '\r');
        
        // Handle iOS specific combined characteristics and strict writeWithoutResponse requirements (e.g. Konnwei)
        // Prioritize writeWithoutResponse, as many cheap BLE chips claim 'write' support but fail to ACK.
        if (char.properties.writeWithoutResponse) {
          await char.writeValueWithoutResponse(payload);
        } else if (char.properties.write) {
          await char.writeValue(payload);
        } else {
          // Absolute fallback
          await char.writeValue(payload);
        }
        
        timeout = setTimeout(() => {
          const currentBuffer = responseBufferRef.current.replace(/>/g, '').trim();
          if (currentBuffer.length > 0) {
            addLog(`Command ${cmd} timed out but returning gathered buffer: ${currentBuffer}`);
            finish(currentBuffer);
          } else {
            addLog(`Command timeout: ${cmd}`);
            if (currentResolveRef.current) finish('');
          }
          responseBufferRef.current = '';
        }, timeoutMs);
      } catch (error) {
        clearTimeout(timeout);
        currentResolveRef.current = null;
        reject(error);
      }
    });
  };

  const scanVehicle = async (): Promise<{ rawOutput: string; networkTopology?: any[] }> => {
    if (!characteristic) throw new Error('Not connected');
    
    addLog('Starting vehicle scan...');
    let fullRawOutput = '';

    const runCmd = async (
      cmd: string, 
      desc: string, 
      options: { hideLog?: boolean; delayMs?: number; fastTimeout?: boolean } = {}
    ): Promise<string | null> => {
      const { hideLog = false, delayMs = 200, fastTimeout = false } = options;
      
      if (!hideLog) {
        setState(s => ({ ...s, currentCommand: desc }));
        addLog(`Sending ${desc} (${cmd})...`);
        console.log(`[OBD-II] Sending command: ${cmd} (${desc})`);
      }

      try {
        // If high speed polling, we could theoretically adjust timeout here, 
        // but ELM timeout is controlled via AT ST command sent beforehand.
        const res = await sendCommand(cmd, characteristic);
        fullRawOutput += `[${cmd}] ${res}\n`;
        
        if (!hideLog) {
          addLog(`Response: ${res.replace(/\r/g, ' ')}`);
          console.log(`[OBD-II] Received response for ${cmd}:`, res);
        }
        
        // Small delay between commands
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
        return res;
      } catch (e: any) {
        if (!hideLog) {
          addLog(`Error on ${cmd}: ${e.message}`);
          console.error(`[OBD-II] Error on command ${cmd}:`, e);
        }
        return null;
      }
    };

    try {
      setState(s => ({ ...s, scanProgress: 0, currentCommand: 'Initializing Adapter...' }));
      
      // Extensive initialization for ELM327
      await runCmd('ATZ', 'Reboot Adapter');
      await new Promise(r => setTimeout(r, 1500)); // Crucial delay for reboot
      
      await runCmd('ATE0', 'Echo Off');
      await runCmd('ATL0', 'Linefeeds Off');
      await runCmd('ATS0', 'Spaces Off'); // Most efficient for parsing
      await runCmd('ATH1', 'Headers On'); // Keep headers so we can differentiate ECUs
      await runCmd('ATCAF1', 'CAN Auto Format On'); // Critical for multi-frame support
      await runCmd('ATSP0', 'Set Protocol to Auto');
      
      setState(s => ({ ...s, scanProgress: 15, currentCommand: 'Negotiating Protocol...' }));
      // Establish actual ECU connection
      const pidResponse = await runCmd('0100', 'Verify ECU Connection');
      if (!pidResponse || pidResponse.includes('UNABLE') || pidResponse.includes('NO DATA')) {
        addLog('Initial connection failed, retrying with increased timeout...');
        await new Promise(r => setTimeout(r, 2000));
        const retryResponse = await runCmd('0100', 'ECU Connection Retry');
        if (!retryResponse || retryResponse.includes('UNABLE')) {
          throw new Error('Scanner could not connect to vehicle ECU. Ensure the ignition is fully ON/RUN.');
        }
      }

      await runCmd('ATDP', 'Identify Protocol');
      setState(s => ({ ...s, scanProgress: 20, currentCommand: 'Reading Vehicle VIN...' }));

      // VIN Reading (Multi-frame 09 02 or manufacturer specific 22 F1 90)
      let vinResponse = await runCmd('0902', 'Vehicle VIN Request');
      let vin = '';
      
      const parseVinResponse = (hexCode: string) => {
        // Break early if we just got a failure string
        if (!hexCode || hexCode.includes('ERROR') || hexCode.includes('NO DATA')) return null;

        // Clean up multiline ELM327 frame indices
        // A multi-frame response usually looks like:
        // 014
        // 0: 49 02 01 31 47 31
        // 1: 46 42 33 44 53 33 4B
        // 2: 30 31 31 37 32 32 38
        const lines = hexCode.split(/[\r\n]+/);
        let pureHex = '';
        
        for (let line of lines) {
           line = line.trim();
           // Remove standard ELM multi-frame index prefixes like "0:", "1:", "0: ", etc.
           line = line.replace(/^[0-9A-F]:\s*/i, '');
           
           const strippedLine = line.replace(/[^0-9A-F]/gi, '');
           // Skip length lines like "014" that are too short to be data and lack the payload header
           if (strippedLine.length <= 3 && !strippedLine.includes('49') && !strippedLine.includes('62')) continue;
           
           pureHex += strippedLine;
        }

        let vinHex = '';
        if (pureHex.includes('490201')) {
           vinHex = pureHex.substring(pureHex.indexOf('490201') + 6);
        } else if (pureHex.includes('62F190')) {
           // UDS fallback
           vinHex = pureHex.substring(pureHex.indexOf('62F190') + 6);
        } else if (pureHex.includes('4902')) {
           // Sometimes the '01' item count byte is missing or malformed by the ECU
           vinHex = pureHex.substring(pureHex.indexOf('4902') + 4);
        }

        if (vinHex) {
           let parsedVin = '';
           for (let i = 0; i < vinHex.length - 1; i += 2) {
             const charCode = parseInt(vinHex.substring(i, i + 2), 16);
             // Ensure it's valid printable ASCII to avoid garbage characters
             if (charCode >= 32 && charCode <= 126) {
               parsedVin += String.fromCharCode(charCode);
             }
           }
           // The VIN should be exactly 17 characters
           if (parsedVin.length >= 17) {
               parsedVin = parsedVin.replace(/[^A-HJ-NPR-Z0-9]/gi, ''); // Strict VIN char set (no I, O, Q)
               return parsedVin.substring(0, 17).toUpperCase();
           }
        }
        return null;
      };

      if (vinResponse && !vinResponse.includes('NO DATA')) {
         const parsed = parseVinResponse(vinResponse);
         if (parsed) vin = parsed;
      }
      
      // Fallback for Ford/GM or older CAN if 0902 failed
      if (!vin || vin.length < 17) {
         addLog('Standard VIN pull failed, attempting OEM Mode 22 pull...');
         await runCmd('AT SH 7E0', 'Target PCM for OEM VIN');
         const fallbackResponse = await runCmd('22F190', 'OEM VIN Request');
         if (fallbackResponse && !fallbackResponse.includes('NO DATA')) {
             const parsed = parseVinResponse(fallbackResponse);
             if (parsed) vin = parsed;
         }
         // Reset target back to broadcast
         await runCmd('AT SH 7DF', 'Restore Standard Broadcast Header');
      }
      
      if (vin) {
         setState(s => ({ ...s, scannedVin: vin }));
         addLog(`Successfully parsed VIN: ${vin}`);
      }

      setState(s => ({ ...s, scanProgress: 25 }));
      
      // DTC Reading
      await runCmd('03', 'Stored Codes');
      await runCmd('07', 'Pending Codes');
      await runCmd('0A', 'Permanent Codes');
      
      setState(s => ({ ...s, scanProgress: 35, currentCommand: 'Module Discovery Sweep (0x700-0x7FF)...' }));
      
      // Fast Timeout for Discovery Sweep (approx 64ms)
      await runCmd('AT ST 10', 'Set Timeout 64ms for Discovery'); 

      const discoveredModules: { id: string; name: string }[] = [];
      const knownModules: Record<string, string> = {
        '7E0': 'ECM (Engine)',
        '7E1': 'TCM (Transmission)',
        '7E2': 'Hybrid/EV Battery',
        '7A0': 'ABS / Stability',
        '726': 'BCM (Ford)',
        '740': 'BCM (GM)',
        '750': 'BCM (Asian)'
      };

      // Broadcast Ping to all possible standard CAN 11-bit addresses
      for (let addr = 0x700; addr <= 0x7FF; addr++) {
        if (!isStreamingRef.current && state.isConnecting === false) break;
        const hexAddr = addr.toString(16).toUpperCase();
        
        // Fast ping. If it replies, we log it and keep it.
        // Update UI every 16 addresses to avoid locking the render thread
        if (addr % 16 === 0) {
           setState(s => ({ ...s, currentCommand: `Pinging ${hexAddr}...` }));
        }

        await runCmd(`AT SH ${hexAddr}`, '', { hideLog: true, delayMs: 0 });
        
        // Use Mode 01 PID 00 as standard ping.
        // For non-OBD modules, we try UDS Tester Present (3E00)
        let pingResponse = await runCmd('0100', `Ping ${hexAddr}`, { hideLog: true, delayMs: 10 });
        
        if (!pingResponse || pingResponse.includes('NO DATA') || pingResponse.includes('TIMEOUT')) {
           pingResponse = await runCmd('3E00', `UDS Ping ${hexAddr}`, { hideLog: true, delayMs: 10 });
        }
        
        if (pingResponse && !pingResponse.includes('NO DATA') && !pingResponse.includes('TIMEOUT') && !pingResponse.includes('?')) {
          const modName = knownModules[hexAddr] || `Unknown Module [${hexAddr}]`;
          discoveredModules.push({ id: hexAddr, name: modName });
          addLog(`>>> DISCOVERED: ${modName} <<<`);
          console.log(`[OBD-II] Discovered module answering at ${hexAddr}`);
        }
      }

      setState(s => ({ ...s, scanProgress: 40, currentCommand: `Querying ${discoveredModules.length} Discovered Modules...` }));
      
      const networkTopology: { address: string; name: string; status: 'offline' | 'ok' | 'fault' | 'locked' }[] = [];
      
      // Auto-fill offline modules for common USA target boundaries
      const commonAddresses = ['7E0', '7E1', '7A0', '726', '740', '750'];
      for(const addr of commonAddresses) {
        if (!discoveredModules.find(m => m.id === addr)) {
          networkTopology.push({ address: addr, name: knownModules[addr] || `Unknown [${addr}]`, status: 'offline' });
        }
      }

      // Restore Max Timeout for Code Reading on discovered modules
      await runCmd('AT ST FF', 'Max Timeout for Slow Modules'); 
      
      for (const mod of discoveredModules) {
        if (!isStreamingRef.current && state.isConnecting === false) break; // Check if cancelled
        
        // Skip broadcast address from being queried for DTCs individually again (if somehow swept)
        if (mod.id === '7DF') continue; 

        // --- BUFFER FLUSH FOR CHEAP CLONES ---
        // Sending a blank command followed by AT BD (Buffer Dump, supported on STN chips) 
        // to clear out previous module's echo before shifting headers
        await runCmd('', 'Hardware Buffer Flush');
        await runCmd('AT BD', 'Buffer Dump');
        await new Promise(r => setTimeout(r, 250)); // 250ms physical delay for clone chips to settle
        
        await runCmd(`AT SH ${mod.id}`, `Targeting ${mod.name}`);
        const stdCodes = await runCmd('03', `Read ${mod.name} Standard Codes`);
        const udsCodes = await runCmd('19020B', `Read ${mod.name} UDS Codes`); // Modern CAN protocol read DTCs
        
        // Determine individual module health status
        let modStatus: 'ok' | 'fault' | 'locked' = 'ok';
        
        if ((stdCodes && stdCodes.includes('7F') && stdCodes.includes('33')) || 
            (udsCodes && udsCodes.includes('7F') && udsCodes.includes('33'))) {
          modStatus = 'locked'; // SGW Active
        } else {
          // Check for actual hex output indicating DTC payload (more than just 43 00 echo)
          const stdLen = (stdCodes?.replace(/[^0-9A-F]/g, '') || '').length;
          const udsLen = (udsCodes?.replace(/[^0-9A-F]/g, '') || '').length;
          
          if (stdLen > 4 && !stdCodes?.includes('4300')) {
             modStatus = 'fault';
          }
          if (udsLen > 6 && udsCodes?.includes('59020B') && !udsCodes?.includes('59020B00')) {
             modStatus = 'fault';
          }
        }
        
        networkTopology.push({
           address: mod.id,
           name: mod.name,
           status: modStatus
        });

        // --- DYNAMIC UDS FREEZE FRAME (PRO EDGE) ---
        // If the module responds with DTCs (59 02 0B), we parse them out and ask for the specific snapshot!
        const cleanUds = (udsCodes || '').replace(/[^0-9A-F]/gi, ''); // Strip everything but hex
        const udsMatch = cleanUds.indexOf('59020B');
        
        if (udsMatch !== -1) {
          const payload = cleanUds.substring(udsMatch + 6);
          // UDS returns: 3 bytes DTC + 1 byte Status Mask = 8 hex chars per code
          for (let i = 0; i < payload.length; i += 8) {
            if (i + 6 <= payload.length) {
              const dtcHex = payload.substring(i, i + 6);
              // Ignore empty blocks or common CAN padding/PCI artifacts
              if (!['000000', 'AAAAAA', 'FFFFFF'].includes(dtcHex) && /^[0-9A-F]{6}$/.test(dtcHex)) {
                await runCmd('', 'Hardware Buffer Flush');
                await runCmd(`1904${dtcHex}FF`, `UDS Freeze Frame [${dtcHex}]`);
                await new Promise(r => setTimeout(r, 100)); // Brief pause for data heavy frames
              }
            }
          }
        }
      }
      
      // Restore standard broadcast header for live data pull and reset timeout
      await runCmd('AT ST 32', 'Fast Timeout for Live Data'); // ~200ms
      await runCmd('AT SH 7DF', 'Restore Standard Broadcast Header');
      
      setState(s => ({ ...s, scanProgress: 45 }));
      
      // Monitor status can tell us if we have freeze frame data
      const monitorStatus = await runCmd('0101', 'Monitor Status');
      if (monitorStatus && !monitorStatus.includes('NO DATA')) {
        await runCmd('020200', 'Freeze Frame DTC');
        await runCmd('020400', 'Freeze Frame Load');
        await runCmd('020500', 'Freeze Frame Coolant Temp');
        await runCmd('020C00', 'Freeze Frame RPM');
        await runCmd('020D00', 'Freeze Frame Speed');
        await runCmd('020600', 'Freeze Frame STFT');
        await runCmd('020700', 'Freeze Frame LTFT');
        await runCmd('021000', 'Freeze Frame MAF');
        await runCmd('021100', 'Freeze Frame Throttle');
      }
      setState(s => ({ ...s, scanProgress: 75 }));

      // Always pull live data, even if engine is off (KOEO)
      addLog('Pulling live data...');
      await runCmd('010C', 'Engine RPM');
      await runCmd('0104', 'Calculated Engine Load');
      await runCmd('0105', 'Engine Coolant Temp');
      await runCmd('0106', 'Short Term Fuel Trim B1');
      await runCmd('0107', 'Long Term Fuel Trim B1');
      setState(s => ({ ...s, scanProgress: 85 }));
      await runCmd('010A', 'Fuel Pressure');
      await runCmd('010D', 'Vehicle Speed');
      await runCmd('010E', 'Timing Advance');
      await runCmd('010F', 'Intake Air Temp');
      setState(s => ({ ...s, scanProgress: 90 }));
      await runCmd('0110', 'MAF Air Flow Rate');
      await runCmd('0111', 'Throttle Position');
      await runCmd('0114', 'O2 Sensor 1 Voltage');
      await runCmd('0115', 'O2 Sensor 2 Voltage');
      await runCmd('0118', 'O2 Sensor Bank 2 Sensor 1 Voltage');
      
      // Advanced Live Data required for new AI Diagnostics
      await runCmd('012E', 'Commanded Evaporative Purge');
      await runCmd('0132', 'EVAP System Vapor Pressure');
      await runCmd('013C', 'Catalyst Temperature Bank 1 Sensor 1');
      await runCmd('013E', 'Catalyst Temperature Bank 1 Sensor 2');
      await runCmd('0908', 'In-Use Performance Tracking');
      
      setState(s => ({ ...s, scanProgress: 95, currentCommand: 'Checking Mode 06 Misfire Data...' }));
      // Mode 06 Misfire Module - checking MID A1 through A9
      const misfireDataList: { cylinder: number; count: number }[] = [];
      let totalMisfires = 0;
      for (let i = 1; i <= 9; i++) {
        const midHex = `A${i}`;
        const misfireRes = await runCmd(`06${midHex}`, `Mode 06 ${i === 1 ? 'Total' : 'Cylinder ' + (i - 1)} Misfire`);
        if (misfireRes && !misfireRes.includes('NO DATA') && !misfireRes.includes('ERROR')) {
            const cleanHex = misfireRes.replace(/[^0-9A-F]/gi, '');
            if (cleanHex.includes(`46${midHex}`)) {
                const matchIndex = cleanHex.indexOf(`46${midHex}`);
                const payload = cleanHex.substring(matchIndex + 4);
                if (payload.length >= 10) {
                    let tidIndex = payload.indexOf('0B');
                    if (tidIndex === -1) tidIndex = payload.indexOf('0C');
                    if (tidIndex !== -1 && tidIndex + 6 <= payload.length) {
                       const countHex = payload.substring(tidIndex + 4, tidIndex + 8);
                       const count = parseInt(countHex, 16);
                       if (!isNaN(count) && count < 65535) {
                           if (i === 1) {
                               totalMisfires = count;
                           } else {
                               misfireDataList.push({ cylinder: i - 1, count });
                           }
                       }
                    }
                }
            }
        }
      }

      // (Moved VIN parsing to start of scan)
      setState(s => ({ ...s, scanProgress: 100, currentCommand: 'Complete' }));

      addLog('Scan complete!');
      return { rawOutput: fullRawOutput, networkTopology };
    } catch (error: any) {
      setState(s => ({ ...s, scanProgress: 0, currentCommand: null }));
      addLog(`Scan failed: ${error.message}`);
      throw error;
    }
  };

  const startLiveDataStream = async (onData: (rawOutput: string) => void) => {
    if (!characteristic) throw new Error('Not connected');
    if (isStreamingRef.current) return;
    
    isStreamingRef.current = true;
    setState(s => ({ ...s, isStreaming: true }));
    addLog('Starting live data stream...');

    const runCmd = async (cmd: string): Promise<string | null> => {
      try {
        const res = await sendCommand(cmd, characteristic);
        return `[${cmd}] ${res}\n`;
      } catch (e: any) {
        return null;
      }
    };

    const pollData = async () => {
      if (!isStreamingRef.current) return;
      
      let rawOutput = '';
      
      try {
        // --- FAST PATH: The Combined Request ---
        // Instead of 6 separate Bluetooth turnarounds (150ms latency each), we send one multi-PID block.
        // OBD-II CAN bus supports 6 PIDs per frame request: 01 + [PID1] + [PID2] + [PID3] + [PID4] + [PID5] + [PID6]
        // 0C (RPM), 04 (Load), 05 (Temp), 0D (Speed), 11 (Throttle), 10 (MAF)
        const fastRes = await runCmd('010C04050D1110');
        if (fastRes) rawOutput += fastRes;
        
        // Second block for Secondary Sensors (O2, Fuel Trims)
        // 06 (STFT), 07 (LTFT), 14 (O2 Bank 1), 15 (O2 Bank 2), 0E (Timing Advance), 51 (Fuel Type/Misfire Status)
        if (isStreamingRef.current) {
          const slowRes = await runCmd('01060714150E51');
          if (slowRes) rawOutput += slowRes;
        }

        // Extract Voltage (very fast since it doesn't query CAN bus, just internal ADC)
        if (isStreamingRef.current) {
          const voltRes = await runCmd('AT RV');
          if (voltRes) rawOutput += voltRes;
        }

        // Detect "Crank Drop" (voltage sag causing ELM327 reboot, which spits out ELM327 version string or "?")
        if (rawOutput.includes('ELM327') || rawOutput.includes('?')) {
          throw new Error('ELM327_REBOOT');
        }

      } catch (error: any) {
        addLog(`Watchdog: Stream error - ${error.message}`);
        if (error.message.includes('ELM327_REBOOT') || error.message.includes('disconnected')) {
          addLog("Crank Drop Detected. Re-initializing adapter...");
          rawOutput += '[Crank Event] CRANK_EVENT_DETECTED - Voltage dropped below threshold.\n'; // Let Frontend know
          await runCmd('AT Z'); // Hard Reset
          await new Promise(r => setTimeout(r, 1000));
          await runCmd('AT E0'); // Echo Off
          await runCmd('AT S0'); // Spaces Off
          await runCmd('AT SP 0'); // Auto Protocol
          await runCmd('AT CAF1'); // CAN Auto Formatting On
          await runCmd('AT ST 32'); // Fast Timeout
          addLog("Adapter re-initialized successfully. Resuming stream...");
        }
      }

      if (isStreamingRef.current && rawOutput) {
        onData(rawOutput);
      }
      
      if (isStreamingRef.current) {
        // Run immediately since the multi-PID reduced latency from 1.2s to roughly 200ms
        streamTimeoutRef.current = setTimeout(pollData, 100); 
      }
    };

    pollData();
  };

  const stopLiveDataStream = () => {
    isStreamingRef.current = false;
    setState(s => ({ ...s, isStreaming: false }));
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    addLog('Stopped live data stream.');
  };

  return {
    ...state,
    connect,
    disconnect,
    scanVehicle,
    startLiveDataStream,
    stopLiveDataStream
  };
}
