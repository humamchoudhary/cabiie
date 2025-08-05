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
import {
  MaterialIcons,
  Feather,
  FontAwesome5,
  Ionicons,
} from "@expo/vector-icons";
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
  const [riderDetails, setRiderDetails] = useState();
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

  const [userData, setUserData] = useState();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;

      try {
        const docRef = doc(firestore, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user?.uid]);

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

    let intervalId;

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
        if (
          request.status === "searching" &&
          !request.driverId &&
          location &&
          userData &&
          request.rideType == userData.vehicleInfo.type
        ) {
          console.log(userData.vehicleInfo);
          console.log(request.rideType);
          const distance = calculateDistanceInKm(
            location.coords.latitude,
            location.coords.longitude,
            request.pickupLocation.latitude,
            request.pickupLocation.longitude,
          );
          console.log(distance);
          console.log(location.coords.latitude, location.coords.longitude);
          if (distance <= radius) {
            requests.push({
              ...request,
              id: childSnapshot.key,
              distance,
            });
          }
        }
      });

      setRideRequests(
        requests.sort((a, b) => (a.distance || 0) - (b.distance || 0)),
      );
    });

    return () => off(rideRequestsRef);
  }, [location, rideStatus, initialLoad]);

  // Add this useEffect hook to fetch rider details when currentRideDetails changes
  useEffect(() => {
    const fetchRiderDetails = async () => {
      if (!currentRideDetails?.userId) {
        setRiderDetails(undefined);
        return;
      }

      try {
        const riderRef = doc(firestore, "users", currentRideDetails.userId);
        const riderSnap = await getDoc(riderRef);

        if (riderSnap.exists()) {
          setRiderDetails(riderSnap.data());
        } else {
          setRiderDetails(undefined);
        }
      } catch (error) {
        console.error("Error fetching rider details:", error);
        setRiderDetails(undefined);
      }
    };

    fetchRiderDetails();
  }, [currentRideDetails?.userId]);
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
        return { name: "bicycle", library: "MaterialIcons", size: 18 };
      case "car":
        return { name: "directions-car", library: "MaterialIcons", size: 18 };
      case "car_plus":
        return { name: "car-sport", library: "Ionicons", size: 18 };
      case "premium":
        return { name: "car-luxury", library: "MaterialIcons", size: 18 };
      default:
        return { name: "directions-car", library: "MaterialIcons", size: 18 };
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

  const renderVehicleIcon = (
    rideType: string,
    size: number = 18,
    color: string = colors.background,
  ) => {
    const iconData = getRideTypeIcon(rideType);

    switch (iconData.library) {
      case "MaterialIcons":
        return (
          <MaterialIcons
            name={iconData.name as any}
            size={size}
            color={color}
          />
        );
      case "Ionicons":
        return (
          <Ionicons name={iconData.name as any} size={size} color={color} />
        );
      default:
        return (
          <MaterialIcons name="directions-car" size={size} color={color} />
        );
    }
  };

  if (initialLoad) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{
            marginTop: 16,
            color: colors.text,
            fontSize: 16,
            fontWeight: "500",
          }}
        >
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
                padding: 10,
                borderRadius: 22,
                borderWidth: 3,
                borderColor: colors.background,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <MaterialIcons
                name="local-taxi"
                size={18}
                color={colors.background}
              />
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
                    padding: 10,
                    borderRadius: 22,
                    borderWidth: 3,
                    borderColor: colors.background,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <MaterialIcons
                    name="person-pin-circle"
                    size={18}
                    color={colors.background}
                  />
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
                    padding: 10,
                    borderRadius: 22,
                    borderWidth: 3,
                    borderColor: colors.background,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <MaterialIcons
                    name="place"
                    size={18}
                    color={colors.background}
                  />
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
                  padding: 10,
                  borderRadius: 22,
                  borderWidth: 3,
                  borderColor: colors.background,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                {renderVehicleIcon(request.rideType, 18, colors.background)}
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
            strokeColor={colors.primary + "40"}
            fillColor={colors.primary + "15"}
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Top Bar Container */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          right: 20,
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
            padding: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <MaterialIcons name="person" size={24} color={colors.primary} />
        </Pressable>

        {/* Status Bar */}
        <View
          style={{
            backgroundColor: colors.bg_accent,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
            flex: 1,
            marginLeft: 16,
            maxWidth: 260,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}
            >
              {getStatusText()}
            </Text>
            {updatingLocation && (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                Updating location...
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: 12,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                backgroundColor:
                  rideStatus.phase === "idle" ? "#10B981" : "#F59E0B",
                borderRadius: 5,
                marginRight: 6,
                shadowColor:
                  rideStatus.phase === "idle" ? "#10B981" : "#F59E0B",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 4,
                elevation: 2,
              }}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              {rideStatus.phase === "idle" ? "Online" : "Busy"}
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
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 12,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 44,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <View
              style={{
                backgroundColor: colors.primary + "20",
                padding: 8,
                borderRadius: 12,
                marginRight: 12,
              }}
            >
              <MaterialIcons
                name="directions"
                size={20}
                color={colors.primary}
              />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 22,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Current Ride
            </Text>
            <View
              style={{
                backgroundColor: colors.primary + "15",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                Active
              </Text>
            </View>
          </View>

          {/* Ride Info Card */}
          <View
            style={{
              backgroundColor: colors.bg_accent,
              borderRadius: 20,
              padding: 24,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 16,
                  borderRadius: 20,
                  marginRight: 16,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                {renderVehicleIcon(
                  currentRideDetails.rideType,
                  24,
                  colors.background,
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "700",
                  }}
                >
                  {getRideTypeName(currentRideDetails.rideType)} Ride
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginTop: 2,
                    fontWeight: "500",
                  }}
                >
                  {getStatusText()}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "800",
                    fontSize: 20,
                  }}
                >
                  PKR{" "}
                  {currentRideDetails.fare
                    ? Math.ceil(currentRideDetails.fare)
                    : "--"}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: "500",
                  }}
                >
                  Total fare
                </Text>
              </View>
            </View>

            {/* Trip Details */}
            <View style={{ gap: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary + "15",
                      padding: 8,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                  >
                    <Feather
                      name="navigation"
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Passenger
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {riderDetails?.name || "--"}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary + "15",
                      padding: 8,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                  >
                    <Feather
                      name="navigation"
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Distance
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {currentRideDetails.distance?.toFixed(1) || "--"} km
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary + "15",
                      padding: 8,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                  >
                    <Feather name="clock" size={14} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Estimated Time
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {currentRideDetails.estimatedTime || "--"}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: colors.primary + "15",
                      padding: 8,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                  >
                    <Feather name="map-pin" size={14} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Destination
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    flex: 1,
                    textAlign: "right",
                    marginLeft: 12,
                    fontSize: 15,
                  }}
                  numberOfLines={1}
                >
                  {getDestinationAddress(currentRideDetails)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 16 }}>
            {/* First row with Navigate and Action buttons */}
            <View style={{ flexDirection: "row", gap: 16 }}>
              <TouchableOpacity
                onPress={openNavigation}
                style={{
                  flex: 1,
                  backgroundColor: colors.secondary,
                  padding: 18,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 10,
                  shadowColor: colors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <MaterialIcons
                  name="navigation"
                  size={22}
                  color={colors.background}
                />
                <Text
                  style={{
                    color: colors.background,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  Navigate
                </Text>
              </TouchableOpacity>

              {/* Second row with Call button */}
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(`tel:${riderDetails?.phone}`);
                }}
                style={{
                  backgroundColor: colors.secondary,
                  padding: 18,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 10,
                  shadowColor: colors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <MaterialIcons
                  name="phone"
                  size={22}
                  color={colors.background}
                />
                <Text
                  style={{
                    color: colors.background,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  Call Passenger
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleRideAction}
              disabled={loading}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 18,
                paddingVertical: 19,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
                flexDirection: "row",
                gap: 10,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={colors.background}
                  />
                  <Text
                    style={{
                      color: colors.background,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
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
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 12,
            maxHeight: height * 0.6,
          }}
        >
          {/* Drag Handle */}
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <View
              style={{
                width: 48,
                height: 5,
                backgroundColor: colors.border,
                borderRadius: 3,
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 24 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary + "20",
                    padding: 8,
                    borderRadius: 12,
                    marginRight: 12,
                  }}
                >
                  <MaterialIcons
                    name="request-quote"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 22,
                    fontWeight: "700",
                  }}
                >
                  Ride Requests
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.background,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {rideRequests.length} nearby
                </Text>
              </View>
            </View>

            {rideRequests.length === 0 ? (
              <View
                style={{
                  paddingVertical: 48,
                  alignItems: "center",
                  marginBottom: 48,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.bg_accent,
                    padding: 24,
                    borderRadius: 24,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Feather
                    name="search"
                    size={36}
                    color={colors.textSecondary}
                  />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  No ride requests
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    textAlign: "center",
                    fontSize: 15,
                    lineHeight: 22,
                    maxWidth: 280,
                  }}
                >
                  We're scanning for ride requests within your 6km radius. New
                  requests will appear here automatically.
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  style={{ maxHeight: 320 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                >
                  {rideRequests.map((request, index) => (
                    <View
                      key={request.id}
                      style={{
                        marginBottom: 20,
                        backgroundColor: colors.bg_accent,
                        borderRadius: 20,
                        padding: 24,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                    >
                      {/* Ride Header */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 20,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            padding: 16,
                            borderRadius: 20,
                            marginRight: 16,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                          }}
                        >
                          {renderVehicleIcon(
                            request.rideType,
                            22,
                            colors.background,
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "700",
                              fontSize: 17,
                            }}
                          >
                            {getRideTypeName(request.rideType)} Ride
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 4,
                            }}
                          >
                            <MaterialIcons
                              name="location-on"
                              size={14}
                              color={colors.textSecondary}
                            />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginLeft: 4,
                                fontWeight: "500",
                              }}
                            >
                              {(request.distance || 0).toFixed(1)} km away
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{
                              color: colors.primary,
                              fontWeight: "800",
                              fontSize: 18,
                            }}
                          >
                            PKR {request.fare ? Math.ceil(request.fare) : "--"}
                          </Text>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            Estimated
                          </Text>
                        </View>
                      </View>

                      {/* Trip Details */}
                      <View style={{ gap: 12, marginBottom: 20 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: colors.primary + "15",
                                padding: 6,
                                borderRadius: 10,
                                marginRight: 10,
                              }}
                            >
                              <Feather
                                name="clock"
                                size={12}
                                color={colors.primary}
                              />
                            </View>
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 13,
                                fontWeight: "500",
                              }}
                            >
                              Est. Time
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {request.estimatedTime || "--"}
                          </Text>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: colors.primary + "15",
                                padding: 6,
                                borderRadius: 10,
                                marginRight: 10,
                              }}
                            >
                              <Feather
                                name="map-pin"
                                size={12}
                                color={colors.primary}
                              />
                            </View>
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 13,
                                fontWeight: "500",
                              }}
                            >
                              Destination
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "600",
                              fontSize: 13,
                              flex: 1,
                              textAlign: "right",
                              marginLeft: 12,
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
                          padding: 16,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 10,
                          opacity: loading ? 0.7 : 1,
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 6,
                        }}
                      >
                        {loading ? (
                          <ActivityIndicator
                            color={colors.background}
                            size="small"
                          />
                        ) : (
                          <>
                            <MaterialIcons
                              name="check-circle"
                              size={20}
                              color={colors.background}
                            />
                            <Text
                              style={{
                                color: colors.background,
                                fontWeight: "700",
                                fontSize: 16,
                              }}
                            >
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
                    paddingBottom: 24,
                    paddingTop: 8,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
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
