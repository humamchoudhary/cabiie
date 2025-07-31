// app/(user)/waiting/index.tsx
import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "@/context/AuthContext";

export default function WaitingScreen() {
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = onSnapshot(
      doc(firestore, "rides", rideId as string),
      (d) => {
        const data = d.data();
        setRide(data);

        if (data?.driverId) {
          // Fetch driver details when assigned
          const driverRef = doc(firestore, "users", data.driverId);
          getDoc(driverRef).then((driverDoc) => {
            setDriver(driverDoc.data());
          });
        }

        // Navigate when ride is accepted
        if (data?.status === "accepted") {
          router.replace(`/(user)/ride-status?rideId=${rideId}`);
        }
      },
    );

    return unsubscribe;
  }, [rideId]);

  const cancelRide = async () => {
    setCancelling(true);
    try {
      await updateDoc(doc(firestore, "rides", rideId as string), {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });
      router.replace("/(user)/home");
    } catch (error) {
      Alert.alert("Error", "Failed to cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View className="flex-1 p-6 justify-center items-center">
      {ride?.status === "searching" && (
        <>
          <ActivityIndicator size="large" className="mb-4" />
          <Text className="text-xl font-bold mb-2">Looking for drivers...</Text>
          <Text className="text-gray-600 mb-6">
            Searching for {ride.rideType} nearby
          </Text>

          <Pressable
            onPress={cancelRide}
            disabled={cancelling}
            className="bg-red-500 px-6 py-3 rounded-full"
          >
            {cancelling ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-medium">Cancel Ride</Text>
            )}
          </Pressable>
        </>
      )}

      {ride?.status === "accepted" && driver && (
        <View className="w-full">
          <Text className="text-xl font-bold mb-6 text-center">
            Driver Found!
          </Text>

          <View className="bg-white p-4 rounded-lg shadow-md mb-6">
            <Text className="text-lg font-semibold mb-2">{driver.name}</Text>
            <Text className="text-gray-600 mb-2">
              ⭐ {driver.rating || "5.0"}
            </Text>
            <Text className="mb-2">
              {driver.vehicleInfo?.type} • {driver.vehicleInfo?.licensePlate}
            </Text>
            <Pressable className="bg-green-100 p-2 rounded mt-2">
              <Text className="text-green-800 text-center">Call Driver</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              router.replace(`/(user)/ride-status?rideId=${rideId}`)
            }
            className="bg-blue-500 p-3 rounded-lg"
          >
            <Text className="text-white text-center font-bold">
              View Ride Status
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
