/**
 * WoundSense Mobile App
 * React Native + Expo — wound analysis for Tamil Nadu PHC nurses
 *
 * Navigation Structure:
 * - Bottom Tabs: Capture | Patients | History
 * - Capture Tab: Home → Analyze → Results
 * - Patients Tab: Patients → Wounds → WoundProgress
 */

import React, { useState } from "react";
import { TouchableOpacity, Modal } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Screens
import HomeScreen from "./src/screens/HomeScreen";
import AnalyzeScreen from "./src/screens/AnalyzeScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import { PatientsScreen } from "./src/screens/PatientsScreen";
import { WoundsScreen } from "./src/screens/WoundsScreen";
import { WoundProgressScreen } from "./src/screens/WoundProgressScreen";
import { ProgressModal } from "./src/screens/ProgressModal";

// Context
import { AppContext } from "./src/context/AppContext";
import { PatientProvider } from "./src/context/PatientContext";
import type { AnalysisResult } from "./src/types";

const CaptureStack = createNativeStackNavigator();
const PatientsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─────────────────────────────────────────────────────────────
// CAPTURE TAB NAVIGATOR (Camera → Analysis → Results)
// ─────────────────────────────────────────────────────────────
function CaptureTabNavigator() {
  return (
    <CaptureStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#1a3c5e" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f0f4f8" },
      }}
    >
      <CaptureStack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: "WoundSense",
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate("History")} style={{ marginRight: 8 }}>
              <Ionicons name="time-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <CaptureStack.Screen
        name="Analyze"
        component={AnalyzeScreen}
        options={{ title: "Analysing…", gestureEnabled: false }}
      />
      <CaptureStack.Screen
        name="Results"
        component={ResultsScreen}
        options={{ title: "Wound Analysis Report" }}
      />
      <CaptureStack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: "History" }}
      />
    </CaptureStack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
// PATIENTS TAB NAVIGATOR (Patients → Wounds → Details)
// ─────────────────────────────────────────────────────────────
function PatientsTabNavigator() {
  return (
    <PatientsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#1a3c5e" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f0f4f8" },
      }}
    >
      <PatientsStack.Screen
        name="PatientsList"
        component={PatientsScreen}
        options={{ title: "Patients" }}
      />
      <PatientsStack.Screen
        name="WoundsList"
        component={WoundsScreen}
        options={({ route }: any) => ({
          title: `${route.params?.patientName || "Wounds"}`,
        })}
      />
      <PatientsStack.Screen
        name="WoundDetail"
        component={WoundProgressScreen}
        options={({ route }: any) => ({
          title: `${route.params?.woundLocation || "Wound Progress"}`,
        })}
      />
    </PatientsStack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP WITH BOTTOM TABS
// ─────────────────────────────────────────────────────────────
function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "CaptureTab") {
            iconName = focused ? "camera" : "camera-outline";
          } else if (route.name === "PatientsTab") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "HistoryTab") {
            iconName = focused ? "time" : "time-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#1a3c5e",
        tabBarInactiveTintColor: "#cbd5e1",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e2e8f0",
          paddingBottom: 4,
        },
      })}
    >
      <Tab.Screen
        name="CaptureTab"
        component={CaptureTabNavigator}
        options={{
          title: "Capture",
        }}
      />
      <Tab.Screen
        name="PatientsTab"
        component={PatientsTabNavigator}
        options={{
          title: "Patients",
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          title: "History",
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP WRAPPER
// ─────────────────────────────────────────────────────────────
function AppContent() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [currentWoundId, setCurrentWoundId] = useState<string | null>(null);
  const [isProgressModalVisible, setIsProgressModalVisible] = useState(false);

  return (
    <AppContext.Provider
      value={{
        analysisResult,
        setAnalysisResult,
        isOfflineMode,
        setIsOfflineMode,
        currentWoundId,
        setCurrentWoundId,
        isProgressModalVisible,
        setIsProgressModalVisible,
      }}
    >
      <StatusBar style="light" />
      <NavigationContainer>
        <AppTabs />
      </NavigationContainer>

      {/* Progress Modal Overlay */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isProgressModalVisible}
        onRequestClose={() => setIsProgressModalVisible(false)}
      >
        {currentWoundId && (
          <ProgressModal
            woundId={currentWoundId}
            isVisible={isProgressModalVisible}
            onClose={() => setIsProgressModalVisible(false)}
          />
        )}
      </Modal>
    </AppContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP EXPORT
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <PatientProvider>
        <AppContent />
      </PatientProvider>
    </SafeAreaProvider>
  );
}

