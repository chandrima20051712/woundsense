// AppContext.tsx — global React context for analysis state

import { createContext } from "react";
import type { AnalysisResult } from "../types";

interface AppContextType {
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (r: AnalysisResult | null) => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (v: boolean) => void;
  currentWoundId: string | null;
  setCurrentWoundId: (id: string | null) => void;
  isProgressModalVisible: boolean;
  setIsProgressModalVisible: (visible: boolean) => void;
}

export const defaultState: AppContextType = {
  analysisResult: null,
  setAnalysisResult: () => {},
  isOfflineMode: false,
  setIsOfflineMode: () => {},
  currentWoundId: null,
  setCurrentWoundId: () => {},
  isProgressModalVisible: false,
  setIsProgressModalVisible: () => {},
};

export const AppContext = createContext<AppContextType>(defaultState);
