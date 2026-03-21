/**
 * HomeScreen.tsx — Camera capture screen with wound selection
 * Features:
 * - Display selected patient + wound
 * - Allow quick navigation to patient/wound selection
 * - Block capture if patient/wound not selected
 * - Auto-track analysis to wound when captured
 */

import React, { useState, useRef, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppContext } from "../context/AppContext";
import { usePatientContext } from "../context/PatientContext";
import { analyzeWoundTracked, analyzeWoundOffline } from "../api/woundApi";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { setAnalysisResult, isOfflineMode, setIsOfflineMode, setCurrentWoundId } = useContext(AppContext);
  const { selectedPatient, selectedWound } = usePatientContext();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("auto");
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <ActivityIndicator style={{ flex: 1 }} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#1a3c5e" />
        <Text style={styles.permissionText}>Camera access needed for wound analysis</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    // GUARD: Require patient & wound selection
    if (!selectedPatient || !selectedWound) {
      Alert.alert(
        "Select Patient & Wound",
        "Please select a patient and wound before capturing photos.",
        [
          { text: "Go to Patients", onPress: () => navigation.navigate("PatientsTab") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: false,
        exif: false,
      });
      if (photo) await submitForAnalysis(photo.uri);
    } catch (err) {
      Alert.alert("Capture failed", "Please try again");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryPick = async () => {
    if (!selectedPatient || !selectedWound) {
      Alert.alert(
        "Select Patient & Wound",
        "Please select a patient and wound before uploading photos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.92,
    });
    if (!result.canceled && result.assets[0]) {
      await submitForAnalysis(result.assets[0].uri);
    }
  };

  const submitForAnalysis = async (photoUri: string, forceOffline = false) => {
    navigation.navigate("Analyze", { photoUri });
    try {
      let result;

      // Use offline demo if offline mode enabled or forced
      if (isOfflineMode || forceOffline) {
        result = await analyzeWoundOffline();
      } else {
        // Track analysis to selected wound (online mode)
        result = await analyzeWoundTracked(
          photoUri,
          selectedWound!.id  // selectedWound is guaranteed non-null here due to guard above
        );
      }

      // Auto-set currentWoundId to enable "View Progress" button
      setCurrentWoundId(selectedWound!.id);

      setAnalysisResult(result as any);

      // Use navigation with proper error handling
      setTimeout(() => {
        navigation.navigate("Results", {});
      }, 500);
    } catch (err: any) {
      setTimeout(() => {
        navigation.navigate("Home");
      }, 300);
      Alert.alert(
        "Analysis Failed",
        err.message || "Could not reach server or save analysis.",
        [
          { text: "OK", style: "cancel" },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera — no children inside CameraView */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
      />

      {/* All overlays outside CameraView using absolute positioning */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Patient/Wound Selection Card */}
        <View style={styles.selectionCard}>
          {selectedPatient && selectedWound ? (
            <>
              <View style={styles.selectionContent}>
                <View style={styles.selectionInfo}>
                  <Text style={styles.selectionLabel}>Patient</Text>
                  <Text style={styles.selectionValue}>{selectedPatient.name}</Text>
                  <Text style={styles.selectionMeta}>{selectedPatient.phone}</Text>
                </View>
                <View style={styles.selectionDivider} />
                <View style={styles.selectionInfo}>
                  <Text style={styles.selectionLabel}>Wound</Text>
                  <Text style={styles.selectionValue}>{selectedWound.location}</Text>
                  <Text style={styles.selectionMeta}>{selectedWound.wound_type}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => navigation.navigate("PatientsTab")}
              >
                <Ionicons name="swap-horizontal" size={18} color="#1a3c5e" />
                <Text style={styles.switchText}>Switch</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.selectPrompt}
              onPress={() => navigation.navigate("PatientsTab")}
            >
              <Ionicons name="alert-circle-outline" size={24} color="#f59e0b" />
              <Text style={styles.selectPromptTitle}>Select Patient & Wound</Text>
              <Text style={styles.selectPromptText}>Tap to choose patient and wound to track</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Coin guide */}
        {selectedPatient && selectedWound && (
          <View style={styles.guideOverlay}>
            <View style={styles.coinGuideCircle}>
              <Text style={styles.coinGuideText}>₹1</Text>
            </View>
            <Text style={styles.guideCaption}>Place ₹1 coin beside wound</Text>
          </View>
        )}

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              setFlashMode(f => f === "off" ? "on" : f === "on" ? "auto" : "off")
            }
          >
            <Ionicons
              name={flashMode === "off" ? "flash-off" : flashMode === "on" ? "flash" : "flash-outline"}
              size={28} color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setCameraType(t => t === "back" ? "front" : "back")}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGalleryPick}>
            <Ionicons name="images-outline" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled, !selectedPatient || !selectedWound ? styles.captureButtonDisabled : {}]}
            onPress={handleCapture}
            disabled={isCapturing || !selectedPatient || !selectedWound}
          >
            {isCapturing
              ? <ActivityIndicator color="#1a3c5e" size="large" />
              : <View style={styles.captureInner} />
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, isOfflineMode && styles.iconButtonActive]}
            onPress={() => setIsOfflineMode(!isOfflineMode)}
          >
            <Ionicons
              name={isOfflineMode ? "cloud-offline" : "cloud-outline"}
              size={28} color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Ionicons name="information-circle-outline" size={16} color="#64748b" />
        <Text style={styles.infoText}>
          {isOfflineMode
            ? "🔴 Offline mode — on-device analysis"
            : "🟢 Connected — cloud analysis (~2s)"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  // Full-screen overlay container
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 50,
  },

  permissionContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, backgroundColor: "#f0f4f8",
  },
  permissionText: {
    fontSize: 16, color: "#334155", textAlign: "center", marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: "#1a3c5e", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Patient/Wound Selection Card
  selectionCard: {
    position: "absolute", top: 16, left: 16, right: 16,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  selectPrompt: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8,
  },

  selectPromptTitle: {
    fontSize: 14, fontWeight: "700", color: "#1e293b", flex: 1,
  },

  selectPromptText: {
    fontSize: 12, color: "#64748b", flex: 1,
  },

  selectionContent: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },

  selectionInfo: {
    flex: 1,
  },

  selectionLabel: {
    fontSize: 11, fontWeight: "600", color: "#94a3b8", marginBottom: 2,
  },

  selectionValue: {
    fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 2,
  },

  selectionMeta: {
    fontSize: 11, color: "#cbd5e1",
  },

  selectionDivider: {
    width: 1, height: 40, backgroundColor: "#e2e8f0",
  },

  switchButton: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
    backgroundColor: "#f1f5f9", padding: 8, borderRadius: 6, alignSelf: "flex-start",
  },

  switchText: {
    fontSize: 12, fontWeight: "600", color: "#1a3c5e",
  },

  guideOverlay: {
    position: "absolute", top: "40%", right: 24, alignItems: "center",
  },
  coinGuideCircle: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2.5, borderColor: "#22d3ee", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(34,211,238,0.12)",
  },
  coinGuideText: { color: "#22d3ee", fontWeight: "700", fontSize: 13 },
  guideCaption: {
    color: "#22d3ee", fontSize: 11, marginTop: 4,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  topControls: {
    position: "absolute", top: 90, right: 16,
    flexDirection: "row", gap: 12,
  },
  bottomControls: {
    position: "absolute", bottom: 32, width: "100%",
    flexDirection: "row", justifyContent: "space-around",
    alignItems: "center", paddingHorizontal: 24,
  },
  iconButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  iconButtonActive: { backgroundColor: "rgba(220,38,38,0.6)" },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#fff",
    borderWidth: 5, borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center", justifyContent: "center",
    elevation: 8,
  },
  captureButtonDisabled: { opacity: 0.5 },
  captureInner: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff",
  },

  infoBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc", padding: 10, gap: 6,
  },
  infoText: { fontSize: 13, color: "#64748b" },
});