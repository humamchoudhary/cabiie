import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { colors } from "@/utils/colors";
import { MaterialIcons, AntDesign, Feather } from "@expo/vector-icons";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(firestore, "users", user?.uid || "");
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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View
          style={{
            backgroundColor: colors.bg_accent,
            padding: 24,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            marginBottom: 20,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: "600",
                  color: colors.background,
                }}
              >
                {profile?.name?.charAt(0).toUpperCase() || "D"}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              {profile?.name || "Driver"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AntDesign name="star" size={16} color="#FCD34D" />
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                  marginLeft: 4,
                }}
              >
                {profile?.rating || "5.0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Details */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* Driver Status Card */}
          <View
            style={{
              backgroundColor: colors.bg_accent,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Driver Information
            </Text>

            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <MaterialIcons
                    name="person"
                    size={16}
                    color={colors.background}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    User Type
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.userType || "Driver"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <MaterialIcons
                    name="verified"
                    size={16}
                    color={colors.background}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Account Status
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.status || "Active"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <AntDesign name="star" size={16} color={colors.background} />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Rating
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.rating || "5.0"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Vehicle Information Card */}
          <View
            style={{
              backgroundColor: colors.bg_accent,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Vehicle Information
            </Text>

            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <MaterialIcons
                    name="directions-car"
                    size={16}
                    color={colors.background}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Vehicle Type
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.vehicleInfo?.type || "N/A"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <MaterialIcons
                    name="badge"
                    size={16}
                    color={colors.background}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    License Plate
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.vehicleInfo?.licensePlate || "N/A"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginRight: 12,
                  }}
                >
                  <Feather name="box" size={16} color={colors.background} />
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Vehicle Model
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {profile?.vehicleInfo?.model || "N/A"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stats Card */}

          {/* Logout Button */}
          <TouchableOpacity
            onPress={signOut}
            style={{
              backgroundColor: "#d9534f",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="logout" size={20} color={colors.background} />
            <Text
              style={{
                color: colors.background,
                fontWeight: "600",
                fontSize: 16,
                marginLeft: 8,
              }}
            >
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
