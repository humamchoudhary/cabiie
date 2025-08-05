import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, firestore } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/utils/colors";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const router = useRouter();
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (user && userRole) {
      if (userRole === "user") {
        router.replace("/(user)/home");
      } else if (userRole === "driver") {
        router.replace("/(driver)/home");
      }
    }
  }, [user, userRole]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Get user data from Firestore to check userType and verification status
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;

        // Check if user is a driver and if they're verified
        if (userType === "driver") {
          console.log(userData);
          if (!userData.verified) {
            console.log("user not verified");
            // Driver is not verified yet - navigate to unverified screen
            router.replace("/(auth)/unverified");
            setLoading(false);
            return;
          } else {
            // Driver is verified, they can proceed
            router.replace("/(driver)/home");
          }
        } else if (userType === "user") {
          // Regular user, proceed normally
          router.replace("/(user)/home");
        } else {
          setError("Invalid user type. Please contact support.");
          await auth.signOut();
        }
      } else {
        setError("User not found.");
        await auth.signOut();
      }
    } catch (error: any) {
      console.log("Login error:", error);

      // Handle specific Firebase Auth errors
      let errorMessage = "An error occurred during login.";

      await auth.signOut();
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address.";
          break;
        case "auth/user-disabled":
          errorMessage =
            "This account has been disabled. Please contact support.";
          break;
        case "auth/user-not-found":
          errorMessage = "No account found with this email address.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password. Please try again.";
          break;
        case "auth/invalid-credential":
          errorMessage =
            "Invalid email or password. Please check your credentials.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
        default:
          errorMessage = error.message || "Login failed. Please try again.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to continue to RideApp
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#F00" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Section */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholderTextColor={colors.textSecondary}
                style={styles.textInput}
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                autoComplete="password"
                placeholderTextColor={colors.textSecondary}
                style={[styles.textInput, { paddingRight: 50 }]}
                editable={!loading}
              />
              <Pressable
                onPress={() => setPasswordVisible(!passwordVisible)}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Ionicons
                  name={passwordVisible ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading || !email.trim() || !password.trim()}
              style={[
                styles.loginButton,
                (loading || !email.trim() || !password.trim()) &&
                  styles.loginButtonDisabled,
              ]}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loadingText}>Signing In...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </Pressable>

            {/* Forgot Password */}
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Sign Up Section */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account?</Text>
            <Pressable
              onPress={() => router.push("/(auth)/role-selection")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.signUpLink,
                  loading && styles.signUpLinkDisabled,
                ]}
              >
                Create Account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: height * 0.05,
    marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 180,
    tintColor: colors.primary,
  },
  welcomeContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fee",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorText: {
    color: colors.error,
    marginLeft: 12,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: colors.text,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    color: colors.text,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonDisabled: {
    backgroundColor: colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  forgotPasswordContainer: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textSecondary,
    fontSize: 14,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },
  signUpText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginRight: 4,
  },
  signUpLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  signUpLinkDisabled: {
    color: colors.textSecondary,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bg_accent,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 6,
    textAlign: "center",
  },
});
