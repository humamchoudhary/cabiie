// app/(user)/home/index.tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import { ref, onValue, off, set } from "firebase/database";
import { colors } from "@/utils/colors";
import { AntDesign } from "@expo/vector-icons";

const rideTypes = [
  { id: "bike", name: "Bike", icon: "🚲", multiplier: 1 },
  { id: "car", name: "Standard Car", icon: "🚗", multiplier: 1.5 },
  { id: "car_plus", name: "Car Plus", icon: "🚙", multiplier: 2 },
  { id: "premium", name: "Premium", icon: "🏎️", multiplier: 3 },
];

export default function UserHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0,
    longitudeDelta: 0,
  });
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Get user location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "We need location permission to find rides",
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();
  }, []);

  // Listen for nearby drivers
  useEffect(() => {
    if (!location) return;

    const driversRef = ref(database, "drivers");
    const unsubscribe = onValue(driversRef, (snapshot) => {
      const drivers: any[] = [];
      snapshot.forEach((childSnapshot) => {
        const driver = childSnapshot.val();
        if (driver.status === "available") {
          drivers.push({
            id: childSnapshot.key,
            ...driver,
          });
        }
      });
      setNearbyDrivers(drivers);
    });

    return () => off(driversRef);
  }, [location]);

  const handleMapPress = (e: any) => {
    setSelectedLocation(e.nativeEvent.coordinate);
  };

  const requestRide = async () => {
    if (!selectedRide || !location || !selectedLocation) return;

    setLoading(true);
    try {
      const rideRequest = {
        userId: user?.uid,
        rideType: selectedRide,
        pickupLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        destinationLocation: {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        },
        destinationAddress: destination,
        status: "searching",
        createdAt: new Date().toISOString(),
      };

      // Save to Firestore
      const rideRef = doc(firestore, "rides", `ride_${Date.now()}`);
      await setDoc(rideRef, rideRequest);

      // Save to Realtime DB
      await set(ref(database, `rideRequests/${rideRef.id}`), {
        ...rideRequest,
        id: rideRef.id,
      });

      router.push(`/(user)/waiting?rideId=${rideRef.id}`);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to request ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      {/* Map View */}

      <MapView
        userInterfaceStyle="dark"
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={mapRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* User Location */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            pinColor="blue"
          />
        )}

        {/* Selected Location */}
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title="Destination"
            pinColor="green"
          />
        )}

        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.latitude,
              longitude: driver.longitude,
            }}
            title={`${driver.id === "driver1" ? "John" : driver.id === "driver2" ? "Jane" : "Mike"}`}
            description={`${driver.rideType.join(", ")} available`}
          >
            <View className="bg-white p-2 rounded-full border border-gray-200">
              <Text className="text-lg">
                {driver.rideType.includes("bike") ? "🚲" : "🚗"}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Ride Selection Panel */}
      <View className="absolute bottom-4 left-0 right-0 p-4">
        <View className="bg-white p-4 rounded-lg shadow-lg">
          <Text className="text-lg font-bold mb-2">Select Ride Type</Text>

          <View className="flex-row justify-between mb-4">
            {rideTypes.map((ride) => (
              <Pressable
                key={ride.id}
                onPress={() => setSelectedRide(ride.id)}
                className={`p-3 rounded-lg ${selectedRide === ride.id ? "bg-blue-100 border border-blue-500" : "bg-gray-100"}`}
              >
                <Text className="text-2xl">{ride.icon}</Text>
                <Text className="text-center mt-1">{ride.name}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="Enter destination address"
            value={destination}
            onChangeText={setDestination}
            className="border border-gray-300 p-3 rounded mb-4"
          />

          <Text className="mb-2">
            {selectedLocation
              ? `Selected Location: ${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`
              : "Tap on map to select destination"}
          </Text>

          <Pressable
            onPress={requestRide}
            disabled={!selectedRide || !selectedLocation || loading}
            className={`p-3 rounded-lg ${!selectedRide || !selectedLocation ? "bg-gray-300" : "bg-blue-500"}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-bold">
                Request Ride
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        className="z-100 absolute left-6 p-2 rounded-full top-6"
        style={{ backgroundColor: colors.background }}
        onPress={() => {
          router.push("/profile");
        }}
      >
        <AntDesign name="user" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}
