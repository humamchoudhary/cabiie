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
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Geocoding from "expo-location";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { ref, onValue, off, update, get } from "firebase/database";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import { MaterialIcons, Feather, FontAwesome5 } from "@expo/vector-icons";
import { colors } from "@/utils/colors";

const { height } = Dimensions.get("window");

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
  distance?: number;
  estimatedTime?: string;
  fare?: number;
  fareCurrency?: string;
}

interface RideStatus {
  phase: "idle" | "navigating_to_pickup" | "arrived_at_pickup" | "ride_started";
  currentRideId?: string;
}

const calculateDistanceInKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
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
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [initialLoad, setInitialLoad] = useState(true);

  // Check for active ride on mount
  useEffect(() => {
    if (!user?.uid) return;

    const checkActiveRide = async () => {
      try {
        const driverRef = ref(database, `drivers/${user.uid}`);
        const driverSnapshot = await get(driverRef);
        const driverData = driverSnapshot.val();

        if (driverData?.currentRide) {
          const rideRef = ref(
            database,
            `rideRequests/${driverData.currentRide}`,
          );
          const rideSnapshot = await get(rideRef);
          const rideData = rideSnapshot.val();

          if (
            rideData &&
            rideData.status !== "completed" &&
            rideData.pickupLocation &&
            rideData.destinationLocation
          ) {
            let phase: RideStatus["phase"] = "navigating_to_pickup";
            if (rideData.status === "arrived") phase = "arrived_at_pickup";
            else if (rideData.status === "in_progress") phase = "ride_started";

            setRideStatus({ phase, currentRideId: driverData.currentRide });
            setCurrentRideDetails({ ...rideData, id: rideSnapshot.key });
          }
        }
      } catch (error) {
        console.error("Error checking active ride:", error);
      } finally {
        setInitialLoad(false);
      }
    };

    checkActiveRide();
  }, [user]);

  // Location updates
  useEffect(() => {
    if (initialLoad) return;

    let intervalId: NodeJS.Timeout;

    const updateLocation = async () => {
      setUpdatingLocation(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Location permission is needed");
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

        if (user?.uid) {
          const updates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            lastUpdated: Date.now(),
            status: rideStatus.phase === "idle" ? "available" : "in_ride",
          };

          await updateDriverStatus(user.uid, updates);
        }
      } catch (error) {
        console.error("Error updating location:", error);
      } finally {
        setUpdatingLocation(false);
      }
    };

    updateLocation();
    intervalId = setInterval(updateLocation, 15000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (user?.uid) {
        updateDriverStatus(user.uid, { status: "offline" });
      }
    };
  }, [user, rideStatus, initialLoad]);

  // Ride requests listener
  useEffect(() => {
    if (initialLoad || !location || rideStatus.phase !== "idle") return;

    const radius = 6;
    const rideRequestsRef = ref(database, "rideRequests");

    const unsubscribe = onValue(rideRequestsRef, (snapshot) => {
      const requests: RideRequest[] = [];
      snapshot.forEach((childSnapshot) => {
        const request = childSnapshot.val();
        if (request.status === "searching" && !request.driverId && location) {
          const distance = calculateDistanceInKm(
            location.coords.latitude,
            location.coords.longitude,
            request.pickupLocation.latitude,
            request.pickupLocation.longitude,
          );

          if (distance <= radius) {
            requests.push({
              ...request,
              id: childSnapshot.key,
              distance,
            });
          }
        }
      });

      setRideRequests(requests.sort((a, b) => (a.distance || 0) - (b.distance || 0)));
    });

    return () => off(rideRequestsRef);
  }, [location, rideStatus, initialLoad]);

  // Current ride listener
  useEffect(() => {
    if (!rideStatus.currentRideId) return;

    const rideRef = ref(database, `rideRequests/${rideStatus.currentRideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      if (rideData && rideData.pickupLocation && rideData.destinationLocation) {
        setCurrentRideDetails({ ...rideData, id: snapshot.key });
      }
    });

    return () => off(rideRef);
  }, [rideStatus.currentRideId]);

  const updateDriverStatus = async (driverId: string, updates: any) => {
    try {
      // Update Realtime Database
      await update(ref(database, `drivers/${driverId}`), updates);

      // Update Firestore
      const driverRef = doc(firestore, "users", driverId);
      await updateDoc(driverRef, updates);
    } catch (error) {
      console.error("Error updating driver status:", error);
    }
  };

  const acceptRide = async (rideId: string) => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      await Promise.all([
        updateRideStatus(rideId, {
          status: "accepted",
          driverId: user.uid,
        }),
        updateDriverStatus(user.uid, {
          status: "in_ride",
          currentRide: rideId,
        }),
      ]);

      setRideStatus({
        phase: "navigating_to_pickup",
        currentRideId: rideId,
      });
    } catch (error) {
      console.log(error);
      Alert.alert("Error", `Failed to accept ride: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const updateRideStatus = async (rideId: string, updates: any) => {
    try {
      // Update Realtime Database
      await update(ref(database, `rideRequests/${rideId}`), updates);

      // Update Firestore
      const rideRef = doc(firestore, "rides", rideId);
      await updateDoc(rideRef, updates);
    } catch (error) {
      console.error("Error updating ride status:", error);
    }
  };

  const handleRideAction = async () => {
    if (!currentRideDetails || !user?.uid) return;

    setLoading(true);
    try {
      switch (rideStatus.phase) {
        case "navigating_to_pickup":
          await updateRideStatus(currentRideDetails.id, {
            status: "arrived",
          });
          setRideStatus({ ...rideStatus, phase: "arrived_at_pickup" });
          break;

        case "arrived_at_pickup":
          await updateRideStatus(currentRideDetails.id, {
            status: "in_progress",
          });
          setRideStatus({ ...rideStatus, phase: "ride_started" });
          break;

        case "ride_started":
          await Promise.all([
            updateRideStatus(currentRideDetails.id, {
              status: "completed",
            }),
            updateDriverStatus(user.uid, {
              status: "available",
              currentRide: null,
            }),
          ]);
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
    if (
      !currentRideDetails ||
      !currentRideDetails.pickupLocation ||
      !currentRideDetails.destinationLocation
    ) {
      return null;
    }

    switch (rideStatus.phase) {
      case "navigating_to_pickup":
      case "arrived_at_pickup":
        return currentRideDetails.pickupLocation;
      case "ride_started":
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

  const getRideTypeIcon = (rideType: string) => {
    switch (rideType) {
      case "bike":
        return "🚲";
      case "car":
        return "🚗";
      case "car_plus":
        return "🚙";
      case "premium":
        return "🏎️";
      default:
        return "🚗";
    }
  };

  const getRideTypeName = (rideType: string) => {
    switch (rideType) {
      case "bike":
        return "Bike";
      case "car":
        return "Standard";
      case "car_plus":
        return "Comfort";
      case "premium":
        return "Premium";
      default:
        return "Standard";
    }
  };

  if (initialLoad) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center",
        backgroundColor: colors.background 
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ 
          marginTop: 16, 
          color: colors.text,
          fontSize: 16,
          fontWeight: "500"
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <MapView
        userInterfaceStyle="dark"
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onRegionChangeComplete={setMapRegion}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
          >
            <View
              style={{
                backgroundColor: colors.primary,
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: colors.background,
              }}
            >
              <MaterialIcons name="local-taxi" size={16} color={colors.background} />
            </View>
          </Marker>
        )}

        {currentRideDetails &&
          currentRideDetails.pickupLocation &&
          currentRideDetails.destinationLocation && (
            <>
              <Marker
                coordinate={currentRideDetails.pickupLocation}
                title="Pickup Location"
              >
                <View
                  style={{
                    backgroundColor: "#10B981",
                    padding: 8,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: colors.background,
                  }}
                >
                  <MaterialIcons name="person" size={16} color={colors.background} />
                </View>
              </Marker>
              <Marker
                coordinate={currentRideDetails.destinationLocation}
                title="Destination"
                description={getDestinationAddress(currentRideDetails)}
              >
                <View
                  style={{
                    backgroundColor: "#EF4444",
                    padding: 8,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: colors.background,
                  }}
                >
                  <MaterialIcons name="place" size={16} color={colors.background} />
                </View>
              </Marker>
            </>
          )}

        {rideStatus.phase === "idle" &&
          rideRequests.map((request) => (
            <Marker
              key={request.id}
              coordinate={request.pickupLocation}
              title={`${getRideTypeName(request.rideType)} Ride`}
              description={`${(request.distance || 0).toFixed(1)} km away`}
            >
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 3,
                  borderColor: colors.background,
                }}
              >
                <Text style={{ fontSize: 16 }}>
                  {getRideTypeIcon(request.rideType)}
                </Text>
              </View>
            </Marker>
          ))}

        {location && rideStatus.phase === "idle" && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={6000}
            strokeColor={colors.primary + "80"}
            fillColor={colors.primary + "20"}
          />
        )}
      </MapView>

      {/* Top Bar Container */}
      <View
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {/* Profile Button */}
        <Pressable
          onPress={() => router.push("/(driver)/profile")}
          style={{
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

        {/* Status Bar */}
        <View
          style={{
            backgroundColor: colors.bg_accent,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 20,
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
            flex: 1,
            marginLeft: 12,
            maxWidth: 250,
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
          <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
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
      </View>

      {/* Current Ride Panel */}
      {rideStatus.phase !== "idle" && currentRideDetails && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            Current Ride
          </Text>
          {/* Ride Info Card */}
          <View
            style={{
              backgroundColor: colors.bg_accent,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              marginBottom: 16 
            }}>
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: 50,
                  marginRight: 16,
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {getRideTypeIcon(currentRideDetails.rideType)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "600",
                  }}
                >
                  {getRideTypeName(currentRideDetails.rideType)} Ride
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginTop: 2,
                  }}
                >
                  {getStatusText()}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "700",
                  fontSize: 18,
                }}
              >
                PKR {currentRideDetails.fare ? Math.ceil(currentRideDetails.fare) : "--"}
              </Text>
            </View>

            {/* Trip Details */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      padding: 6,
                      borderRadius: 50,
                      marginRight: 12,
                    }}
                  >
                    <Feather name="navigation" size={12} color={colors.background} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    Distance
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {currentRideDetails.distance?.toFixed(1) || "--"} km
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      padding: 6,
                      borderRadius: 50,
                      marginRight: 12,
                    }}
                  >
                    <Feather name="clock" size={12} color={colors.background} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    Estimated Time
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {currentRideDetails.estimatedTime || "--"}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      padding: 6,
                      borderRadius: 50,
                      marginRight: 12,
                    }}
                  >
                    <Feather name="map-pin" size={12} color={colors.background} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    Destination
                  </Text>
                </View>
                <Text 
                  style={{ 
                    color: colors.text, 
                    fontWeight: "600",
                    flex: 1,
                    textAlign: "right",
                    marginLeft: 8
                  }}
                  numberOfLines={1}
                >
                  {getDestinationAddress(currentRideDetails)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={openNavigation}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialIcons name="navigation" size={20} color={colors.background} />
              <Text style={{ 
                color: colors.background, 
                fontWeight: "600",
                fontSize: 16
              }}>
                Navigate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRideAction}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: "#10B981",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
                flexDirection: "row",
                gap: 8,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={{ 
                    color: colors.background, 
                    fontWeight: "600",
                    fontSize: 16
                  }}>
                    {getActionButtonText()}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Available Rides Panel */}
      {rideStatus.phase === "idle" && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
            maxHeight: height * 0.5,
          }}
        >
          {/* Drag Handle */}
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                Ride Requests
              </Text>
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Text style={{ 
                  color: colors.background, 
                  fontWeight: "600",
                  fontSize: 12
                }}>
                  {rideRequests.length} nearby
                </Text>
              </View>
            </View>

            {rideRequests.length === 0 ? (
              <View style={{ 
                paddingVertical: 40, 
                alignItems: "center",
                marginBottom: 40
              }}>
                <View
                  style={{
                    backgroundColor: colors.bg_accent,
                    padding: 20,
                    borderRadius: 50,
                    marginBottom: 16,
                  }}
                >
                  <Feather
                    name="search"
                    size={32}
                    color={colors.textSecondary}
                  />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  No ride requests
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    textAlign: "center",
                    fontSize: 14,
                  }}
                >
                  Waiting for ride requests within 6km radius
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  style={{ maxHeight: 280 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  {rideRequests.map((request) => (
                    <View
                      key={request.id}
                      style={{
                        marginBottom: 16,
                        backgroundColor: colors.bg_accent,
                        borderRadius: 16,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      {/* Ride Header */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 16,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            padding: 12,
                            borderRadius: 50,
                            marginRight: 16,
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>
                            {getRideTypeIcon(request.rideType)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "600",
                              fontSize: 16,
                            }}
                          >
                            {getRideTypeName(request.rideType)} Ride
                          </Text>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 14,
                              marginTop: 2,
                            }}
                          >
                            {(request.distance || 0).toFixed(1)} km away
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: colors.primary,
                            fontWeight: "700",
                            fontSize: 16,
                          }}
                        >
                          PKR {request.fare ? Math.ceil(request.fare) : "--"}
                        </Text>
                      </View>

                      {/* Trip Details */}
                      <View style={{ gap: 8, marginBottom: 16 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                              style={{
                                backgroundColor: colors.primary,
                                padding: 4,
                                borderRadius: 50,
                                marginRight: 8,
                              }}
                            >
                              <Feather name="clock" size={10} color={colors.background} />
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                              Est. Time
                            </Text>
                          </View>
                          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                            {request.estimatedTime || "--"}
                          </Text>
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                              style={{
                                backgroundColor: colors.primary,
                                padding: 4,
                                borderRadius: 50,
                                marginRight: 8,
                              }}
                            >
                              <Feather name="map-pin" size={10} color={colors.background} />
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                              Destination
                            </Text>
                          </View>
                          <Text 
                            style={{ 
                              color: colors.text, 
                              fontWeight: "600", 
                              fontSize: 12,
                              flex: 1,
                              textAlign: "right",
                              marginLeft: 8
                            }}
                            numberOfLines={1}
                          >
                            {getDestinationAddress(request)}
                          </Text>
                        </View>
                      </View>

                      {/* Accept Button */}
                      <TouchableOpacity
                        onPress={() => acceptRide(request.id)}
                        disabled={loading}
                        style={{
                          backgroundColor: colors.primary,
                          padding: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 8,
                          opacity: loading ? 0.7 : 1,
                        }}
                      >
                        {loading ? (
                          <ActivityIndicator color={colors.background} />
                        ) : (
                          <>
                            <MaterialIcons
                              name="check-circle"
                              size={20}
                              color={colors.background}
                            />
                            <Text style={{ 
                              color: colors.background, 
                              fontWeight: "600",
                              fontSize: 16
                            }}>
                              Accept Ride
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                {/* Radius Indicator */}
                <View
                  style={{ 
                    marginTop: 8, 
                    flexDirection: "row", 
                    alignItems: "center",
                    justifyContent: "center",
                    paddingBottom: 20
                  }}
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
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}