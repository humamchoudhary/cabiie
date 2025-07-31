import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "@/utils/colors";
import { auth } from "@/config/firebase";

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        {user?.photoURL ? (
          <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="person" size={48} color={colors.text} />
          </View>
        )}
        <Text style={styles.name}>{user?.displayName || "User"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <MaterialIcons name="phone" size={24} color="#4a5568" />
          <Text style={styles.infoText}>
            {user?.phoneNumber || "Not provided"}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons name="account-circle" size={24} color="#4a5568" />
          <Text style={styles.infoText}>Passenger Account</Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons name="history" size={24} color="#4a5568" />
          <Text style={styles.infoText}>Ride History</Text>
        </View>
      </View>

      <Pressable onPress={signOut} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#94a3b8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: colors.text,
  },
  email: {
    fontSize: 16,
    color: colors.text,
  },
  infoContainer: {
    backgroundColor: colors.bg_accent,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoText: {
    marginLeft: 15,
    fontSize: 16,
    color: colors.text,
  },
  logoutButton: {
    backgroundColor: "#e78284",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: {
    color: colors.text,
    fontWeight: "bold",
    fontSize: 16,
  },
});
