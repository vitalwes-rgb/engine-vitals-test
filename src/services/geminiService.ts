import { DiagnosisResult, ScanToolData, VehicleInfo } from '../types';

import { auth } from '../firebase';

// The URL should be relative so it utilizes the same host running Express in production/preview
const API_BASE = "https://engine-vitals-test.onrender.com/api";

async function getAuthHeaders() {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

export async function fetchDTCExplanations(dtcs: string[]): Promise<Record<string, string>> {
  if (!dtcs || dtcs.length === 0) return {};
  
  try {
    const res = await fetch(`${API_BASE}/dtc`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ dtcs })
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Network response was not ok: ${res.status} ${res.statusText} - ${errText}`);
    }
    return await res.json();
  } catch (e) {
    console.error("Error fetching DTC explanations:", e);
    return {};
  }
}

export async function analyzeVehicle(
  vehicle: VehicleInfo,
  scanData: ScanToolData | null,
  media: { data: string; mimeType: string }[] = [],
  onProgress?: (partialResult: Partial<DiagnosisResult>) => void,
  labTestData?: any
): Promise<DiagnosisResult> {
  try {
    if (onProgress) {
        onProgress({ possibleIssues: [], summary: "Connecting to secure Cloud Brain...", overallSeverity: "INFO" });
    }
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ vehicle, scanData, media, labTestData })
    });
    
      if (!res.ok) {
        const errText = await res.text();
        let parsedErr = errText;
        try { parsedErr = JSON.parse(errText).error || errText; } catch {}
        throw new Error(`Analysis failed (${res.status}): ${parsedErr}`);
    }
    const responseText = await res.text();
    try {
        return JSON.parse(responseText);
    } catch (parseError) {
        if (responseText.trim().startsWith('<')) {
             console.error("HTML Response instead of JSON. Likely intercepted by AI Studio Gateway.");
             throw new Error(`The API request was blocked and returned a web page instead of data. If you opened the Dev URL in a new tab, the system may be trying to force a Google Login. Please use the public 'Share' link instead!`);
        }
        console.error("Failed to parse response as JSON:", responseText.substring(0, 500));
        throw new Error(`Server returned an invalid response (not JSON). Status: ${res.status}. Body start: ${responseText.substring(0, 40)}`);
    }
  } catch (e) {
    console.error("Error analyzing vehicle:", e);
    throw e;
  }
}

export async function askMechanic(
  prompt: string,
  history: any[]
): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/mechanic`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ prompt, history })
    });
    if (!res.ok) throw new Error("Failed to consult mechanic");
    const responseText = await res.text();
    try {
        const data = JSON.parse(responseText);
        return data.result || "No response";
    } catch (e) {
        if (responseText.trim().startsWith('<')) {
            throw new Error(`The API request was blocked by Cloud proxy. Ensure you are using the correct deployment URL.`);
        }
        throw e;
    }
  } catch (e) {
    console.error("Error querying mechanic:", e);
    return "Error querying the backend.";
  }
}

export async function consultCylinderAnomaly(vehicle: VehicleInfo, cylinder: number, count: number): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/consult`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ vehicle, cylinder, count })
    });
    if (!res.ok) throw new Error("Failed to consult anomaly");
    const data = await res.json();
    return data.result || "No response";
  } catch (e) {
    console.error("Error querying cylinder anomaly:", e);
    return "Error getting cylinder details.";
  }
}

export async function generateMaintenanceScheduleAPI(make: string, model: string, year: number, mileage: number) {
  try {
    const res = await fetch(`${API_BASE}/maintenance`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ make, model, year, mileage })
    });
    if (!res.ok) {
        const errText = await res.text();
        let parsedErr = errText;
        try { parsedErr = JSON.parse(errText).error || errText; } catch {}
        throw new Error(`Failed to generate schedule: ${parsedErr}`);
    }
    const data = await res.json();
    return data.result;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function generateSmartReplyAPI(issueDescription: string, vehicleInfo: any) {
  try {
    const res = await fetch(`${API_BASE}/smart-reply`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ issueDescription, vehicleInfo })
    });
    if (!res.ok) {
        const errText = await res.text();
        let parsedErr = errText;
        try { parsedErr = JSON.parse(errText).error || errText; } catch {}
        throw new Error(`Failed to generate smart reply: ${parsedErr}`);
    }
    const data = await res.json();
    return data.result;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
