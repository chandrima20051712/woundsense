import React, { createContext, useState, useContext } from "react";
import type { Patient, Wound } from "../types";

interface PatientContextType {
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  selectedWound: Wound | null;
  setSelectedWound: (w: Wound | null) => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);

  return (
    <PatientContext.Provider
      value={{
        selectedPatient,
        setSelectedPatient,
        selectedWound,
        setSelectedWound,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientContext(): PatientContextType {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error("usePatientContext must be used within PatientProvider");
  }
  return context;
}
