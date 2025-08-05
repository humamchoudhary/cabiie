// app/(user)/profile.tsx
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ScrollView,
  Linking,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "@/utils/colors";
import { auth, database, firestore } from "@/config/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

export default function UserProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;

      try {
        const docRef = doc(firestore, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user?.uid]);

  const menuItems = [
    {
      id: "rides",
      title: "My Rides",
      subtitle: "View ride history and active rides",
      icon: "directions-car",
      onPress: () => router.push("/(user)/rides"),
    },
    {
      id: "support",
      title: "Help & Support",
      subtitle: "Get help with your rides",
      icon: "help",
      onPress: () => {
        Linking.openURL("tel:051111111");
      },
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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

      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <MaterialIcons
                name={item.icon as any}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <MaterialIcons name="phone" size={24} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {userData?.phone || "Not provided"}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons
            name="account-circle"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={styles.infoText}>Passenger Account</Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons name="verified" size={24} color={colors.primary} />
          <Text style={styles.infoText}>Verified Account</Text>
        </View>
      </View>

      <Pressable onPress={signOut} style={styles.logoutButton}>
        <MaterialIcons
          name="logout"
          size={20}
          color="#e78284"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.bg_accent,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: colors.text,
  },
  email: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  menuContainer: {
    backgroundColor: colors.bg_accent,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoContainer: {
    backgroundColor: colors.bg_accent,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoText: {
    marginLeft: 15,
    fontSize: 16,
    color: colors.text,
  },
  logoutButton: {
    backgroundColor: colors.bg_accent,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e78284",
  },
  logoutText: {
    color: "#e78284",
    fontWeight: "600",
    fontSize: 16,
  },
});
