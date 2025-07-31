// app/(driver)/home/index.tsx
import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { ref, onValue, off, update } from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import { MaterialIcons } from "@expo/vector-icons";


export default function DriverHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [rideRequests, setRideRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Get current location and update to Realtime DB
  useEffect(() => {
    let intervalId;

    const updateLocation = async () => {
      setUpdatingLocation(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission required",
            "Location permission is needed to receive ride requests",
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

        // Update to Realtime DB
        if (user?.uid) {
          await update(ref(database, `drivers/${user.uid}`), {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            lastUpdated: Date.now(),
            status: "available",
            rideType: ["car", "car_plus"], // Adjust based on driver's vehicle type
          });
        }
      } catch (error) {
        console.error("Error updating location:", error);
      } finally {
        setUpdatingLocation(false);
      }
    };

    // Initial update
    updateLocation();

    // Update every 15 seconds (more frequent than user app)
    intervalId = setInterval(updateLocation, 15000);

    return () => {
      clearInterval(intervalId);
      // Clean up Realtime DB listener
      if (user?.uid) {
        update(ref(database, `drivers/${user.uid}`), { status: "offline" });
      }
    };
  }, [user]);

  // Listen for nearby ride requests
  useEffect(() => {
    if (!location) return;

    const radius = 2; // 2km radius
    const rideRequestsRef = ref(database, "rideRequests");

    const unsubscribe = onValue(rideRequestsRef, (snapshot) => {
      const requests: any[] = [];
      snapshot.forEach((childSnapshot) => {
        const request = childSnapshot.val();

        // Only show requests matching driver's ride types and within radius
        if (request.status === "searching") {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            request.pickupLocation.latitude,
            request.pickupLocation.longitude,
          );

          if (distance <= radius) {
            requests.push({ ...request, id: childSnapshot.key, distance });
          }
        }
      });

      setRideRequests(requests);
    });

    return () => off(rideRequestsRef);
  }, [location]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    // Haversine formula to calculate distance in km
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const acceptRide = async (rideId: string) => {
    setLoading(true);
    try {
      // First update in Firestore
      await updateDoc(doc(firestore, "rides", rideId), {
        status: "accepted",
        driverId: user?.uid,
        acceptedAt: new Date().toISOString(),
      });

      // Then update in Realtime DB
      await update(ref(database, `rideRequests/${rideId}`), {
        status: "accepted",
        driverId: user?.uid,
      });

      // Update driver status
      await update(ref(database, `drivers/${user?.uid}`), {
        status: "in_ride",
        currentRide: rideId,
      });

      // Navigate to ride screen
      router.push(`/(driver)/ride-status?rideId=${rideId}`);
    } catch (error) {
      Alert.alert("Error", "Failed to accept ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      {/* Map View */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Driver Location */}
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

        {/* Nearby Ride Requests */}
        {rideRequests.map((request) => (
          <Marker
            key={request.id}
            coordinate={{
              latitude: request.pickupLocation.latitude,
              longitude: request.pickupLocation.longitude,
            }}
            title={`${request.rideType} Ride`}
            description={`${request.distance.toFixed(1)} km away`}
          >
            <View className="bg-white p-2 rounded-full border-2 border-green-500">
              <Text className="text-lg">
                {request.rideType === "bike"
                  ? "🚲"
                  : request.rideType === "car"
                    ? "🚗"
                    : request.rideType === "car_plus"
                      ? "🚙"
                      : "🏎️"}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Search Radius Circle */}
        {location && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={2000} // 2km in meters
            strokeColor="rgba(0, 150, 255, 0.5)"
            fillColor="rgba(0, 150, 255, 0.2)"
          />
        )}
      </MapView>

      {/* Ride Requests Panel */}
      <View className="absolute bottom-4 left-0 right-0 p-4">
        <View className="bg-white p-4 rounded-lg shadow-lg">
          <Text className="text-lg font-bold mb-2">Nearby Ride Requests</Text>

          {rideRequests.length === 0 ? (
            <Text className="text-gray-500 text-center py-4">
              No ride requests within 2km radius
            </Text>
          ) : (
            <View className="max-h-64">
              {rideRequests.map((request) => (
                <View
                  key={request.id}
                  className="mb-3 p-3 border border-gray-200 rounded-lg"
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="font-bold">
                      {request.rideType === "bike"
                        ? "Bike"
                        : request.rideType === "car"
                          ? "Standard Car"
                          : request.rideType === "car_plus"
                            ? "Car Plus"
                            : "Premium"}{" "}
                      Ride
                    </Text>
                    <Text className="text-gray-600">
                      {request.distance.toFixed(1)} km
                    </Text>
                  </View>

                  {request.destination && (
                    <Text className="text-gray-600 mb-2">
                      To: {request.destination}
                    </Text>
                  )}

                  <Pressable
                    onPress={() => acceptRide(request.id)}
                    disabled={loading}
                    className="bg-green-500 p-2 rounded-lg"
                  >
                    <Text className="text-white text-center font-medium">
                      Accept Ride
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View className="mt-2 flex-row items-center">
            <View className="w-3 h-3 bg-green-500 rounded-full mr-2"></View>
            <Text className="text-gray-600 text-sm">
              Available ride requests
            </Text>
          </View>
        </View>
      </View>

      {/* Status Bar */}
      <View className="absolute top-16 left-0 right-0 px-4">
        <View className="bg-white p-3 rounded-lg shadow-sm flex-row justify-between items-center">
          <View>
            <Text className="font-bold">Status: Available</Text>
            {updatingLocation && (
              <Text className="text-gray-600 text-xs">
                Updating location...
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            <View className="w-2 h-2 bg-green-500 rounded-full mr-1"></View>
            <Text className="text-gray-600 text-sm">Active</Text>
          </View>

        </View>      

      </View>
          <Pressable
          onPress={() => router.push("/(driver)/profile")}
          className="absolute top-4 left-4 bg-white p-2 rounded-full shadow"
        >
          <MaterialIcons name="person" size={24} color="#3B82F6" />
        </Pressable>
      
    </View>

    
  );
}
