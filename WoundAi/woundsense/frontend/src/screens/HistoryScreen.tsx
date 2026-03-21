/**
 * HistoryScreen.tsx — View past wound analyses with healing trend.
 */

import React, { useState, useCallback, useContext } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getHistory, deleteHistoryEntry, clearHistory } from "../utils/historyStorage";
import { AppContext } from "../context/AppContext";
import type { HistoryEntry } from "../types";

function ConditionBadge({ condition }: { condition: string }) {
  const colour =
    condition.includes("Critical") ? "#ef4444"
    : condition.includes("Moderate") ? "#eab308"
    : "#22c55e";
  return (
    <View style={[badgeStyles.badge, { backgroundColor: colour }]}>
      <Text style={badgeStyles.text}>{condition}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  text: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

function HistoryCard({ entry, onView, onDelete }: {
  entry: HistoryEntry;
  onView: () => void;
  onDelete: () => void;
}) {
  const r = entry.result;
  const date = new Date(entry.date);
  const formatted = date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onView} activeOpacity={0.7}>
      <View style={cardStyles.row}>
        {r.masked_image ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${r.masked_image}` }}
            style={cardStyles.thumb}
          />
        ) : (
          <View style={[cardStyles.thumb, cardStyles.thumbPlaceholder]}>
            <Ionicons name="bandage-outline" size={24} color="#94a3b8" />
          </View>
        )}
        <View style={cardStyles.details}>
          <Text style={cardStyles.date}>{formatted}</Text>
          <ConditionBadge condition={r.wound_condition} />
          <View style={cardStyles.metrics}>
            <Text style={cardStyles.metric}>{r.wound_area_cm2} cm²</Text>
            <Text style={cardStyles.metricSep}>·</Text>
            <Text style={cardStyles.metric}>{r.model_mode}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center",
  },
  details: { flex: 1, gap: 4 },
  date: { fontSize: 12, color: "#64748b" },
  metrics: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metric: { fontSize: 13, fontWeight: "600", color: "#1a3c5e" },
  metricSep: { color: "#cbd5e1" },
});

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { setAnalysisResult } = useContext(AppContext);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setHistory);
    }, [])
  );

  const handleView = (entry: HistoryEntry) => {
    setAnalysisResult(entry.result);
    navigation.navigate("Results");
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteHistoryEntry(id);
          setHistory((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert("Clear all history?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All", style: "destructive",
        onPress: async () => {
          await clearHistory();
          setHistory([]);
        },
      },
    ]);
  };

  if (history.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="time-outline" size={64} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>No analyses yet</Text>
        <Text style={styles.emptySubtext}>
          Take a wound photo to start tracking healing progress
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.count}>{history.length} analysis{history.length !== 1 ? "es" : ""}</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryCard
            entry={item}
            onView={() => handleView(item)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingBottom: 8,
  },
  count: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  clearText: { fontSize: 14, color: "#ef4444", fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },

  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, backgroundColor: "#f0f4f8",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#334155", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 8 },
  primaryButton: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1a3c5e", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 24,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
