// types.ts — shared TypeScript types for WoundSense mobile app

export interface AnalysisResult {
  wound_area_cm2: number;
  wound_perimeter_cm: number;
  wound_dimensions_cm: number[] | null;
  precision_mm: number;
  coin_detected: boolean;
  time_scores: { T: number; I: number; M: number; E: number };
  tissue_ratios: {
    granulation: number;
    slough: number;
    necrotic: number;
    epithelial: number;
  };
  wound_condition: string;
  recommendations: string[];
  masked_image: string;       // base64 JPEG
  inference_ms: number;
  model_mode: string;
}

export interface HistoryEntry {
  id: string;
  date: string;              // ISO timestamp
  result: AnalysisResult;
}

// ==================== PATIENT & WOUND TRACKING ====================

export interface Patient {
  id: string;
  name: string;
  phone: string;
  gender?: string;           // M/F/Other
  age?: number;
  created_at: string;        // ISO timestamp
  wounds_count?: number;     // Count of wounds for this patient
}

export interface PatientCreate {
  name: string;
  phone: string;
  gender?: string;
  age?: number;
}

export interface Wound {
  id: string;
  patient_id: string;
  wound_type: string;        // e.g., "diabetic", "pressure", "surgical"
  location: string;          // e.g., "left foot", "right heel"
  status: string;            // "open", "closed", "infected"
  created_at: string;        // ISO timestamp
  closed_at?: string | null; // ISO timestamp or null
  analyses_count?: number;   // Count of daily analyses
}

export interface WoundCreate {
  patient_id: string;
  wound_type: string;
  location: string;
  status?: string;
}

export interface DailyAnalysis extends AnalysisResult {
  id: string;
  wound_id: string;
  date: string;              // YYYY-MM-DD
  created_at: string;        // ISO timestamp
}

export interface ProgressStatistics {
  total_days: number;
  photos_count: number;
  initial_area_cm2: number;
  final_area_cm2: number;
  area_change_cm2: number;
  area_change_percent: number;
  area_trend: "improving" | "stable" | "worsening";
  avg_tissue_health: number;
}

export interface WoundProgress {
  wound_id: string;
  patient_name: string;
  patient_phone: string;
  wound_type: string;
  location: string;
  status: string;
  created_at: string;
  analyses: DailyAnalysis[];
  statistics?: ProgressStatistics;
}
