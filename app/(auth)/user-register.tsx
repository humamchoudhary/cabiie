import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, firestore } from "@/config/firebase";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { colors } from "@/utils/colors";

export default function UserRegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create user with email/password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Update user profile
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Create user document in Firestore
      await setDoc(doc(firestore, "users", userCredential.user.uid), {
        name,
        email,
        phone,
        userType: "user",
        createdAt: new Date().toISOString(),
        rating: 5, // Default rating for new users
        tripsCompleted: 0,
        verified: true,
      });

      // Redirect to user home
      router.replace("/(user)/home");
    } catch (error: any) {
      console.error("Registration error:", error);
      setError(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className="flex-1 p-6 justify-center"
      style={{ backgroundColor: colors.background }}
    >
      <Text className="text-2xl font-bold mb-6" style={{ color: colors.text }}>
        Create Passenger Account
      </Text>

      {error ? (
        <Text className="text-red-500 mb-4 text-center">{error}</Text>
      ) : null}

      <TextInput
        placeholder="Full Name"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Phone Number"
        placeholderTextColor={colors.textSecondary}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Password (min 6 characters)"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor={colors.textSecondary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        className="p-4 rounded-lg mb-6"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <Pressable
        onPress={handleRegister}
        disabled={loading}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: loading ? colors.primary : colors.primary,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-center font-bold text-white">
            Create Account
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} className="p-2">
        <Text className="text-center" style={{ color: colors.secondary }}>
          Back to role selection
        </Text>
      </Pressable>
    </View>
  );
}
