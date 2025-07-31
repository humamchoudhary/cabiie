import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "@/context/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";

// Ride pricing configuration
const PRICING = {
  baseFare: 2.5,
  perKm: {
    bike: 0.8,
    car: 1.2,
    car_plus: 1.5,
    premium: 2.0,
  },
  minFare: 5.0,
};

export default function DriverRideStatusScreen() {
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rideDistance, setRideDistance] = useState<number | null>(null);
  const [rideStage, setRideStage] = useState<'pending' | 'started' | 'completed'>('pending');
  const router = useRouter();
  const { user } = useAuth();
  const [hasReachedPickup, setHasReachedPickup] = useState(false);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
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

  // Calculate ride earnings
  const calculateEarnings = () => {
    if (!rideDistance || !ride?.rideType) return PRICING.minFare.toFixed(2);

    const base = PRICING.baseFare;
    const perKmRate =
      PRICING.perKm[ride.rideType as keyof typeof PRICING.perKm] || 1.2;
    const distanceFare = rideDistance * perKmRate;
    const total = base + distanceFare;

    return Math.max(total, PRICING.minFare).toFixed(2);
  };

  // Open navigation app with directions
  const openNavigation = (latitude: number, longitude: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const startRide = async () => {
    try {
      await updateDoc(doc(firestore, "rides", rideId as string), {
        status: "in_progress",
        startedAt: new Date().toISOString()
      });
      setRideStage('started');
    } catch (error) {
      Alert.alert("Error", "Failed to start ride");
    }
  };

  const completeRide = async () => {
    try {
      const earnings = calculateEarnings();
      
      await updateDoc(doc(firestore, "rides", rideId as string), {
        status: "completed",
        completedAt: new Date().toISOString(),
        distance: rideDistance,
        earnings: parseFloat(earnings),
      });

      // Update driver status
      await update(ref(database, `drivers/${user?.uid}`), {
        status: "available",
        currentRide: null,
      });

      // Update driver's total earnings in Firestore
      const driverRef = doc(firestore, "drivers", user?.uid);
      const driverDoc = await getDoc(driverRef);
      if (driverDoc.exists()) {
        const currentEarnings = driverDoc.data().totalEarnings || 0;
        await updateDoc(driverRef, {
          totalEarnings: currentEarnings + parseFloat(earnings),
          completedRides: (driverDoc.data().completedRides || 0) + 1,
        });
      }

      setRideStage('completed');
    } catch (error) {
      Alert.alert("Error", "Failed to complete ride");
    }
  };

  useEffect(() => {
    if (!rideId) return;

    // Listen to ride updates
    const unsubscribe = onSnapshot(
      doc(firestore, "rides", rideId as string),
      (doc) => {
        const rideData = doc.data();
        setRide(rideData);

        // Set ride stage based on status
        if (rideData?.status === "completed") {
          setRideStage('completed');
        } else if (rideData?.status === "in_progress") {
          setRideStage('started');
        } else {
          setRideStage('pending');
        }

        // Calculate distance when we have all locations
        if (rideData?.pickupLocation && rideData?.destinationLocation) {
          const distance = calculateDistance(
            rideData.pickupLocation.latitude,
            rideData.pickupLocation.longitude,
            rideData.destinationLocation.latitude,
            rideData.destinationLocation.longitude,
          );
          setRideDistance(distance);
        }
      },
    );

    // Get user location from Realtime DB
    const userLocationRef = ref(database, `users/${ride?.userId}/location`);
    const userLocationUnsubscribe = onValue(userLocationRef, (snapshot) => {
      setUserLocation(snapshot.val());
    });

    // Update driver's current location periodically
    let locationInterval: NodeJS.Timeout;
    const startLocationUpdates = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Initial update
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      updateDriverLocation(location);

      // Update every 10 seconds
      locationInterval = setInterval(async () => {
        location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
        updateDriverLocation(location);
      }, 10000);
    };

    const updateDriverLocation = (location: Location.LocationObject) => {
      if (user?.uid) {
        update(ref(database, `drivers/${user.uid}`), {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          lastUpdated: Date.now(),
        });
      }
    };

    startLocationUpdates();

    return () => {
      unsubscribe();
      userLocationUnsubscribe();
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [rideId]);

  // Add this useEffect to check proximity to pickup and destination
  useEffect(() => {
    if (!currentLocation || !ride) return;

    // Check if driver has reached pickup location
    if (ride.pickupLocation && rideStage === 'pending') {
      const distanceToPickup = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        ride.pickupLocation.latitude,
        ride.pickupLocation.longitude
      );
      setHasReachedPickup(distanceToPickup < 0.05); // 50 meters
    }

    // Check if driver has reached destination
    if (ride.destinationLocation && rideStage === 'started') {
      const distanceToDestination = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        ride.destinationLocation.latitude,
        ride.destinationLocation.longitude
      );
      setHasReachedDestination(distanceToDestination < 0.05); // 50 meters
    }
  }, [currentLocation, ride, rideStage]);

  const getRideProgress = () => {
    if (rideStage === 'pending') return 0;
    if (rideStage === 'completed') return 100;
    
    if (!currentLocation || !ride?.pickupLocation || !ride?.destinationLocation)
      return 0;

    const totalDistance = calculateDistance(
      ride.pickupLocation.latitude,
      ride.pickupLocation.longitude,
      ride.destinationLocation.latitude,
      ride.destinationLocation.longitude,
    );

    const currentDistance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      ride.destinationLocation.latitude,
      ride.destinationLocation.longitude,
    );

    return Math.min(
      100,
      Math.max(0, 100 - (currentDistance / totalDistance) * 100),
    );
  };

  const renderActionButtons = () => {
    if (rideStage === 'completed') {
      return (
        <View className="mt-4 p-3 bg-gray-50 rounded-lg">
          <Text className="text-center font-bold text-lg">
            Ride Completed! Earnings: ${calculateEarnings()}
          </Text>
          <Pressable
            onPress={() => router.replace("/(driver)/home")}
            className="bg-blue-500 p-3 rounded-lg mt-4 items-center"
          >
            <Text className="text-white font-bold">Return to Home</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-row space-x-3 mt-4">
        <Pressable
          onPress={() => {
            Alert.alert(
              "Cancel Ride",
              "Are you sure you want to cancel this ride?",
              [
                { text: "No", style: "cancel" },
                { 
                  text: "Yes", 
                  onPress: async () => {
                    await updateDoc(doc(firestore, "rides", rideId as string), {
                      status: "cancelled",
                      cancelledAt: new Date().toISOString(),
                    });
                    await update(ref(database, `drivers/${user?.uid}`), {
                      status: "available",
                      currentRide: null,
                    });
                    router.replace("/(driver)/home");
                  }
                }
              ]
            );
          }}
          className="flex-1 bg-red-100 p-3 rounded-lg items-center border border-red-200"
        >
          <MaterialIcons name="cancel" size={24} color="red" />
          <Text className="text-red-600 mt-1">Cancel Ride</Text>
        </Pressable>

        {rideStage === 'pending' && hasReachedPickup && (
          <Pressable
            onPress={startRide}
            className="flex-1 bg-blue-500 p-3 rounded-lg items-center"
            disabled={!hasReachedPickup}
          >
            <Text className="text-white font-bold">Start Ride</Text>
          </Pressable>
        )}

        {rideStage === 'started' && hasReachedDestination && (
          <Pressable
            onPress={completeRide}
            className="flex-1 bg-green-500 p-3 rounded-lg items-center"
            disabled={!hasReachedDestination}
          >
            <Text className="text-white font-bold">Complete Ride</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white p-4 shadow-sm">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xl font-bold">
            {ride?.rideType === "bike"
              ? "Bike"
              : ride?.rideType === "car"
                ? "Standard Car"
                : ride?.rideType === "car_plus"
                  ? "Car Plus"
                  : "Premium"}{" "}
            Ride
          </Text>
          <Text className="text-gray-600 capitalize">
            {rideStage === 'pending' ? 'Ready to Start' : 
             rideStage === 'started' ? 'In Progress' : 'Completed'}
          </Text>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-gray-200 rounded-full mb-2">
          <View
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${getRideProgress()}%` }}
          />
        </View>
        <Text className="text-gray-600 text-sm">
          {getRideProgress().toFixed(0)}% completed
        </Text>
      </View>

      {/* Map View */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: ride?.pickupLocation?.latitude || 37.78825,
          longitude: ride?.pickupLocation?.longitude || -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        className="flex-1"
      >
        {/* Pickup Marker */}
        {ride?.pickupLocation && (
          <Marker
            coordinate={{
              latitude: ride.pickupLocation.latitude,
              longitude: ride.pickupLocation.longitude,
            }}
            title="Pickup Location"
          >
            <View className="bg-white p-2 rounded-full border-2 border-blue-500">
              <MaterialIcons name="location-pin" size={24} color="blue" />
            </View>
          </Marker>
        )}

        {/* Driver Marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Your Location"
          >
            <View className="bg-white p-2 rounded-full border-2 border-green-500">
              <MaterialIcons name="directions-car" size={24} color="green" />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {ride?.destinationLocation && (
          <Marker
            coordinate={{
              latitude: ride.destinationLocation.latitude,
              longitude: ride.destinationLocation.longitude,
            }}
            title="Destination"
          >
            <View className="bg-white p-2 rounded-full border-2 border-red-500">
              <MaterialIcons name="flag" size={24} color="red" />
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {ride?.pickupLocation && ride?.destinationLocation && (
          <Polyline
            coordinates={[
              {
                latitude: ride.pickupLocation.latitude,
                longitude: ride.pickupLocation.longitude,
              },
              {
                latitude: ride.destinationLocation.latitude,
                longitude: ride.destinationLocation.longitude,
              },
            ]}
            strokeColor="#3b82f6"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Action Panel */}
      <View className="bg-white p-4 shadow-lg">
        <View className="flex-row justify-between mb-4">
          <View>
            <Text className="text-gray-600">Distance</Text>
            <Text className="font-bold">
              {rideDistance
                ? rideDistance.toFixed(1) + " km"
                : "Calculating..."}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-gray-600">Earnings</Text>
            <Text className="font-bold text-green-600">
              ${calculateEarnings()}
            </Text>
          </View>
        </View>

        <View className="flex-row space-x-3">
          <Pressable
            onPress={() =>
              openNavigation(
                ride?.destinationLocation?.latitude || 0,
                ride?.destinationLocation?.longitude || 0,
              )
            }
            className="flex-1 bg-blue-50 p-3 rounded-lg items-center border border-blue-200"
          >
            <MaterialIcons name="navigation" size={24} color="blue" />
            <Text className="text-blue-600 mt-1">Navigate</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL(`tel:${ride?.userPhone || ""}`)}
            className="flex-1 bg-green-50 p-3 rounded-lg items-center border border-green-200"
          >
            <MaterialIcons name="phone" size={24} color="green" />
            <Text className="text-green-600 mt-1">Call Rider</Text>
          </Pressable>
        </View>

        {renderActionButtons()}
      </View>

      {/* Ride Details Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white p-6 rounded-t-3xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Ride Details</Text>
              <Pressable onPress={() => setShowDetails(false)}>
                <MaterialIcons name="close" size={24} />
              </Pressable>
            </View>

            {ride && (
              <View className="space-y-4">
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Ride Type:</Text>
                  <Text className="font-bold capitalize">
                    {ride.rideType} Ride
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Status:</Text>
                  <Text className="font-bold capitalize">
                    {rideStage === 'pending' ? 'Ready to Start' : 
                     rideStage === 'started' ? 'In Progress' : 'Completed'}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Requested At:</Text>
                  <Text className="font-bold">
                    {new Date(ride.createdAt).toLocaleTimeString()}
                  </Text>
                </View>

                {rideDistance && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Distance:</Text>
                    <Text className="font-bold">
                      {rideDistance.toFixed(1)} km
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Estimated Earnings:</Text>
                  <Text className="font-bold text-green-600">
                    ${calculateEarnings()}
                  </Text>
                </View>

                <View className="border-t border-gray-200 pt-4">
                  <Text className="font-bold mb-2">Pricing Breakdown:</Text>
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Base Fare:</Text>
                      <Text>${PRICING.baseFare.toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Distance Fare:</Text>
                      <Text>
                        {rideDistance?.toFixed(1)} km × $
                        {PRICING.perKm[
                          ride.rideType as keyof typeof PRICING.perKm
                        ].toFixed(2)}
                      </Text>
                    </View>
                    {parseFloat(calculateEarnings()) === PRICING.minFare && (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600">Minimum Fare:</Text>
                        <Text>${PRICING.minFare.toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setShowDetails(false)}
              className="bg-blue-500 p-3 rounded-lg mt-6"
            >
              <Text className="text-white text-center font-bold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}