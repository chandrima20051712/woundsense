import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Wound } from "../types";
import * as woundApi from "../api/woundApi";
import { usePatientContext } from "../context/PatientContext";

type RootStackParamList = {
  WoundsList: { patientId: string };
  WoundDetail: { woundId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "WoundsList">;

export function WoundsScreen({ navigation, route }: Props) {
  const { patientId } = route.params;
  const { selectedPatient, setSelectedWound } = usePatientContext();
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    wound_type: "diabetic",
    location: "",
  });

  useEffect(() => {
    loadWounds();
  }, [patientId]);

  const loadWounds = async () => {
    try {
      setLoading(true);
      const data = await woundApi.getPatientWounds(patientId);
      setWounds(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load wounds");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWound = async () => {
    if (!formData.location.trim()) {
      Alert.alert("Error", "Location is required");
      return;
    }

    try {
      const newWound = await woundApi.createWound({
        patient_id: patientId,
        wound_type: formData.wound_type,
        location: formData.location.trim(),
      });

      setWounds([newWound, ...wounds]);
      setFormData({ wound_type: "diabetic", location: "" });
      setModalVisible(false);
      Alert.alert("Success", "Wound created successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create wound");
    }
  };

  const handleWoundPress = (wound: Wound) => {
    setSelectedWound(wound);
    navigation.navigate("WoundDetail", { woundId: wound.id });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "closed":
        return "#4CAF50"; // Green
      case "infected":
        return "#f44336"; // Red
      default:
        return "#ff9800"; // Orange (open)
    }
  };

  const renderWoundCard = ({ item }: { item: Wound }) => (
    <TouchableOpacity
      style={styles.woundCard}
      onPress={() => handleWoundPress(item)}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.woundType}>{item.wound_type}</Text>
          <Text style={styles.woundLocation}>{item.location}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.analysesCount}>
        {item.analyses_count || 0} analyses recorded
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.patientName}>{selectedPatient?.name}</Text>
          <Text style={styles.patientPhone}>{selectedPatient?.phone}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : wounds.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="bandage-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No wounds recorded</Text>
          <Text style={styles.emptySubtext}>Tap + to add a wound</Text>
        </View>
      ) : (
        <FlatList
          data={wounds}
          renderItem={renderWoundCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Wound</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Wound Type</Text>
              <View style={styles.typeOptions}>
                {["diabetic", "pressure", "surgical", "burn"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      formData.wound_type === type && styles.typeOptionSelected,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, wound_type: type })
                    }
                  >
                    <Text
                      style={[
                        styles.typeText,
                        formData.wound_type === type && styles.typeTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., left foot, right heel"
              value={formData.location}
              onChangeText={(text) =>
                setFormData({ ...formData, location: text })
              }
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateWound}
            >
              <Text style={styles.createButtonText}>Create Wound</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  patientName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  patientPhone: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  woundCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  woundType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    textTransform: "capitalize",
  },
  woundLocation: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    textTransform: "capitalize",
  },
  analysesCount: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  typeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 0.45,
  },
  typeOptionSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  typeText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
    textTransform: "capitalize",
  },
  typeTextSelected: {
    color: "white",
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: "#000",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
