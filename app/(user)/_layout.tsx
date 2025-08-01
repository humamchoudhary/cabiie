import { Redirect, Stack } from "expo-router";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/utils/colors";

export default function UserLayout() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || userRole !== "user") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "My Profile" }} />
      <Stack.Screen name="status" options={{ title: "Status" }} />
      <Stack.Screen name="ride-status" options={{ title: "Ride Status" }} />
    </Stack>
  );
}
