/**
 * historyStorage.ts — persist wound analysis history with AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisResult, HistoryEntry } from "../types";

const STORAGE_KEY = "woundsense_history";

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as HistoryEntry[];
}

export async function saveToHistory(result: AnalysisResult): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    result,
  };
  const history = await getHistory();
  history.unshift(entry);
  // Keep last 50 entries
  if (history.length > 50) history.length = 50;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return entry;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
