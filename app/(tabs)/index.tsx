// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userRole === "user") {
    return <Redirect href="/(user)/home" />;
  }

  if (userRole === "driver") {
    return <Redirect href="/(driver)/home" />;
  }

  // If user exists but role isn't set (shouldn't happen with our flow)
  return <Redirect href="/(auth)/role-selection" />;
}
