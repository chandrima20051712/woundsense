import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DailyAnalysis, WoundProgress } from "../types";
import * as woundApi from "../api/woundApi";

type RootStackParamList = {
  WoundProgress: { woundId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "WoundProgress">;

export function WoundProgressScreen({ navigation, route }: Props) {
  const { woundId } = route.params;
  const [progress, setProgress] = useState<WoundProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DailyAnalysis | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    loadWoundProgress();
  }, [woundId]);

  const loadWoundProgress = async () => {
    try {
      setLoading(true);
      const data = await woundApi.getWoundProgress(woundId);
      setProgress(data);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load wound progress");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return "arrow-down";
      case "worsening":
        return "arrow-up";
      default:
        return "remove";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "#4CAF50";
      case "worsening":
        return "#f44336";
      default:
        return "#ff9800";
    }
  };

  const getConditionColor = (condition: string) => {
    if (condition.includes("Critical")) return "#f44336";
    if (condition.includes("Moderate")) return "#ff9800";
    return "#4CAF50";
  };

  const renderDailyCard = ({ item }: { item: DailyAnalysis }) => (
    <TouchableOpacity
      style={styles.dailyCard}
      onPress={() => {
        setSelectedAnalysis(item);
        setDetailsVisible(true);
      }}
    >
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{item.date}</Text>
        <View
          style={[
            styles.conditionBadge,
            { backgroundColor: getConditionColor(item.wound_condition) },
          ]}
        >
          <Text style={styles.conditionText}>{item.wound_condition}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Area</Text>
          <Text style={styles.metricValue}>
            {item.wound_area_cm2.toFixed(1)} cm²
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Perimeter</Text>
          <Text style={styles.metricValue}>
            {item.wound_perimeter_cm?.toFixed(1) || "N/A"} cm
          </Text>
        </View>
      </View>

      <View style={styles.tissueBar}>
        <Text style={styles.tissueLabel}>Tissue composition:</Text>
        <View style={styles.tissueBarContainer}>
          <View
            style={[
              styles.tissuePart,
              {
                width: `${item.tissue_ratios.granulation}%`,
                backgroundColor: "#FF6B6B",
              },
            ]}
          />
          <View
            style={[
              styles.tissuePart,
              {
                width: `${item.tissue_ratios.slough}%`,
                backgroundColor: "#FFD93D",
              },
            ]}
          />
          <View
            style={[
              styles.tissuePart,
              {
                width: `${item.tissue_ratios.necrotic}%`,
                backgroundColor: "#3D3D3D",
              },
            ]}
          />
          <View
            style={[
              styles.tissuePart,
              {
                width: `${item.tissue_ratios.epithelial}%`,
                backgroundColor: "#95E1D3",
              },
            ]}
          />
        </View>
        <View style={styles.tissueLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FF6B6B" }]} />
            <Text style={styles.legendText}>
              Granulation {item.tissue_ratios.granulation}%
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FFD93D" }]} />
            <Text style={styles.legendText}>
              Slough {item.tissue_ratios.slough}%
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!progress) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load wound progress</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.patientName}>{progress.patient_name}</Text>
          <Text style={styles.woundInfo}>
            {progress.wound_type} • {progress.location}
          </Text>
        </View>

        {progress.statistics && (
          <View style={styles.statisticsCard}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Days monitoring</Text>
                <Text style={styles.statValue}>
                  {progress.statistics.total_days}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Photos taken</Text>
                <Text style={styles.statValue}>
                  {progress.statistics.photos_count}
                </Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Initial area</Text>
                <Text style={styles.statValue}>
                  {progress.statistics.initial_area_cm2.toFixed(1)} cm²
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Latest area</Text>
                <Text style={styles.statValue}>
                  {progress.statistics.final_area_cm2.toFixed(1)} cm²
                </Text>
              </View>
            </View>

            <View style={styles.trendCard}>
              <Ionicons
                name={getTrendIcon(progress.statistics.area_trend)}
                size={32}
                color={getTrendColor(progress.statistics.area_trend)}
              />
              <View style={styles.trendText}>
                <Text style={styles.trendLabel}>Wound status</Text>
                <Text style={styles.trendValue}>
                  {progress.statistics.area_trend.charAt(0).toUpperCase() +
                    progress.statistics.area_trend.slice(1)}
                </Text>
                <Text style={styles.trendSubtext}>
                  Area change: {progress.statistics.area_change_percent.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Progress ({progress.analyses.length})</Text>
          <FlatList
            data={progress.analyses}
            renderItem={renderDailyCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            nestedScrollEnabled={false}
          />
        </View>

        {progress.analyses.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No daily analyses yet</Text>
            <Text style={styles.emptySubtext}>
              Take a photo to start tracking
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      {selectedAnalysis && detailsVisible && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setDetailsVisible(false)}
          />
          <View style={styles.detailsModal}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Analysis Details</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailsContent}>
              <Text style={styles.detailDate}>{selectedAnalysis.date}</Text>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Wound Metrics</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Area:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAnalysis.wound_area_cm2.toFixed(2)} cm²
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Perimeter:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAnalysis.wound_perimeter_cm?.toFixed(2) || "N/A"} cm
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Precision:</Text>
                  <Text style={styles.detailValue}>
                    ±{selectedAnalysis.precision_mm.toFixed(1)} mm
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>TIME Scores</Text>
                {Object.entries(selectedAnalysis.time_scores).map(([key, value]) => (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{key}:</Text>
                    <Text style={styles.detailValue}>
                      {(value * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Recommendations</Text>
                {selectedAnalysis.recommendations.map((rec, idx) => (
                  <Text key={idx} style={styles.recommendationText}>
                    • {rec}
                  </Text>
                ))}
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#999",
  },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  patientName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  woundInfo: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textTransform: "capitalize",
  },
  statisticsCard: {
    backgroundColor: "white",
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 8,
    padding: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  trendCard: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  trendText: {
    marginLeft: 12,
    flex: 1,
  },
  trendLabel: {
    fontSize: 12,
    color: "#666",
  },
  trendValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginTop: 2,
  },
  trendSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  dailyCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  conditionText: {
    fontSize: 12,
    color: "white",
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  metric: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000",
  },
  tissueBar: {
    marginTop: 8,
  },
  tissueLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6,
  },
  tissueBarContainer: {
    flexDirection: "row",
    height: 24,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  tissuePart: {
    height: "100%",
  },
  tissueLegend: {
    gap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  detailsModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  detailsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailDate: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 13,
    color: "#666",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },
  recommendationText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
    marginBottom: 6,
  },
  closeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
