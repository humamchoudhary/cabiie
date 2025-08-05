import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { auth } from "@/config/firebase";
import { colors } from "@/utils/colors";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function UnverifiedScreen() {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await auth.signOut();
      router.replace("/(auth)/login");
    } catch (error) {
      console.log("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon Section */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Ionicons
              name="time-outline"
              size={80}
              color={colors.warning || "#f59e0b"}
            />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Account Under Verification</Text>
          <Text style={styles.subtitle}>
            Thank you for registering as a driver with Cabiie!
          </Text>
          <Text style={styles.description}>
            Your account is currently being reviewed by our team. This process
            typically takes 24-48 hours to ensure the safety and security of our
            platform.
          </Text>

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.primary}
              style={styles.infoIcon}
            />
            <Text style={styles.infoText}>
              You will receive a notification once your account has been
              verified and you can start using the app.
            </Text>
          </View>

          <Text style={styles.waitText}>
            Please wait while we complete the verification process.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={[
              styles.signOutButton,
              signingOut && styles.signOutButtonDisabled,
            ]}
          >
            <Text style={styles.signOutButtonText}>
              {signingOut ? "Signing Out..." : "Sign Out"}
            </Text>
          </Pressable>
        </View>

        {/* Support Section */}
        <View style={styles.supportContainer}>
          <Text style={styles.supportTitle}>Need Help?</Text>
          <Text style={styles.supportText}>
            If you have any questions about the verification process, please
            contact our support team.
          </Text>
          <Pressable
            onPress={() => {
              Linking.openURL("tel:051111111");
            }}
            style={styles.supportButton}
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconBackground: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.warning ? `${colors.warning}20` : "#f59e0b20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  contentContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: colors.primary,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: colors.primary ? `${colors.primary}10` : "#007AFF10",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  waitText: {
    fontSize: 16,
    color: colors.warning || "#f59e0b",
    textAlign: "center",
    fontWeight: "600",
  },
  buttonContainer: {
    marginBottom: 30,
  },
  signOutButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  supportContainer: {
    alignItems: "center",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary ? `${colors.primary}10` : "#007AFF10",
  },
  supportButtonTest: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
});
