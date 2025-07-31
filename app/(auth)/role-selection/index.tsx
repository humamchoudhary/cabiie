// app/(auth)/role-selection/index.tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function RoleSelectionScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-2xl font-bold mb-8 text-center">Join as</Text>

      <Pressable
        onPress={() => router.push("/(auth)/register?role=user")}
        className="bg-blue-500 p-4 rounded-lg mb-4"
      >
        <Text className="text-white text-center font-medium">Passenger</Text>
        <Text className="text-white text-center text-sm mt-1">
          Book rides and get to your destination
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/register?role=driver")}
        className="bg-green-500 p-4 rounded-lg"
      >
        <Text className="text-white text-center font-medium">Driver</Text>
        <Text className="text-white text-center text-sm mt-1">
          Earn money by giving rides
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} className="mt-6">
        <Text className="text-blue-500 text-center">
          Already have an account? Login
        </Text>
      </Pressable>
    </View>
  );
}
