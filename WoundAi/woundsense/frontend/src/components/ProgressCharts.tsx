/**
 * ProgressCharts.tsx — Visualization components for wound healing progress
 * Includes: Area trend, tissue composition, and TIME scores charts
 */

import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart, BarChart, StackedAreaChart } from "react-native-chart-kit";
import { DailyAnalysis, ProgressStatistics } from "../types";

const chartWidth = Dimensions.get("window").width - 32;
const chartHeight = 280;

// ==================== AREA TREND CHART ====================

export interface AreaTrendChartProps {
  analyses: DailyAnalysis[];
  statistics: ProgressStatistics | undefined;
}

export const AreaTrendChart: React.FC<AreaTrendChartProps> = ({
  analyses,
  statistics,
}) => {
  if (!analyses || analyses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No historical data available</Text>
      </View>
    );
  }

  // Reverse to show oldest first (chronological order)
  const sortedAnalyses = [...analyses].reverse();
  const labels = sortedAnalyses.map((a) => {
    const date = new Date(a.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  const data = sortedAnalyses.map((a) => a.wound_area_cm2);

  // Determine color based on trend
  const trendColor =
    statistics?.area_trend === "improving"
      ? "#22c55e"
      : statistics?.area_trend === "worsening"
        ? "#dc2626"
        : "#f97316";

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Wound Area Progress</Text>

      <LineChart
        data={{
          labels: labels.slice(Math.max(0, labels.length - 7)), // Last 7 days
          datasets: [
            {
              data: data.slice(Math.max(0, data.length - 7)),
              color: () => trendColor,
              strokeWidth: 2.5,
            },
          ],
        }}
        width={chartWidth}
        height={chartHeight}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: () => "#94a3b8",
          labelColor: () => "#64748b",
          style: { borderRadius: 8 },
          propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: trendColor,
          },
          propsForBackgroundLines: {
            strokeDasharray: "4",
            stroke: "#e2e8f0",
          },
        }}
        bezier
        style={{ borderRadius: 8, marginVertical: 8 }}
      />

      {/* Stats Summary */}
      <View style={styles.statsSummary}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Initial</Text>
          <Text style={styles.statValue}>
            {statistics?.initial_area_cm2.toFixed(1)}
          </Text>
          <Text style={styles.statUnit}>cm²</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>
            {statistics?.final_area_cm2.toFixed(1)}
          </Text>
          <Text style={styles.statUnit}>cm²</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Change</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  statistics && statistics.area_change_cm2 < 0
                    ? "#22c55e"
                    : "#dc2626",
              },
            ]}
          >
            {statistics?.area_change_cm2.toFixed(1)}
          </Text>
          <Text style={styles.statUnit}>cm² ({statistics?.area_change_percent.toFixed(0)}%)</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Trend</Text>
          <Text style={[styles.statValue, { color: trendColor, textTransform: "capitalize" }]}>
            {statistics?.area_trend}
          </Text>
          <Text style={styles.statUnit}>{statistics?.photos_count} photos</Text>
        </View>
      </View>
    </View>
  );
};

// ==================== TISSUE COMPOSITION CHART ====================

export interface TissueProgressChartProps {
  analyses: DailyAnalysis[];
}

export const TissueProgressChart: React.FC<TissueProgressChartProps> = ({
  analyses,
}) => {
  if (!analyses || analyses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tissue data available</Text>
      </View>
    );
  }

  const sortedAnalyses = [...analyses].reverse();
  const labels = sortedAnalyses.map((a) => {
    const date = new Date(a.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  // Extract tissue ratios
  const granulation = sortedAnalyses.map((a) => a.tissue_ratios.granulation);
  const slough = sortedAnalyses.map((a) => a.tissue_ratios.slough);
  const necrotic = sortedAnalyses.map((a) => a.tissue_ratios.necrotic);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Tissue Composition Progress</Text>

      <StackedAreaChart
        data={{
          labels: labels.slice(Math.max(0, labels.length - 7)),
          datasets: [
            {
              data: granulation.slice(Math.max(0, granulation.length - 7)),
              color: () => "rgba(34, 197, 94, 0.8)", // Green - healthy
            },
            {
              data: slough.slice(Math.max(0, slough.length - 7)),
              color: () => "rgba(234, 179, 8, 0.8)", // Yellow - slough
            },
            {
              data: necrotic.slice(Math.max(0, necrotic.length - 7)),
              color: () => "rgba(220, 38, 38, 0.8)", // Red - necrotic
            },
          ],
        }}
        width={chartWidth}
        height={chartHeight}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: () => "#94a3b8",
          labelColor: () => "#64748b",
          style: { borderRadius: 8 },
          propsForBackgroundLines: {
            strokeDasharray: "4",
            stroke: "#e2e8f0",
          },
        }}
        style={{ borderRadius: 8, marginVertical: 8 }}
      />

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#22c55e" }]} />
          <Text style={styles.legendLabel}>Granulation (healthy)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#eab308" }]} />
          <Text style={styles.legendLabel}>Slough (fibrin)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#dc2626" }]} />
          <Text style={styles.legendLabel}>Necrotic (damaged)</Text>
        </View>
      </View>
    </View>
  );
};

// ==================== TIME SCORES CHART ====================

export interface TIMEScoreChartProps {
  analyses: DailyAnalysis[];
}

export const TIMEScoreChart: React.FC<TIMEScoreChartProps> = ({ analyses }) => {
  if (!analyses || analyses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No TIME score data available</Text>
      </View>
    );
  }

  const sortedAnalyses = [...analyses].reverse();
  const labels = sortedAnalyses.map((a) => {
    const date = new Date(a.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  // Extract TIME scores
  const tScores = sortedAnalyses.map((a) => Math.round(a.time_scores.T * 100));
  const iScores = sortedAnalyses.map((a) => Math.round(a.time_scores.I * 100));
  const mScores = sortedAnalyses.map((a) => Math.round(a.time_scores.M * 100));
  const eScores = sortedAnalyses.map((a) => Math.round(a.time_scores.E * 100));

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>TIME Framework Scores</Text>

      <LineChart
        data={{
          labels: labels.slice(Math.max(0, labels.length - 7)),
          datasets: [
            {
              data: tScores.slice(Math.max(0, tScores.length - 7)),
              color: () => "#ef4444",
              strokeWidth: 2,
            },
            {
              data: iScores.slice(Math.max(0, iScores.length - 7)),
              color: () => "#f97316",
              strokeWidth: 2,
            },
            {
              data: mScores.slice(Math.max(0, mScores.length - 7)),
              color: () => "#eab308",
              strokeWidth: 2,
            },
            {
              data: eScores.slice(Math.max(0, eScores.length - 7)),
              color: () => "#8b5cf6",
              strokeWidth: 2,
            },
          ],
        }}
        width={chartWidth}
        height={chartHeight}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: () => "#94a3b8",
          labelColor: () => "#64748b",
          style: { borderRadius: 8 },
          propsForBackgroundLines: {
            strokeDasharray: "4",
            stroke: "#e2e8f0",
          },
          yAxisLabel: "",
          yAxisSuffix: "%",
          yAxisInterval: 1,
        }}
        segment={4}
        bezier
        style={{ borderRadius: 8, marginVertical: 8 }}
      />

      {/* TIME Framework Legend */}
      <View style={styles.timeFrameworkBox}>
        <Text style={styles.timeFrameworkTitle}>TIME Framework (0=low risk, 100=critical)</Text>
        <View style={styles.timeGridTable}>
          {/* Row 1 */}
          <View style={styles.timeRow}>
            <View style={styles.timeCell}>
              <View style={[styles.timeIndicator, { backgroundColor: "#ef4444" }]} />
              <View>
                <Text style={styles.timeLetter}>T</Text>
                <Text style={styles.timeLabel}>Tissue</Text>
              </View>
            </View>
            <View style={styles.timeCell}>
              <View style={[styles.timeIndicator, { backgroundColor: "#f97316" }]} />
              <View>
                <Text style={styles.timeLetter}>I</Text>
                <Text style={styles.timeLabel}>Infection</Text>
              </View>
            </View>
          </View>
          {/* Row 2 */}
          <View style={styles.timeRow}>
            <View style={styles.timeCell}>
              <View style={[styles.timeIndicator, { backgroundColor: "#eab308" }]} />
              <View>
                <Text style={styles.timeLetter}>M</Text>
                <Text style={styles.timeLabel}>Moisture</Text>
              </View>
            </View>
            <View style={styles.timeCell}>
              <View style={[styles.timeIndicator, { backgroundColor: "#8b5cf6" }]} />
              <View>
                <Text style={styles.timeLetter}>E</Text>
                <Text style={styles.timeLabel}>Edge</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  emptyContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },

  emptyText: { color: "#94a3b8", fontSize: 14 },

  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },

  statsSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  statBox: {
    alignItems: "center",
  },

  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 4,
  },

  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },

  statUnit: {
    fontSize: 10,
    color: "#cbd5e1",
    marginTop: 2,
  },

  legend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },

  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },

  legendLabel: {
    fontSize: 12,
    color: "#475569",
  },

  timeFrameworkBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },

  timeFrameworkTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 10,
  },

  timeGridTable: {
    gap: 8,
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  timeCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  timeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },

  timeLetter: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },

  timeLabel: {
    fontSize: 10,
    color: "#64748b",
  },
});
