// app/(auth)/role-selection/page.tsx
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/utils/colors";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function RoleSelectionScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ height: 180, width: 180, tintColor: colors.primary }}
            resizeMode="contain"
          />
          <Text style={styles.title}>Join RideApp</Text>
          <Text style={styles.subtitle}>
            Choose how you want to get started
          </Text>
        </View>

        {/* Role Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* Passenger Card */}
          <Pressable
            onPress={() => router.push("/(auth)/user-register")}
            style={[styles.roleCard, styles.passengerCard]}
          >
            <View style={styles.cardIconContainer}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>Passenger</Text>
          </Pressable>

          {/* Driver Card */}
          <Pressable
            onPress={() => router.push("/(auth)/driver-register")}
            style={[styles.roleCard, styles.driverCard]}
          >
            <View style={styles.cardIconContainer}>
              <Ionicons name="car" size={40} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>Driver</Text>
          </Pressable>
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={styles.loginButton}
          >
            <Text style={styles.loginLink}>Sign In</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: height * 0.08,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#f8f9fa",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: height * 0.06,
    gap: 16,
  },
  roleCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  passengerCard: {
    backgroundColor: colors.primary,
  },
  driverCard: {
    backgroundColor: "#2ECC71", // Green color for driver
  },
  cardIconContainer: {
    width: 70,
    height: 70,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  loginContainer: {
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: colors.secondary,
    marginBottom: 8,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginRight: 6,
  },
});
