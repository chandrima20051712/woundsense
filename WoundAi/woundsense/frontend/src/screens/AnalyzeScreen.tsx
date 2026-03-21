/**
 * AnalyzeScreen.tsx — Loading screen during wound analysis.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, Animated } from "react-native";

const STEPS = [
  { icon: "🔍", label: "Detecting reference coin…" },
  { icon: "🧠", label: "Segmenting wound boundary…" },
  { icon: "🎨", label: "Classifying tissue types…" },
  { icon: "📐", label: "Calculating wound area…" },
  { icon: "📋", label: "Generating recommendations…" },
];

export default function AnalyzeScreen({ route }: any) {
  const { photoUri } = route.params ?? {};
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < STEPS.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
      }
    }, 380);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {photoUri && (
        <Animated.Image
          source={{ uri: photoUri }}
          style={[styles.thumbnail, { transform: [{ scale: pulseAnim }] }]}
        />
      )}

      <Text style={styles.title}>Analysing Wound</Text>
      <Text style={styles.subtitle}>WoundSense AI • TIME Framework</Text>

      <View style={styles.stepList}>
        {STEPS.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <View key={idx} style={styles.stepRow}>
              <View style={[
                styles.stepDot,
                done && styles.stepDotDone,
                active && styles.stepDotActive,
              ]}>
                <Text style={styles.stepIcon}>{done ? "✓" : step.icon}</Text>
              </View>
              <Text style={[
                styles.stepLabel,
                done && styles.stepLabelDone,
                active && styles.stepLabelActive,
              ]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.hint}>Target: &lt;2s on Moto G32</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#f0f4f8", padding: 32,
  },
  thumbnail: {
    width: 140, height: 140, borderRadius: 16,
    marginBottom: 24, borderWidth: 3, borderColor: "#1a3c5e",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1a3c5e", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#64748b", marginBottom: 32 },
  stepList: { width: "100%", gap: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepDot: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: "#1a3c5e" },
  stepDotDone: { backgroundColor: "#22c55e" },
  stepIcon: { fontSize: 16 },
  stepLabel: { fontSize: 15, color: "#94a3b8", flex: 1 },
  stepLabelActive: { color: "#1a3c5e", fontWeight: "700" },
  stepLabelDone: { color: "#22c55e" },
  hint: { marginTop: 40, fontSize: 11, color: "#cbd5e1" },
});