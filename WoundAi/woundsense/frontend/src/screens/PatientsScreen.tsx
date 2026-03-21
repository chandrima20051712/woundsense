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
import type { Patient } from "../types";
import * as woundApi from "../api/woundApi";
import { usePatientContext } from "../context/PatientContext";

type RootStackParamList = {
  Patients: undefined;
  Wounds: { patientId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "Patients">;

export function PatientsScreen({ navigation }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    gender: "M",
    age: "",
  });
  const { setSelectedPatient } = usePatientContext();

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await woundApi.getPatients(0, 100);
      setPatients(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load patients");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert("Error", "Name and phone are required");
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      Alert.alert("Error", "Phone must be 10 digits");
      return;
    }

    try {
      const newPatient = await woundApi.createPatient({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        age: formData.age ? parseFloat(formData.age) : undefined,
      });

      setPatients([newPatient, ...patients]);
      setFormData({ name: "", phone: "", gender: "M", age: "" });
      setModalVisible(false);
      Alert.alert("Success", "Patient created successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create patient");
    }
  };

  const handlePatientPress = (patient: Patient) => {
    console.log("🔍 Patient clicked:", patient);
    console.log("🔍 Patient ID:", patient.id);
    setSelectedPatient(patient);
    console.log("🔍 About to navigate to WoundsList...");
    try {
      navigation.navigate("WoundsList", { patientId: patient.id });
      console.log("✅ Navigation successful");
    } catch (err) {
      console.error("❌ Navigation error:", err);
    }
  };

  const renderPatientCard = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => handlePatientPress(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.patientName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </View>
      <Text style={styles.patientPhone}>{item.phone}</Text>
      {item.age && <Text style={styles.patientAge}>{item.age} years</Text>}
      <Text style={styles.woundsCount}>{item.wounds_count || 0} wounds</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
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
      ) : patients.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No patients yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add a patient</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          renderItem={renderPatientCard}
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
              <Text style={styles.modalTitle}>Add Patient</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={formData.name}
              onChangeText={(text) =>
                setFormData({ ...formData, name: text })
              }
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.input}
              placeholder="Phone (10 digits)"
              value={formData.phone}
              onChangeText={(text) =>
                setFormData({ ...formData, phone: text })
              }
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.input}
              placeholder="Age (optional)"
              value={formData.age}
              onChangeText={(text) =>
                setFormData({ ...formData, age: text })
              }
              keyboardType="decimal-pad"
              placeholderTextColor="#999"
            />

            <View style={styles.genderContainer}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderOptions}>
                {["M", "F", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderOption,
                      formData.gender === g && styles.genderOptionSelected,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, gender: g })
                    }
                  >
                    <Text
                      style={[
                        styles.genderText,
                        formData.gender === g && styles.genderTextSelected,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreatePatient}
            >
              <Text style={styles.createButtonText}>Create Patient</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
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
  patientCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  patientPhone: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  patientAge: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  woundsCount: {
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
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
    color: "#000",
  },
  genderContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  genderOptions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  genderOption: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  genderOptionSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  genderText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  genderTextSelected: {
    color: "white",
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
