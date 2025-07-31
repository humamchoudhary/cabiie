// app/(auth)/register/index.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, firestore } from "@/config/firebase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useLocalSearchParams();
  const role = params.role as "user" | "driver";

  const handleRegister = async () => {
    if (!role) {
      setError("Please select a role");
      return;
    }

    setLoading(true);
    setError("");
    console.log(auth);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Create user document
      await setDoc(doc(firestore, "users", userCredential.user.uid), {
        name,
        email,
        phone,
        userType: role,
        createdAt: new Date().toISOString(),
        ...(role === "driver" && {
          driverStatus: "pending",
          vehicleInfo: null,
          documents: null,
        }),
      });

      // Redirect based on role
      if (role === "user") {
        router.replace("/(user)/home");
      } else {
        router.replace("/(driver)/application");
      }
    } catch (error: any) {
      console.log(error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-2xl font-bold mb-6">
        Register as {role === "user" ? "Passenger" : "Driver"}
      </Text>

      {error ? <Text className="text-red-500 mb-4">{error}</Text> : null}

      <TextInput
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        className="border border-gray-300 p-3 rounded mb-4"
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="border border-gray-300 p-3 rounded mb-4"
      />

      <TextInput
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
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
        onPress={handleRegister}
        disabled={loading}
        className="bg-blue-500 p-3 rounded items-center"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-medium">Register</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/(auth)/login")} className="mt-4">
        <Text className="text-blue-500 text-center">
          Already have an account? Login
        </Text>
      </Pressable>
    </View>
  );
}
