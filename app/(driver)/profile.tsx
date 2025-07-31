import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { colors } from "@/utils/colors";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(firestore, "drivers", user?.uid || "");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          Alert.alert("Error", "Profile not found.");
        }
      } catch (err) {
        Alert.alert("Error", "Failed to fetch profile.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Text style={{ fontSize: 24, color: colors.primary, fontWeight: "bold", marginBottom: 16 }}>
        Driver Profile
      </Text>

      <Text style={{ color: colors.text, marginBottom: 8 }}>Name:</Text>
      <Text style={{ color: "#fff", marginBottom: 16 }}>{profile?.name || "N/A"}</Text>

      <Text style={{ color: colors.text, marginBottom: 8 }}>User Type:</Text>
      <Text style={{ color: "#fff", marginBottom: 16 }}>{profile?.userType || "N/A"}</Text>

      <Text style={{ color: colors.text, marginBottom: 8 }}>Rating:</Text>
      <Text style={{ color: "#fff", marginBottom: 16 }}>{profile?.rating || "N/A"}</Text>

      <Text style={{ color: colors.text, marginBottom: 8 }}>Status:</Text>
      <Text style={{ color: "#fff", marginBottom: 16 }}>{profile?.status || "N/A"}</Text>

      <Text style={{ color: colors.text, marginBottom: 8 }}>Vehicle Info:</Text>
      <Text style={{ color: "#fff", marginBottom: 4 }}>License Plate: {profile?.vehicleInfo?.licensePlate || "N/A"}</Text>
      <Text style={{ color: "#fff", marginBottom: 4 }}>Model: {profile?.vehicleInfo?.model || "N/A"}</Text>
      <Text style={{ color: "#fff", marginBottom: 16 }}>Type: {profile?.vehicleInfo?.type || "N/A"}</Text>

      <Pressable
        onPress={() => router.push("/edit")}
        style={{
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Edit Profile</Text>
      </Pressable>

<Pressable
  onPress={signOut}
  style={{
    backgroundColor: "#d9534f",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  }}
>
  <Text style={{ color: "#fff", fontWeight: "600" }}>Logout</Text>
</Pressable>

    </ScrollView>
  );
}
