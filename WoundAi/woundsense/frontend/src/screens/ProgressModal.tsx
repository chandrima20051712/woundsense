/**
 * ProgressModal.tsx — Modal screen showing wound healing progress charts
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AreaTrendChart, TissueProgressChart, TIMEScoreChart } from "../components/ProgressCharts";
import { WoundProgress } from "../types";
import * as woundApi from "../api/woundApi";

interface ProgressModalProps {
  woundId: string;
  isVisible: boolean;
  onClose: () => void;
}

type ChartTab = "area" | "tissue" | "time";

export const ProgressModal: React.FC<ProgressModalProps> = ({
  woundId,
  isVisible,
  onClose,
}) => {
  const [woundProgress, setWoundProgress] = useState<WoundProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ChartTab>("area");

  useEffect(() => {
    if (isVisible && woundId) {
      fetchWoundProgress();
    }
  }, [isVisible, woundId]);

  const fetchWoundProgress = async () => {
    setLoading(true);
    try {
      const data = await woundApi.fetchWoundProgress(woundId);
      setWoundProgress(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load wound progress data");
      console.error("Error fetching wound progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Wound Progress</Text>
            {woundProgress && (
              <Text style={styles.headerSubtitle}>
                {woundProgress.patient_name} • {woundProgress.location}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#1a3c5e" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a3c5e" />
          <Text style={styles.loadingText}>Loading progress data...</Text>
        </View>
      ) : !woundProgress || !woundProgress.analyses || woundProgress.analyses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptyText}>
            Take multiple photos over several days to see healing progress
          </Text>
        </View>
      ) : (
        <>
          {/* Tab Navigation */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "area" && styles.activeTab]}
              onPress={() => setActiveTab("area")}
            >
              <Ionicons
                name="trending-down-outline"
                size={18}
                color={activeTab === "area" ? "#1a3c5e" : "#94a3b8"}
              />
              <Text
                style={[styles.tabLabel, activeTab === "area" && styles.activeTabLabel]}
              >
                Area
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "tissue" && styles.activeTab]}
              onPress={() => setActiveTab("tissue")}
            >
              <Ionicons
                name="pulse-outline"
                size={18}
                color={activeTab === "tissue" ? "#1a3c5e" : "#94a3b8"}
              />
              <Text
                style={[styles.tabLabel, activeTab === "tissue" && styles.activeTabLabel]}
              >
                Tissue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "time" && styles.activeTab]}
              onPress={() => setActiveTab("time")}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={activeTab === "time" ? "#1a3c5e" : "#94a3b8"}
              />
              <Text
                style={[styles.tabLabel, activeTab === "time" && styles.activeTabLabel]}
              >
                TIME
              </Text>
            </TouchableOpacity>
          </View>

          {/* Charts */}
          <ScrollView style={styles.chartsContainer} showsVerticalScrollIndicator={false}>
            {/* Wound Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Wound Type:</Text>
                <Text style={styles.infoValue}>{woundProgress.wound_type}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color:
                        woundProgress.status === "closed"
                          ? "#22c55e"
                          : woundProgress.status === "infected"
                            ? "#dc2626"
                            : "#f59e0b",
                    },
                  ]}
                >
                  {woundProgress.status.charAt(0).toUpperCase() +
                    woundProgress.status.slice(1)}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Days Tracked:</Text>
                <Text style={styles.infoValue}>
                  {woundProgress.statistics?.total_days || "—"}
                </Text>
              </View>
            </View>

            {/* Charts by Tab */}
            {activeTab === "area" && woundProgress.analyses && (
              <AreaTrendChart
                analyses={woundProgress.analyses}
                statistics={woundProgress.statistics}
              />
            )}

            {activeTab === "tissue" && woundProgress.analyses && (
              <TissueProgressChart analyses={woundProgress.analyses} />
            )}

            {activeTab === "time" && woundProgress.analyses && (
              <TIMEScoreChart analyses={woundProgress.analyses} />
            )}

            {/* Footer spacer */}
            <View style={{ height: 20 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  header: {
    backgroundColor: "#fff",
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  closeButton: {
    padding: 8,
    marginLeft: 16,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },

  loadingText: {
    fontSize: 14,
    color: "#64748b",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },

  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  activeTab: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1.5,
    borderColor: "#1a3c5e",
  },

  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },

  activeTabLabel: {
    color: "#1a3c5e",
  },

  chartsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },

  infoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },

  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },

  infoDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 4,
  },
});
