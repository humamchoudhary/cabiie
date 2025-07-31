import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { colors } from "@/utils/colors";

export default function EditProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(firestore, "drivers", user?.uid || "");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setLicensePlate(data.vehicleInfo?.licensePlate || "");
          setVehicleModel(data.vehicleInfo?.model || "");
          setVehicleType(data.vehicleInfo?.type || "");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to fetch driver data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSave = async () => {
    try {
      const docRef = doc(firestore, "drivers", user?.uid || "");
      await updateDoc(docRef, {
        name,
        vehicleInfo: {
          licensePlate,
          model: vehicleModel,
          type: vehicleType,
        },
      });
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.primary, marginBottom: 24 }}>
        Edit Profile
      </Text>

      {/* Name */}
      <Text style={{ color: colors.text, marginBottom: 8 }}>Full Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
        }}
      />

      {/* License Plate */}
      <Text style={{ color: colors.text, marginBottom: 8 }}>License Plate</Text>
      <TextInput
        value={licensePlate}
        onChangeText={setLicensePlate}
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
        }}
      />

      {/* Vehicle Model */}
      <Text style={{ color: colors.text, marginBottom: 8 }}>Vehicle Model</Text>
      <TextInput
        value={vehicleModel}
        onChangeText={setVehicleModel}
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
        }}
      />

      {/* Vehicle Type */}
      <Text style={{ color: colors.text, marginBottom: 8 }}>Vehicle Type</Text>
      <TextInput
        value={vehicleType}
        onChangeText={setVehicleType}
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          padding: 12,
          borderRadius: 6,
          marginBottom: 32,
        }}
      />

      {/* Save Button */}
      <Pressable
        onPress={handleSave}
        style={{
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}
