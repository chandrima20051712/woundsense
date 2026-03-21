/**
 * ResultsScreen.tsx — Display wound analysis results.
 * Shows: masked wound image, area, tissue donut, TIME heatmap, recommendations.
 * Supports: share PDF report via WhatsApp/system share.
 */

import React, { useContext, useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Share, Image, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppContext } from "../context/AppContext";
import { usePatientContext } from "../context/PatientContext";
import { saveToHistory } from "../utils/historyStorage";
import { generatePdfReport } from "../api/woundApi";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { AnalysisResult } from "../types";

// ── Tissue Donut (pure RN, no charting lib) ────────────────────────────────
function TissueBar({ ratios }: { ratios: Record<string, number> }) {
  const colours: Record<string, string> = {
    granulation: "#ef4444",
    slough: "#eab308",
    necrotic: "#1e293b",
    epithelial: "#22d3ee",
  };
  const labels: Record<string, string> = {
    granulation: "Granulation", slough: "Slough",
    necrotic: "Necrotic", epithelial: "Epithelial",
  };
  return (
    <View>
      {/* Stacked bar */}
      <View style={tissueBarStyles.bar}>
        {Object.entries(ratios).map(([type, pct]) =>
          pct > 0 ? (
            <View
              key={type}
              style={[tissueBarStyles.segment, { flex: pct, backgroundColor: colours[type] ?? "#94a3b8" }]}
            />
          ) : null
        )}
      </View>
      {/* Legend */}
      <View style={tissueBarStyles.legend}>
        {Object.entries(ratios).map(([type, pct]) =>
          pct > 0 ? (
            <View key={type} style={tissueBarStyles.legendItem}>
              <View style={[tissueBarStyles.legendDot, { backgroundColor: colours[type] ?? "#94a3b8" }]} />
              <Text style={tissueBarStyles.legendText}>{labels[type] ?? type}: {pct}%</Text>
            </View>
          ) : null
        )}
      </View>
    </View>
  );
}
const tissueBarStyles = StyleSheet.create({
  bar: { height: 28, borderRadius: 14, overflow: "hidden", flexDirection: "row", marginBottom: 12 },
  segment: {},
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: "#475569" },
});

// ── TIME Heatmap ─────────────────────────────────────────────────────────────
function TimeHeatmap({ scores }: { scores: Record<string, number> }) {
  const labels: Record<string, string> = {
    T: "Tissue", I: "Infection", M: "Moisture", E: "Edge",
  };
  const getColour = (score: number) => {
    if (score < 0.3) return "#22c55e";
    if (score < 0.6) return "#eab308";
    return "#ef4444";
  };
  return (
    <View style={heatStyles.grid}>
      {Object.entries(scores).map(([key, val]) => (
        <View key={key} style={[heatStyles.cell, { backgroundColor: getColour(val) }]}>
          <Text style={heatStyles.letter}>{key}</Text>
          <Text style={heatStyles.name}>{labels[key]}</Text>
          <Text style={heatStyles.score}>{Math.round(val * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}
const heatStyles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 10 },
  cell: {
    flex: 1, borderRadius: 12, padding: 12, alignItems: "center",
  },
  letter: { fontSize: 22, fontWeight: "900", color: "#fff" },
  name: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  score: { fontSize: 14, fontWeight: "700", color: "#fff", marginTop: 4 },
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ResultsScreen() {
  const navigation = useNavigation<any>();
  const { analysisResult, currentWoundId, setCurrentWoundId, setIsProgressModalVisible } = useContext(AppContext);
  const { selectedPatient, selectedWound } = usePatientContext();
  const [sharing, setSharing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const savedRef = useRef(false);

  // Auto-save to history on first render with a result
  useEffect(() => {
    if (analysisResult && !savedRef.current) {
      savedRef.current = true;
      saveToHistory(analysisResult).catch(() => {});
    }
  }, [analysisResult]);

  if (!analysisResult) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No analysis result available</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Text style={styles.backLink}>← Take a new photo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const r = analysisResult;
  const conditionColour =
    r.wound_condition?.includes("Critical") ? "#ef4444"
    : r.wound_condition?.includes("Moderate") ? "#eab308"
    : "#22c55e";

  const handleShare = async () => {
    setSharing(true);
    try {
      const summary =
        `WoundSense Report\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Area: ${r.wound_area_cm2} cm²\n` +
        `Condition: ${r.wound_condition}\n` +
        `TIME: T=${r.time_scores.T} I=${r.time_scores.I} M=${r.time_scores.M} E=${r.time_scores.E}\n` +
        `Tissue: ${Object.entries(r.tissue_ratios).map(([k,v]) => `${k}:${v}%`).join(", ")}\n\n` +
        `Recommendations:\n${r.recommendations.map(rec => `• ${rec}`).join("\n")}\n\n` +
        `Generated by WoundSense AI — PHC wound care tool`;
      await Share.share({ message: summary, title: "WoundSense Report" });
    } catch {
      Alert.alert("Share failed");
    } finally {
      setSharing(false);
    }
  };

  const handlePdfReport = async () => {
    setGeneratingPdf(true);
    try {
      const dataUri = await generatePdfReport(r);
      const base64Data = dataUri.split(",")[1];
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileUri = `${FileSystem.cacheDirectory}WoundSense_Report_${timestamp}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Wound Report",
      });
    } catch {
      Alert.alert("PDF Failed", "Could not generate PDF report. Check your connection.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleViewProgress = () => {
    if (!currentWoundId) {
      Alert.alert(
        "Wound Tracking Not Enabled",
        "To view healing progress, you need to track this wound on the backend. For now, this feature works best with the patient/wound management system (coming soon).",
        [{ text: "OK" }]
      );
      return;
    }
    setIsProgressModalVisible(true);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Condition badge */}
      <View style={[styles.conditionBadge, { backgroundColor: conditionColour }]}>
        <Text style={styles.conditionText}>{r.wound_condition}</Text>
      </View>

      {/* Wound metadata card */}
      {selectedPatient && selectedWound && (
        <View style={styles.metadataCard}>
          <View style={styles.metadataRow}>
            <View style={styles.metadataSection}>
              <Text style={styles.metadataLabel}>Patient</Text>
              <Text style={styles.metadataValue}>{selectedPatient.name}</Text>
              <Text style={styles.metadataMeta}>{selectedPatient.phone}</Text>
            </View>
            <View style={styles.metadataDivider} />
            <View style={styles.metadataSection}>
              <Text style={styles.metadataLabel}>Wound</Text>
              <Text style={styles.metadataValue}>{selectedWound.location}</Text>
              <Text style={styles.metadataMeta}>{selectedWound.wound_type}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Wound image */}
      {r.masked_image && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${r.masked_image}` }}
          style={styles.woundImage}
          resizeMode="contain"
        />
      )}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{r.wound_area_cm2}</Text>
          <Text style={styles.metricLabel}>cm² area</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{r.wound_perimeter_cm}</Text>
          <Text style={styles.metricLabel}>cm perimeter</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>±{r.precision_mm}</Text>
          <Text style={styles.metricLabel}>mm precision</Text>
        </View>
      </View>

      {/* Coin detection note */}
      <View style={[styles.infoNote, { borderColor: r.coin_detected ? "#22c55e" : "#eab308" }]}>
        <Ionicons name={r.coin_detected ? "checkmark-circle" : "warning"} size={16}
          color={r.coin_detected ? "#22c55e" : "#eab308"} />
        <Text style={styles.infoNoteText}>
          {r.coin_detected
            ? "Reference coin detected — calibrated measurement"
            : "Coin not detected — estimated scale (place ₹1 coin for accuracy)"}
        </Text>
      </View>

      {/* TIME heatmap */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIME Framework</Text>
        <TimeHeatmap scores={r.time_scores} />
      </View>

      {/* Tissue composition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tissue Composition</Text>
        <TissueBar ratios={r.tissue_ratios} />
      </View>

      {/* Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clinical Recommendations</Text>
        {r.recommendations.map((rec, idx) => (
          <View key={idx} style={styles.recRow}>
            <View style={[styles.recDot, { backgroundColor: rec.includes("⚠️") || rec.includes("🔴") ? "#ef4444" : rec.includes("✅") ? "#22c55e" : "#1a3c5e" }]} />
            <Text style={styles.recText}>{rec}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Inference: {r.inference_ms}ms • Mode: {r.model_mode}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={handlePdfReport}
          disabled={generatingPdf}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>{generatingPdf ? "Generating…" : "PDF Report"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={handleShare}
          disabled={sharing}
        >
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Share Text</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Button */}
      <View style={{ height: 8 }} />
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: "#06b6d4", width: "100%" }]}
        onPress={handleViewProgress}
      >
        <Ionicons name="trending-down-outline" size={20} color="#fff" />
        <Text style={styles.actionButtonText}>View Progress</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />
      <TouchableOpacity
        style={[styles.actionButton, styles.newButton, { width: "100%" }]}
        onPress={() => navigation.navigate("Home")}
      >
        <Ionicons name="camera-outline" size={20} color="#1a3c5e" />
        <Text style={[styles.actionButtonText, { color: "#1a3c5e" }]}>New Photo</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { padding: 16, paddingBottom: 40 },

  conditionBadge: {
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20,
    alignSelf: "center", marginBottom: 16,
  },
  conditionText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  metadataCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  metadataRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  metadataSection: {
    flex: 1,
  },
  metadataLabel: {
    fontSize: 10, fontWeight: "600", color: "#94a3b8", marginBottom: 2,
  },
  metadataValue: {
    fontSize: 13, fontWeight: "700", color: "#1e293b", marginBottom: 2,
  },
  metadataMeta: {
    fontSize: 10, color: "#cbd5e1",
  },
  metadataDivider: {
    width: 1, height: 35, backgroundColor: "#e2e8f0",
  },

  woundImage: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },

  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  metricValue: { fontSize: 22, fontWeight: "800", color: "#1a3c5e" },
  metricLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  infoNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1.5, marginBottom: 12,
  },
  infoNoteText: { fontSize: 12, color: "#475569", flex: 1 },

  section: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a3c5e", marginBottom: 14 },

  recRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  recText: { fontSize: 14, color: "#334155", flex: 1, lineHeight: 20 },

  footer: { alignItems: "center", marginBottom: 16 },
  footerText: { fontSize: 11, color: "#cbd5e1" },

  actionRow: { flexDirection: "row", gap: 12 },
  actionButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 14, paddingVertical: 16,
  },
  shareButton: { backgroundColor: "#1a3c5e" },
  newButton: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#1a3c5e" },
  actionButtonText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8" },
  backLink: { marginTop: 16, color: "#1a3c5e", fontSize: 15, fontWeight: "600" },
});
