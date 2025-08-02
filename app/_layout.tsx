// app/_layout.tsx

import "react-native-get-random-values";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

import { StatusBar } from "expo-status-bar";
import "@/global.css";
import { colors } from "@/utils/colors";

function AuthLayout() {
  const { loading } = useAuth();

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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  // seedDemoDrivers();
  return (
    <AuthProvider>
      <StatusBar hidden={true} />
      <AuthLayout />
    </AuthProvider>
  );
}
