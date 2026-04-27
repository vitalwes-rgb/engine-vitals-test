export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'mechanic' | 'customer' | 'user';
  shopInfo?: ShopInfo;
  isPublicShop?: boolean;
  updatedAt?: string;
  notificationPreferences?: {
    emailDiagnosticReports: boolean;
    emailShopInquiries: boolean;
  };
}

export interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  vin?: string;
  mileage?: string;
  symptoms: string;
  customPrompt?: string;
  manualDTCs?: string;
}

export interface FreezeFrameData {
  dtc: string;
  rpm?: number;
  load?: number;
  coolantTemp?: number;
  fuelTrimShortTerm?: number;
  fuelTrimLongTerm?: number;
  vehicleSpeed?: number;
  intakeAirTemp?: number;
  maf?: number;
  throttlePosition?: number;
  fuelPressure?: number;
  o2VoltageBank1Sensor1?: number;
  o2VoltageBank1Sensor2?: number;
  supportedPids1to20?: string;
  supportedPids21to40?: string;
}

export interface LiveData {
  rpm?: number;
  load?: number;
  coolantTemp?: number;
  fuelTrimShortTerm?: number;
  fuelTrimLongTerm?: number;
  vehicleSpeed?: number;
  intakeAirTemp?: number;
  maf?: number;
  throttlePosition?: number;
  o2VoltageBank1Sensor1?: number;
  o2VoltageBank1Sensor2?: number;
  o2VoltageBank2Sensor1?: number;
  o2VoltageBank2Sensor2?: number;
  fuelPressure?: number;
  timingAdvance?: number;
  map?: number;
  barometricPressure?: number;
  controlModuleVoltage?: number;
  engineOilTemp?: number;
  fuelLevel?: number;
  supportedPids1to20?: string;
  supportedPids21to40?: string;
}

export interface ScanToolData {
  dtcs: string[]; // Diagnostic Trouble Codes
  dtcInfo?: { code: string; status: 'PENDING' | 'STORED' | 'PERMANENT' }[]; // Detailed DTC info with statuses
  freezeFrames?: FreezeFrameData[];
  liveData?: LiveData;
  liveDataHistory?: LiveData[]; // rolling array of live data snapshots for AI trend analysis
  protocol?: string;
  networkTopology?: {
    address: string;
    name: string;
    status: 'offline' | 'ok' | 'fault' | 'locked';
  }[];
  fuelTrimShortTerm?: number;
  fuelTrimLongTerm?: number;
  coolantTemp?: number;
  rpm?: number;
  load?: number;
  maf?: number;
  o2Voltage?: number;
  o2VoltageBank1Sensor1?: number;
  o2VoltageBank1Sensor2?: number;
  o2VoltageBank2Sensor1?: number;
  vehicleSpeed?: number;
  intakeAirTemp?: number;
  throttlePosition?: number;
  timingAdvance?: number;
  fuelPressure?: number;
  map?: number; // Manifold Absolute Pressure
  barometricPressure?: number;
  controlModuleVoltage?: number;
  engineOilTemp?: number;
  fuelLevel?: number;
  totalMisfires?: number;
  misfireMonitorActive?: boolean;
  misfireData?: { cylinder: number; count: number }[];
  rawOutput?: string; // Raw hex output from ELM327 Bluetooth
  vin?: string; // Optional VIN read from ECU
  
  // Smog Readiness (Mode $01 PID $01)
  readinessComplete?: string[];
  readinessIncomplete?: string[];
  
  // Advanced Diagnostics
  evapPurge?: number; // Mode 01 PID 2E
  evapVaporPressure?: number; // Mode 01 PID 32
  catTempB1S1?: number; // Mode 01 PID 3C
  catTempB1S2?: number; // Mode 01 PID 3E
  
  // Mode $09 In-Use Performance Tracking (PID $08)
  ipt?: {
    ignitionCycles: number;
    catalystRuns: number;
    ratio: number;
  };
}

export interface DiagnosisResult {
  overallSeverity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';
  possibleIssues: {
    title: string;
    description: string;
    probability: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  recommendedFixes: {
    step: string;
    description: string;
    estimatedCost?: string;
    difficulty: 'easy' | 'moderate' | 'hard';
    recommendShop?: boolean;
    guide?: RepairGuide;
  }[];
  partsNeeded: {
    name: string;
    estimatedPrice?: string;
    link?: string;
  }[];
  tsbs?: {
    id: string;
    title: string;
    description: string;
  }[];
  componentLocation?: {
    component: string;
    location: string;
    diagramDescription?: string;
  }[];
  quickSpecs?: {
    label: string;
    value: string;
  }[];
  diagnosticWorkflow?: {
    step: string;
    description: string;
    expectedResult?: string;
  }[];
  costEstimate?: {
    laborHours: number;
    laborRateRange: { min: number; max: number };
    totalLaborCostRange: { min: number; max: number };
    totalPartsCost: number;
    taxRate: number;
    taxAmountRange: { min: number; max: number };
    totalEstimatedCostRange: { min: number; max: number };
    negotiationTips: string[];
  };
  predictiveMaintenance?: {
    service: string;
    mileageDue: string;
    description: string;
  }[];
  summary: string;
}

export interface ShopInfo {
  name: string;
  logo?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  about?: string;
  specialties?: string[];
  rating?: number;
}

export interface DiagnosisRecord {
  id?: string;
  uid: string;
  vehicleInfo: VehicleInfo;
  scanData: ScanToolData | null;
  result: DiagnosisResult;
  mediaUrls: string[];
  createdAt: any; // Firestore Timestamp
  shopInfo?: ShopInfo;
  shareToken?: string;
}

export interface RepairGuide {
  title: string;
  steps: {
    title: string;
    description: string;
    tools?: string[];
    warning?: string;
    mediaUrl?: string;
  }[];
  estimatedTime?: string;
  difficulty: 'easy' | 'moderate' | 'hard';
}

export interface Review {
  id?: string;
  shopId: string;
  userId: string;
  inquiryId?: string;
  rating: number;
  comment: string;
  createdAt: any;
  userName: string;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website?: string;
  rating: number;
  reviewCount?: number;
  specialties: string[];
  logoUrl?: string;
  isPublic?: boolean;
  isPremium?: boolean;
  lat?: number;
  lng?: number;
  isVerified?: boolean;
  hours?: string;
  about?: string;
  photos?: string[];
  notificationPreferences?: {
    emailNewInquiries: boolean;
    emailMarketing: boolean;
  };
}

export interface ShopInquiry {
  id?: string;
  shopId: string;
  userId: string;
  diagnosisId: string;
  status: 'pending' | 'responded' | 'closed';
  createdAt: any;
  message?: string;
  issueDescription?: string;
  vehicleInfo?: VehicleInfo;
  unreadCountShop?: number;
  unreadCountUser?: number;
  lastMessageAt?: any;
  appointment?: {
    date: string;
    time: string;
    status: 'requested' | 'confirmed' | 'declined';
  };
  isReviewed?: boolean;
}

export interface EstimateDetails {
  parts: number;
  labor: number;
  tax: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface InquiryMessage {
  id?: string;
  inquiryId: string;
  senderId: string;
  text: string;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  type?: 'text' | 'estimate' | 'system';
  estimateDetails?: EstimateDetails;
}



export interface MaintenanceItem {
  service: string;
  dueAtMileage: number;
  description: string;
  completed: boolean;
}

export interface ScanHistoryItem {
  date: string;
  mileage: number;
  dtcCount: number;
  misfires: number;
  fuelTrimShortTerm?: number;
  fuelTrimLongTerm?: number;
  volumetricEfficiency?: number;
  overallSeverity?: string;
  diagnosisId?: string;
}

export interface Vehicle {
  id?: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  vin?: string;
  maintenanceSchedule: MaintenanceItem[];
  scanHistory?: ScanHistoryItem[];
  createdAt: any;
}

export interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}
