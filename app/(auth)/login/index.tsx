// app/(auth)/login/index.tsx
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, userRole } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
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
      // Navigation handled by auth state change
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-2xl font-bold mb-6">Login to RideApp</Text>

      {error ? <Text className="text-red-500 mb-4">{error}</Text> : null}

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="border border-gray-300 p-3 rounded mb-4"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="border border-gray-300 p-3 rounded mb-6"
      />

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="bg-blue-500 p-3 rounded items-center"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-medium">Login</Text>
        )}
      </Pressable>

      <View className="flex-row justify-center mt-4">
        <Text className="text-gray-600">Don't have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/role-selection")}>
          <Text className="text-blue-500">Sign up</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/(auth)/forgot-password")}
        className="mt-2"
      >
        <Text className="text-blue-500 text-center">Forgot password?</Text>
      </Pressable>
    </View>
  );
}
