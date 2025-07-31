// app/(auth)/role-selection/page.tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/utils/colors";

export default function RoleSelectionScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 p-6 justify-center" style={{ backgroundColor: colors.background }}>
      <Text 
        className="text-2xl font-bold mb-8 text-center" 
        style={{ color: colors.text }}
      >
        Join as
      </Text>

      <Pressable
        onPress={() => router.push("/(auth)/register?role=user")}
        className="p-4 rounded-lg mb-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-medium text-white">
          Passenger
        </Text>
        <Text className="text-center text-sm mt-1 text-white">
          Book rides and get to your destination
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/register?role=driver")}
        className="p-4 rounded-lg mb-6"
        style={{ backgroundColor: colors.secondary }}
      >
        <Text className="text-center font-medium text-white">
          Driver
        </Text>
        <Text className="text-center text-sm mt-1 text-white">
          Earn money by giving rides
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(auth)/login")}>
        <Text className="text-center" style={{ color: colors.secondary }}>
          Already have an account? Login
        </Text>
      </Pressable>
    </View>
  );
}