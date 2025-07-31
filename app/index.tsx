// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    // No user logged in, redirect to auth flow
    return <Redirect href="/(auth)/login" />;
  }

  // User is logged in, redirect based on role
  switch (userRole) {
    case "user":
      return <Redirect href="/(user)" />;
    case "driver":
      return <Redirect href="/(driver)/home" />;
    default:
      // If user has no role set (shouldn't happen in normal flow)
      return <Redirect href="/(auth)/role-selection" />;
  }
}
