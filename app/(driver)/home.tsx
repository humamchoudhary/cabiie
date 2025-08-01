// app/(driver)/home/index.tsx
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Geocoding from "expo-location";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { ref, onValue, off, update } from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "@/utils/colors";

interface RideRequest {
  id: string;
  userId: string;
  pickupLocation: {
    latitude: number;
    longitude: number;
  };
  destinationLocation: {
    latitude: number;
    longitude: number;
  };
  destinationAddress?: string;
  rideType: string;
  status: string;
  createdAt: string;
  driverId?: string;
  distance: number;
}

interface RideStatus {
  phase:
    | "idle"
    | "navigating_to_pickup"
    | "arrived_at_pickup"
    | "ride_started"
    | "navigating_to_destination";
  currentRideId?: string;
}

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [rideStatus, setRideStatus] = useState<RideStatus>({ phase: "idle" });
  const [currentRideDetails, setCurrentRideDetails] =
    useState<RideRequest | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0,
    longitudeDelta: 0,
  });
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  // Get human-readable address from coordinates
  const getAddressFromCoords = useCallback(async (lat: number, lng: number) => {
    try {
      const address = await Geocoding.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      if (address.length > 0) {
        const firstAddress = address[0];
        return `${firstAddress.name || firstAddress.street}, ${firstAddress.city}`;
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error("Geocoding error:", error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  // Update address cache for ride requests
  const updateAddresses = useCallback(
    async (requests: RideRequest[]) => {
      const newAddresses: Record<string, string> = {};

      for (const request of requests) {
        const destKey = `${request.destinationLocation.latitude},${request.destinationLocation.longitude}`;
        if (!addresses[destKey]) {
          newAddresses[destKey] = await getAddressFromCoords(
            request.destinationLocation.latitude,
            request.destinationLocation.longitude,
          );
        }
      }

      if (Object.keys(newAddresses).length > 0) {
        setAddresses((prev) => ({ ...prev, ...newAddresses }));
      }
    },
    [addresses, getAddressFromCoords],
  );

  // Get current location and update to Realtime DB
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

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
          const driverStatus =
            rideStatus.phase === "idle" ? "available" : "in_ride";
          await update(ref(database, `drivers/${user.uid}`), {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            lastUpdated: Date.now(),
            status: driverStatus,
            rideType: ["car", "car_plus"],
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

    // Update every 15 seconds
    intervalId = setInterval(updateLocation, 15000);

    return () => {
      clearInterval(intervalId);
      // Clean up Realtime DB listener
      if (user?.uid) {
        update(ref(database, `drivers/${user.uid}`), { status: "offline" });
      }
    };
  }, [user, rideStatus]);

  // Listen for nearby ride requests (only show "searching" status)
  useEffect(() => {
    if (!location || rideStatus.phase !== "idle") return;

    const radius = 6; // 6km radius
    const rideRequestsRef = ref(database, "rideRequests");

    const unsubscribe = onValue(rideRequestsRef, async (snapshot) => {
      const requests: RideRequest[] = [];
      snapshot.forEach((childSnapshot) => {
        const request = childSnapshot.val();
        if (request.status === "searching" && !request.driverId) {
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

      // Sort by distance (closest first)
      requests.sort((a, b) => a.distance - b.distance);
      setRideRequests(requests);

      // Update addresses for new requests
      await updateAddresses(requests);
    });

    return () => off(rideRequestsRef);
  }, [location, rideStatus, updateAddresses]);

  // Monitor current ride status
  useEffect(() => {
    if (!rideStatus.currentRideId) return;

    const rideRef = ref(database, `rideRequests/${rideStatus.currentRideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      if (rideData) {
        setCurrentRideDetails({ ...rideData, id: snapshot.key });
      }
    });

    return () => off(rideRef);
  }, [rideStatus.currentRideId]);

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

  const acceptRide = async (rideId: string) => {
    setLoading(true);
    try {
      // Update in Firestore
      await updateDoc(doc(firestore, "rides", rideId), {
        status: "accepted",
        driverId: user?.uid,
        acceptedAt: new Date().toISOString(),
      });

      // Update in Realtime DB
      await update(ref(database, `rideRequests/${rideId}`), {
        status: "accepted",
        driverId: user?.uid,
      });

      // Update driver status
      await update(ref(database, `drivers/${user?.uid}`), {
        status: "in_ride",
        currentRide: rideId,
      });

      // Set ride status to navigate to pickup
      setRideStatus({
        phase: "navigating_to_pickup",
        currentRideId: rideId,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to accept ride");
    } finally {
      setLoading(false);
    }
  };

  const handleRideAction = async () => {
    if (!currentRideDetails || !user?.uid) return;

    setLoading(true);
    try {
      switch (rideStatus.phase) {
        case "navigating_to_pickup":
          // Driver has arrived at pickup location
          await update(ref(database, `rideRequests/${currentRideDetails.id}`), {
            status: "driver_arrived",
          });
          setRideStatus({
            ...rideStatus,
            phase: "arrived_at_pickup",
          });
          break;

        case "arrived_at_pickup":
          // Start the ride
          await update(ref(database, `rideRequests/${currentRideDetails.id}`), {
            status: "in_progress",
            rideStartedAt: Date.now(),
          });
          setRideStatus({
            ...rideStatus,
            phase: "ride_started",
          });
          break;

        case "ride_started":
          // Navigate to destination
          setRideStatus({
            ...rideStatus,
            phase: "navigating_to_destination",
          });
          break;

        case "navigating_to_destination":
          // Complete the ride
          await update(ref(database, `rideRequests/${currentRideDetails.id}`), {
            status: "completed",
            completedAt: Date.now(),
          });

          await updateDoc(doc(firestore, "rides", currentRideDetails.id), {
            status: "completed",
            completedAt: new Date().toISOString(),
          });

          // Reset driver status
          await update(ref(database, `drivers/${user.uid}`), {
            status: "available",
            currentRide: null,
          });

          // Reset ride status
          setRideStatus({ phase: "idle" });
          setCurrentRideDetails(null);

          Alert.alert("Success", "Ride completed successfully!");
          break;
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update ride status");
    } finally {
      setLoading(false);
    }
  };

  const getNavigationDestination = () => {
    if (!currentRideDetails) return null;

    switch (rideStatus.phase) {
      case "navigating_to_pickup":
      case "arrived_at_pickup":
      case "ride_started":
        return currentRideDetails.pickupLocation;
      case "navigating_to_destination":
        return currentRideDetails.destinationLocation;
      default:
        return null;
    }
  };

  const getActionButtonText = () => {
    switch (rideStatus.phase) {
      case "navigating_to_pickup":
        return "Arrived at Pickup";
      case "arrived_at_pickup":
        return "Start Ride";
      case "ride_started":
        return "Navigate to Destination";
      case "navigating_to_destination":
        return "Complete Ride";
      default:
        return "";
    }
  };

  const getStatusText = () => {
    switch (rideStatus.phase) {
      case "navigating_to_pickup":
        return "Navigating to Pickup";
      case "arrived_at_pickup":
        return "Arrived at Pickup";
      case "ride_started":
        return "Ride in Progress";
      case "navigating_to_destination":
        return "Navigating to Destination";
      default:
        return "Available";
    }
  };

  const openNavigation = async () => {
    const destination = getNavigationDestination();
    if (destination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;

      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert("Error", "Google Maps is not available");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to open navigation");
      }
    }
  };

  const getDestinationAddress = (request: RideRequest) => {
    const destKey = `${request.destinationLocation.latitude},${request.destinationLocation.longitude}`;
    return addresses[destKey] || request.destinationAddress || "Destination";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onRegionChangeComplete={setMapRegion}
      >
        {/* Driver Location */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            pinColor={colors.primary}
          />
        )}

        {/* Current Ride Markers */}
        {currentRideDetails && (
          <>
            <Marker
              coordinate={currentRideDetails.pickupLocation}
              title="Pickup Location"
              pinColor="green"
            />
            <Marker
              coordinate={currentRideDetails.destinationLocation}
              title="Destination"
              description={getDestinationAddress(currentRideDetails)}
              pinColor="red"
            />
          </>
        )}

        {/* Nearby Ride Requests (only when idle) */}
        {rideStatus.phase === "idle" &&
          rideRequests.map((request) => (
            <Marker
              key={request.id}
              coordinate={request.pickupLocation}
              title={`${request.rideType} Ride`}
              description={`${request.distance.toFixed(1)} km away`}
            >
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: colors.text,
                }}
              >
                <Text style={{ color: "white", fontSize: 16 }}>
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

        {/* Search Radius Circle (only when idle) */}
        {location && rideStatus.phase === "idle" && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={6000} // 6km in meters
            strokeColor={colors.primary + "80"}
            fillColor={colors.primary + "20"}
          />
        )}
      </MapView>

      {/* Current Ride Panel */}
      {rideStatus.phase !== "idle" && currentRideDetails && (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: colors.bg_accent,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Current Ride - {getStatusText()}
          </Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.textSecondary, marginBottom: 2 }}>
              Ride Type: {currentRideDetails.rideType.toUpperCase()}
            </Text>
            <Text style={{ color: colors.text }}>
              Destination: {getDestinationAddress(currentRideDetails)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={openNavigation}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                padding: 12,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialIcons name="navigation" size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600" }}>
                Navigate
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRideAction}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: colors.secondary,
                padding: 12,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
                flexDirection: "row",
                gap: 8,
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialIcons
                    name="directions-car"
                    size={20}
                    color="white"
                  />
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    {getActionButtonText()}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Ride Requests Panel (only when idle) */}
      {rideStatus.phase === "idle" && (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: colors.bg_accent,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              Nearby Ride Requests
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {rideRequests.length} available
            </Text>
          </View>

          {rideRequests.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <MaterialIcons
                name="search-off"
                size={40}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                No ride requests within 6km radius
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 200 }}
              showsVerticalScrollIndicator={false}
            >
              {rideRequests.map((request) => (
                <View
                  key={request.id}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    backgroundColor: colors.background,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          transform: [{ translateY: 2 }],
                        }}
                      >
                        {request.rideType === "bike"
                          ? "🚲"
                          : request.rideType === "car"
                            ? "🚗"
                            : request.rideType === "car_plus"
                              ? "🚙"
                              : "🏎️"}
                      </Text>
                      <Text style={{ color: colors.text, fontWeight: "600" }}>
                        {request.rideType === "bike"
                          ? "Bike"
                          : request.rideType === "car"
                            ? "Standard Car"
                            : request.rideType === "car_plus"
                              ? "Car Plus"
                              : "Premium"}{" "}
                        Ride
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>
                      {request.distance.toFixed(1)} km
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: colors.textSecondary,
                      marginBottom: 8,
                      fontSize: 12,
                    }}
                  >
                    To: {getDestinationAddress(request)}
                  </Text>

                  <Pressable
                    onPress={() => acceptRide(request.id)}
                    disabled={loading}
                    style={{
                      backgroundColor: colors.primary,
                      padding: 10,
                      borderRadius: 6,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <MaterialIcons
                          name="check-circle"
                          size={18}
                          color="white"
                        />
                        <Text style={{ color: "white", fontWeight: "600" }}>
                          Accept Ride
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View
            style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                backgroundColor: colors.primary,
                borderRadius: 6,
                marginRight: 8,
              }}
            />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Showing rides within 6km radius
            </Text>
          </View>
        </View>
      )}

      {/* Status Bar */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 16,
          right: 16,
          backgroundColor: colors.bg_accent,
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View>
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            Status: {getStatusText()}
          </Text>
          {updatingLocation && (
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
              Updating location...
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 8,
              height: 8,
              backgroundColor:
                rideStatus.phase === "idle" ? colors.primary : "#fbbf24",
              borderRadius: 4,
              marginRight: 4,
            }}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {rideStatus.phase === "idle" ? "Available" : "In Ride"}
          </Text>
        </View>
      </View>

      {/* Profile Button */}
      <Pressable
        onPress={() => router.push("/(driver)/profile")}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          backgroundColor: colors.bg_accent,
          padding: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <MaterialIcons name="person" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}
