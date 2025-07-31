// app/(user)/ride-status/index.tsx
import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { ref, onValue } from "firebase/database";
import { database } from "@/config/firebase";
import MapView, { Marker } from "react-native-maps";

export default function RideStatusScreen() {
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!rideId) return;

    // Listen to ride updates
    const unsubscribeRide = onSnapshot(
      doc(firestore, "rides", rideId as string),
      (d) => {
        setRide(d.data());
      },
    );

    return () => {
      unsubscribeRide();
      // if (driverLocationUnsubscribe) driverLocationUnsubscribe();
    };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driverId) return;

    // Get driver details
    const getDriver = async () => {
      const driverDoc = await getDoc(doc(firestore, "users", ride.driverId));
      setDriver(driverDoc.data());
    };

    // Listen to driver location updates
    const driverLocationUnsubscribe = onValue(
      ref(database, `drivers/${ride.driverId}`),
      (snapshot) => {
        setDriverLocation(snapshot.val());
      },
    );

    getDriver();
  }, [ride?.driverId]);

  const cancelRide = async () => {
    try {
      await updateDoc(doc(firestore, "rides", rideId as string), {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });
      router.replace("/(user)/home");
    } catch (error) {
      Alert.alert("Error", "Failed to cancel ride");
    }
  };

  return (
    <View className="flex-1">
      <View className="p-4 bg-white shadow-sm">
        <Text className="text-xl font-bold">Your Ride</Text>
        <Text className="text-gray-600 capitalize">{ride?.rideType} Ride</Text>
      </View>

      {driver && (
        <View className="p-4 border-b border-gray-200">
          <Text className="font-bold text-lg">{driver.name}</Text>
          <Text className="text-gray-600">
            {driver.vehicleInfo?.type} • {driver.vehicleInfo?.licensePlate}
          </Text>
          <Text className="mt-2">⭐ {driver.rating || "5.0"}</Text>
        </View>
      )}

      <View className="flex-1">
        {ride?.pickupLocation && driverLocation && (
          <MapView
            className="flex-1"
            initialRegion={{
              latitude: ride.pickupLocation.latitude,
              longitude: ride.pickupLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            <Marker
              coordinate={{
                latitude: ride.pickupLocation.latitude,
                longitude: ride.pickupLocation.longitude,
              }}
              title="Pickup Location"
            />
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title="Your Driver"
              pinColor="blue"
            />
          </MapView>
        )}
      </View>

      <View className="p-4 bg-white">
        <Pressable onPress={cancelRide} className="bg-red-500 p-3 rounded-lg">
          <Text className="text-white text-center font-bold">Cancel Ride</Text>
        </Pressable>
      </View>
    </View>
  );
}
