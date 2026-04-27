import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

// Initialize Firebase Admin recursively
let firebaseConfig;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    initializeApp({ projectId: firebaseConfig.projectId });
  } else {
    console.warn("firebase-applet-config.json not found, auth will fail.");
  }
} catch (e) {
  console.error("Failed to init firebase admin:", e);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Rate Limiting is disabled for AI Studio shared deploys due to proxy issues
  // Apply trust proxy
  app.set("trust proxy", 1);

  // Configuration
  app.use(express.json({ limit: "50mb" })); // To handle large JSON payloads
  
  // CORS Configuration
  app.use(cors({
    origin: '*', // In production, this should map to enginevitals.com
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));

  // Authentication Middleware using Firebase Admin
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    
    // If no header or just 'Bearer ' without a token, treat as guest for demo mode
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer ') {
       (req as any).user = { uid: "guest" };
       return next();
    }
    
    const idToken = authHeader.split('Bearer ')[1].trim();
    if (!idToken) {
       (req as any).user = { uid: "guest" };
       return next();
    }
    
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      // Fallback to guest instead of blocking so Demo Mode still works
      (req as any).user = { uid: "guest" };
      next();
    }
  };

  let apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim() || "";
  
  const aiOpts: any = apiKey ? { apiKey } : {};
  // Configure internal Undici fetch to allow up to 5 minutes before throwing HeadersTimeoutError
  aiOpts.httpOptions = { timeout: 300000 };
  const ai = new GoogleGenAI(aiOpts);

  // API Routes (The Vault)
  app.post("/api/dtc", requireAuth, async (req, res) => {
    try {
      const { dtcs } = req.body;
      if (!dtcs || dtcs.length === 0) {
        console.warn("Invalid dtcs payload:", req.body);
        return res.json({});
      }
      
      const prompt = `
      You are an expert automotive diagnostician. Explain the following OBD-II DTCs in simple, easy-to-understand terms.
      Return the response as a JSON dictionary mapping the DTC to a 1-sentence explanation.
      
      DTCs: ${dtcs.join(', ')}
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      if (response.text) {
        try {
          // Remove Markdown code block if present
          let cleanJson = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return res.json(JSON.parse(cleanJson));
        } catch(e) {
          console.warn("DTC JSON Parse Failed, raw text:", response.text);
          return res.json({ "PARSE_ERROR": response.text });
        }
      }
      return res.json({});
    } catch (error: any) {
      console.error(error);
      let apiErrorMsg = error?.message || error?.toString();
      
      if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the default key can be used.` });
      }

      res.status(500).json({ error: `Failed to fetch DTC explanations: ${apiErrorMsg}` });
    }
  });

  app.post("/api/analyze", requireAuth, async (req, res) => {
    try {
      console.log("Analyze endpoint hit! apiKey being used length:", apiKey.length);
      console.log("Starts with:", apiKey.substring(0, 5));
      console.log("Is ai bound to specific key?", !!apiKey);
      fs.writeFileSync('debug-key.txt', `Analyze endpoint! apiKey length: ${apiKey.length}, Starts with: ${apiKey.substring(0, 5)}`);

      const { vehicle, scanData, labTestData } = req.body;

      const prompt = `
    You are an Empathetic Master Automotive Technician & DIY Advocate with 30 years of experience.
    Tone: Professional, encouraging, radically transparent, and informative. Never talk down to the user, and never gatekeep information.
    The Analogy Engine: Explain complex codes using simple, real-world analogies (e.g., "Think of the catalytic converter like a coffee filter for your exhaust...").

    Analyze the following vehicle information and diagnostic data to provide a detailed diagnosis.

    ${labTestData?.testName ? `
    ==== INTERACTIVE DIAGNOSTIC LAB: ${labTestData.testName} ====
    The user just performed an interactive procedure via the 'Command Center' interface.
    
    Test Data Payload:
    ${JSON.stringify(labTestData.payload, null, 2)}
    
    CRITICAL AI TASK:
    ${labTestData.theory}
    
    Based on the Test Data Payload and the Theory above, did the vehicle pass or fail, and why?
    Put this definitive finding front and center in your overall diagnosis!
    ================================
    ` : ''}

    Vehicle Info:
    - Make: ${vehicle?.make || 'Unknown'}
    - Model: ${vehicle?.model || 'Unknown'}
    - Year: ${vehicle?.year || 'Unknown'}
    - VIN: ${vehicle?.vin || "Not Provided"}
    - Mileage: ${vehicle?.mileage || "Not Provided"}
    - Symptoms: ${vehicle?.symptoms || 'None'}
    
    IMPORTANT: If the VIN or Mileage is "Not Provided", do NOT complain about it or state that the VIN is incorrect/missing. Proceed with the diagnosis using the Make, Model, and Year provided.

    Scan Tool Data:
    ${scanData ? `
    - DTCs: ${scanData.dtcInfo ? scanData.dtcInfo.map((d: any) => `${d.code} (${d.status})`).join(", ") : scanData.dtcs?.join(", ") || "None"}
    - Short Term Fuel Trim: ${scanData.fuelTrimShortTerm !== undefined ? scanData.fuelTrimShortTerm : "N/A"}%
    - Long Term Fuel Trim: ${scanData.fuelTrimLongTerm !== undefined ? scanData.fuelTrimLongTerm : "N/A"}%
    - Coolant Temp: ${scanData.coolantTemp !== undefined ? scanData.coolantTemp : "N/A"}°C
    - RPM: ${scanData.rpm !== undefined ? scanData.rpm : "N/A"}
    - Engine Load: ${scanData.load !== undefined ? scanData.load : "N/A"}%
    - MAF: ${scanData.maf !== undefined ? scanData.maf : "N/A"} g/s
    - O2 Sensor Voltage: ${scanData.o2Voltage !== undefined ? scanData.o2Voltage : "N/A"}V
    
    // EXTREMELY ADVANCED DIAGNOSTICS - The Master Tech Math Modules
    - Intake Air Temp: ${scanData.intakeAirTemp !== undefined ? scanData.intakeAirTemp : "N/A"}°C
    - EVAP Purge Commanded: ${scanData.evapPurge !== undefined ? scanData.evapPurge : "N/A"}%
    - EVAP Vapor Pressure: ${scanData.evapVaporPressure !== undefined ? scanData.evapVaporPressure : "N/A"} Pa
    - Cat Temp B1S1 (Upstream): ${scanData.catTempB1S1 !== undefined ? scanData.catTempB1S1 : "N/A"}°C
    - Cat Temp B1S2 (Downstream): ${scanData.catTempB1S2 !== undefined ? scanData.catTempB1S2 : "N/A"}°C
    
    In-Use Performance Tracking (Mode $09 PID $08):
    - Ignition Cycles: ${scanData.ipt?.ignitionCycles ?? "N/A"}
    - Catalyst Monitor Completed Runs: ${scanData.ipt?.catalystRuns ?? "N/A"}
    
    I/M Readiness Monitors:
    - Complete: ${scanData.readinessComplete?.join(", ") || "N/A"}
    - Incomplete: ${scanData.readinessIncomplete?.join(", ") || "N/A"}
    
    MASTER TECH INSTRUCTIONS (MANDATORY):
    1. THE "USED CAR SCAM" DETECTOR: Look at In-Use Performance Tracking (IPT). If DTCs are zero, but the Catalyst Monitor runs are vastly lower than the Ignition Cycles (e.g., ran 1 time in 100 cycles), the Diagnostic Memory was RECENTLY WIPED. Flag this heavily in the summary: "Alert: The diagnostic memory was recently wiped. The vehicle has not been driven long enough to prove it is healthy. Proceed with caution."
    2. THE SMOG PASS PREDICTOR: Look at the I/M Readiness Monitors. If ANY monitor is "Incomplete" (like EVAP or Catalyst), explicitly warn the user: "Your check engine light is off, but your monitors are INCOMPLETE. If you go to the inspection station right now, you will fail. Drive the vehicle on the highway at 55mph for 15 minutes to set the monitors."
    3. THE "BREATHING TEST" (Volumetric Efficiency): If RPM is high (>3000) and Load is high but fuel trims are normal, calculate Volumetric Efficiency (VE) using the provided MAF (g/s), IAT, and RPM. A naturally aspirated engine at wide-open throttle should hit 80-90% VE. If it drops heavily (e.g. 50%), instruct the user: "Your engine isn't breathing. Because Volumetric Efficiency is mathematically starved, you either have a completely clogged catalytic converter or a blocked air intake."
    4. EVAP SYSTEM TESTING: If the user provides a P0456 (Very Small EVAP Leak), instruct them to use the interactive Live Data to monitor EVAP Vapor Pressure while manipulating the gas cap. Provide real-time test instructions. 
    5. EXHAUST & CATALYST TEMPS: Compare Cat Temp B1S1 (upstream) vs B1S2 (downstream). A catalytic converter creates heat when it functions (exothermic reaction). Therefore, B1S2 MUST be hotter than B1S1. If B1S1 is hotter than B1S2 (e.g., 800C vs 750C), state: "Your catalytic converter is physically dead. It is no longer creating an exothermic reaction to clean your exhaust."
    
    DTC STATUS TRIAGE LOGIC:
    - If a code is PENDING: The AI must say, "This is a Pending code. Your car's computer noticed a glitch, but it hasn't happened enough times to trigger the Check Engine Light. Do not buy parts yet. Let's clear it and see if it comes back, or perform a visual inspection first."
    - If a code is STORED/ACTIVE: The AI must say, "This is an Active/Stored code. The computer has verified this failure, and it is currently causing your Check Engine Light. Proceed with the repair guide below."
    - If a code is PERMANENT: The AI must add a crucial warning at the end of the repair guide: "Master Tech Note: This is a Permanent Code. Once you finish the repair, clicking 'Clear Codes' on your scanner will turn off the light, but this specific code will remain hidden in the computer's memory until you drive the car for a few days and the computer verifies the fix."

    RAW SCANNER OUTPUT:
    ${scanData.rawOutput || "No raw data available"}
    
    INSTRUCTIONS FOR RAW DATA:
    - We performed a comprehensive CAN Network Discovery sweeping addresses from 0x700 to 0x7FF using Broadcast Pings.
    - Specifically check for manufacturer-specific Chassis (C-Codes), Body (B-Codes), and Communication (U-Codes).
    - TIERED PRIORITIZATION: You must categorize the discovered modules and their faults into three Tiers (Tier 1 Critical, Tier 2 Operational, Tier 3 Convenience).

    VEHICLE-SPECIFIC QUIRK LIBRARY:
    - If the VIN decodes as a Subaru Boxer Engine, apply this context: Cylinder 3 runs notoriously hotter than the others due to the exhaust manifold routing and coolant flow. If Mode $06 shows low-level misfires (EWMA) on Cylinder 3 specifically, prioritize checks for spark plug tube seal oil leaks or ignition coil thermal breakdown before suggesting expensive mechanical repairs.
    
    ${scanData.misfireData && scanData.misfireData.length > 0 ? `
    MODE 06 MISFIRE DATA:
    Total Misfires (06A1): ${scanData.totalMisfires !== undefined ? scanData.totalMisfires : 'Unknown'}
    ${scanData.misfireData.map((m: any) => `Cylinder ${m.cylinder}: ${m.count} misfires`).join('\\n')}
    
    MISFIRE LOGIC INSTRUCTION & VARIANCE CALCULATOR:
    1. Variance Math: Compare the misfire count of the highest-firing cylinder against the average of the other cylinders. If one cylinder is >50% higher than the rest, explicitly flag it as 'Anomalous Behavior'.
    2. Total vs Isolated: If the individual cylinders look clean (0 counts) but Total Misfires (06A1) is high, it points to a Global Issue.
    3. Component Swap: If an isolated cylinder misfire is found, recommend: "Swap the ignition coil from Cylinder [X] to Cylinder [Y] to see if the misfire follows the part."
    ` : ''}
    ` : ''}
    
    Return the response strictly as JSON matching this structure:
    {
      "overallSeverity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "INFO",
      "possibleIssues": [
        {
          "title": "...",
          "description": "...",
          "probability": 0.95, // MUST be a number between 0.0 and 1.0!
          "severity": "high", // MUST be "low", "medium", "high", or "critical"
          "recommendedAction": "...",
          "estimatedCost": "...",
          "partsNeeded": ["...", "..."],
          "technicalDetails": "..."
        }
      ],
      "maintenanceAdvice": "...",
      "aiConfidenceScore": 95,
      "summary": "...",
      "safetyWarning": "..."
    }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      
      if (response.text) {
        try {
          // Remove Markdown code block if present
          let cleanJson = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return res.json(JSON.parse(cleanJson));
        } catch(e) {
             console.error("Analyze JSON Parse Failed, raw text:", response.text);
             throw new Error("AI returned malformed JSON");
        }
      }
      return res.status(500).json({ error: "Empty AI response" });
    } catch (error: any) {
      console.error(error);
      let apiErrorMsg = error?.message || error?.toString();

      // Catch strict API Key errors from the SDK
      if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         console.error(`Attempted generating content with key: ${keyPrefix}`);
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the system can provide the default secure key automatically.` });
      }
      
      res.status(500).json({ error: `Failed to analyze vehicle: ${apiErrorMsg}` });
    }
  });

  app.post("/api/consult", requireAuth, async (req, res) => {
    try {
      const { vehicle, cylinder, count } = req.body;
      const prompt = `
      The user has a ${vehicle.year} ${vehicle.make} ${vehicle.model} (VIN: ${vehicle.vin || 'Unknown'}).
      The OBD2 Mode $06 monitor is showing ${count} misfires specifically on Cylinder ${cylinder}.
      
      Provide a highly technical, 2-3 sentence insight into what commonly causes a misfire on THIS EXACT cylinder for THIS EXACT engine family.
      If it's a known quirk (e.g. Ford 5.4L Triton passenger rear, or Subaru Cyl 3), explicitly mention the factory flaw or design reason.
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt
      });
      res.json({ result: response.text });
    } catch (error: any) {
      console.error(error);
      let apiErrorMsg = error?.message || error?.toString();
      if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the default key can be used.` });
      }
      res.status(500).json({ error: `Failed to consult: ${apiErrorMsg}` });
    }
  });

  app.post("/api/mechanic", requireAuth, async (req, res) => {
    try {
      const { prompt: userPrompt, history } = req.body;
      const prompt = `
      You are a Master Automotive Technician helping a DIYer.

      Previous Conversation History:
      ${history ? JSON.stringify(history) : 'None'}
      
      User's Question: "${userPrompt}"
      
      Please answer the question accurately and professionally, leaning into technical specifics when applicable.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt
      });
      res.json({ result: response.text });
    } catch (error: any) {
       console.error(error);
       let apiErrorMsg = error?.message || error?.toString();
       if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the default key can be used.` });
       }
       res.status(500).json({ error: `Failed to query mechanic: ${apiErrorMsg}` });
    }
  });


  app.post("/api/maintenance", requireAuth, async (req, res) => {
    try {
      const { make, model, year, mileage } = req.body;
      const prompt = `
        Generate a maintenance schedule for a ${year} ${make} ${model} with currently ${mileage} miles.
        Return ONLY a valid JSON array of objects with the following structure:
        [
          {
            "service": "Oil Change",
            "dueAtMileage": 55000,
            "description": "Replace engine oil and filter",
            "completed": false
          }
        ]
        Provide 5-7 upcoming maintenance items based on the current mileage. Ensure the JSON is valid and contains no markdown formatting.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      let text = response.text || "";
      // Strip markdown
      const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      res.json({ result: cleanJson });
    } catch (error: any) {
       console.error(error);
       let apiErrorMsg = error?.message || error?.toString();
       if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the default key can be used.` });
       }
       res.status(500).json({ error: `Failed to generate maintenance schedule: ${apiErrorMsg}` });
    }
  });

  app.post("/api/smart-reply", requireAuth, async (req, res) => {
    try {
      const { issueDescription, vehicleInfo } = req.body;
      const prompt = `
        You are a professional auto mechanic responding to a customer inquiry.
        The customer's reported issue is: "${issueDescription}"
        The vehicle is a ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}.
        
        Draft a polite, professional, and helpful response (under 3 sentences) acknowledging their issue, 
        briefly explaining what it might be, and suggesting they bring it in for a formal diagnosis or repair.
        Do not include placeholders like [Shop Name] or [Your Name].
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      res.json({ result: response.text });
    } catch (error: any) {
       console.error(error);
       let apiErrorMsg = error?.message || error?.toString();
       if (apiErrorMsg.includes("API key not valid")) {
         const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "EMPTY";
         return res.status(401).json({ error: `API Key is invalid (Starts with: ${keyPrefix}). If you manually added GEMINI_API_KEY to AI Studio Settings, please DELETE it so the default key can be used.` });
       }
       res.status(500).json({ error: `Failed to generate smart reply: ${apiErrorMsg}` });
    }
  });

  let vite: any;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown to prevent zombie ports
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    server.close();
    if (vite) {
      try { await vite.close(); } catch(e) {}
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
