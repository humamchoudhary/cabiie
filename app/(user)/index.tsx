// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function UserIndex() {
  return <Redirect href="/(user)/home" />;
}
