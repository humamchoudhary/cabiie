import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/utils/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, userRole } = useAuth();

  useEffect(() => {
    console.log(user);
    if (user) {
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
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.log(error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 24,
          color: colors.primary,
        }}
      >
        Login to RideApp
      </Text>

      {error ? (
        <Text style={{ color: colors.error, marginBottom: 16 }}>{error}</Text>
      ) : null}

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor={colors.secondary}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          color: colors.text,
          backgroundColor: "#fff",
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={colors.secondary}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
          marginBottom: 24,
          color: colors.text,
          backgroundColor: "#fff",
        }}
      />

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>Login</Text>
        )}
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.secondary }}>Don't have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/role-selection")}>
          <Text style={{ color: colors.primary }}>Sign up</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/(auth)/forgot-password")}
        style={{ marginTop: 8 }}
      >
        <Text style={{ color: colors.primary, textAlign: "center" }}>
          Forgot password?
        </Text>
      </Pressable>
    </View>
  );
}
