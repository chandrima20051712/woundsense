/**
 * woundApi.ts — API client for WoundSense backend.
 */

import { Platform } from "react-native";
import type {
  AnalysisResult,
  Patient,
  PatientCreate,
  Wound,
  WoundCreate,
  DailyAnalysis,
  WoundProgress,
} from "../types";

const API_BASE_URL = __DEV__
  ? "http://localhost:8000"  // Backend runs on 8000
  : "https://woundsense-production.up.railway.app";

const TIMEOUT_MS = 30_000;

// ==================== EXISTING ANALYSIS ENDPOINTS ====================

export async function analyzeWound(
  photoUri: string,
  offlineMode: boolean = false,
): Promise<AnalysisResult> {
  if (offlineMode) {
    return analyzeWoundOffline();
  }

  const formData = new FormData();
  formData.append("photo", {
    uri: photoUri,
    type: "image/jpeg",
    name: "wound.jpg",
  } as any);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${response.status}`);
    }

    return await response.json() as AnalysisResult;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out — check network or use offline mode");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeWoundTracked(
  photoUri: string,
  woundId: string,
  analysisDate?: string,
): Promise<DailyAnalysis> {
  console.log(`📸 analyzeWoundTracked called: wound=${woundId}, uri=${photoUri.slice(0, 50)}...`);
  const formData = new FormData();

  // Convert image URI to Blob for web compatibility
  try {
    console.log(`🔄 Attempting to fetch blob from photoUri...`);
    const response = await fetch(photoUri);
    console.log(`✅ Fetch successful: status=${response.status}, ok=${response.ok}`);
    const blob = await response.blob();
    console.log(`✅ Blob created: size=${blob.size} bytes, type=${blob.type}`);
    formData.append("photo", blob, "wound.jpg");
  } catch (err) {
    console.warn(`⚠️ Fetch failed, falling back to React Native format:`, err);
    // Fallback for React Native
    formData.append("photo", {
      uri: photoUri,
      type: "image/jpeg",
      name: "wound.jpg",
    } as any);
  }

  formData.append("wound_id", woundId);
  if (analysisDate) {
    formData.append("analysis_date", analysisDate);
  }
  console.log(`📦 FormData prepared. Sending to ${API_BASE_URL}/api/v1/analyze/tracked`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/analyze/tracked`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("📡 Backend error response:", err);
      throw new Error(err.detail || err.error || `Server error ${response.status}`);
    }

    return await response.json() as DailyAnalysis;
  } catch (error: any) {
    console.error("❌ analyzeWoundTracked error:", error);
    if (error.name === "AbortError") {
      throw new Error("Request timed out — check network or use offline mode");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generatePdfReport(result: AnalysisResult): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    throw new Error("Failed to generate PDF report");
  }

  const blob = await response.blob();
  // Convert blob to base64 data URI for sharing
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function analyzeWoundOffline(): Promise<AnalysisResult> {
  // Simulate inference delay
  await new Promise(res => setTimeout(res, 1800));

  return {
    wound_area_cm2: 8.7,
    wound_perimeter_cm: 11.4,
    wound_dimensions_cm: [3.8, 2.9],
    precision_mm: 12.0,
    coin_detected: false,
    time_scores: { T: 0.45, I: 0.2, M: 0.55, E: 0.35 },
    tissue_ratios: { granulation: 55, slough: 30, necrotic: 10, epithelial: 5 },
    wound_condition: "Moderate — Review Required",
    recommendations: [
      "Debride necrotic tissue — enzymatic or autolytic debridement",
      "Moisture balanced — continue current dressing regimen",
      "Monitor for infection — increased dressing frequency recommended",
      "✅ Good granulation — wound healing well; maintain current care",
    ],
    masked_image: "",
    inference_ms: 1800,
    model_mode: "offline-demo",
  };
}

// ==================== PATIENT MANAGEMENT ====================

export async function createPatient(patient: PatientCreate): Promise<Patient> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create patient`);
  }

  return await response.json() as Patient;
}

export async function getPatients(skip: number = 0, limit: number = 100): Promise<Patient[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/patients?skip=${skip}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch patients");
  }

  return await response.json() as Patient[];
}

export async function getPatient(patientId: string): Promise<Patient> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${patientId}`);

  if (!response.ok) {
    throw new Error("Patient not found");
  }

  return await response.json() as Patient;
}

// ==================== WOUND MANAGEMENT ====================

export async function createWound(wound: WoundCreate): Promise<Wound> {
  const response = await fetch(`${API_BASE_URL}/api/v1/wounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wound),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create wound");
  }

  return await response.json() as Wound;
}

export async function getPatientWounds(
  patientId: string,
  status?: string
): Promise<Wound[]> {
  let url = `${API_BASE_URL}/api/v1/patients/${patientId}/wounds`;
  if (status) {
    url += `?status=${status}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch wounds");
  }

  return await response.json() as Wound[];
}

export async function closeWound(woundId: string): Promise<Wound> {
  const response = await fetch(`${API_BASE_URL}/api/v1/wounds/${woundId}/close`, {
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("Failed to close wound");
  }

  return await response.json() as Wound;
}

// ==================== WOUND PROGRESS ====================

export async function getWoundProgress(woundId: string): Promise<WoundProgress> {
  const response = await fetch(`${API_BASE_URL}/api/v1/wounds/${woundId}/progress`);

  if (!response.ok) {
    throw new Error("Failed to fetch wound progress");
  }

  return await response.json() as WoundProgress;
}

export async function getDailyAnalysis(
  woundId: string,
  date: string
): Promise<DailyAnalysis> {
  const response = await fetch(`${API_BASE_URL}/api/v1/wounds/${woundId}/daily/${date}`);

  if (!response.ok) {
    throw new Error("Analysis not found for this date");
  }

  return await response.json() as DailyAnalysis;
}

// Alias for convenience in ProgressModal
export const fetchWoundProgress = getWoundProgress;
