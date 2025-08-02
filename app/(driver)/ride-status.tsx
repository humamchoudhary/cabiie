import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "@/context/AuthContext";
import { MaterialIcons, Feather, AntDesign, Ionicons } from "@expo/vector-icons";
import { colors } from "@/utils/colors";

const { height, width } = Dimensions.get("window");

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
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const router = useRouter();
  const { user } = useAuth();
  const [hasReachedPickup, setHasReachedPickup] = useState(false);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [rideUser, setRideUser] = useState<any>(null);

  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(height * 0.4)).current;

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

  const getRoute = async (from: any, to: any) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&key=${apiKey}`,
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        setEstimatedTime(leg.duration.text);

        // Decode polyline for route display
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
      }
    } catch (error) {
      console.error("Error getting route:", error);
    }
  };

  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return poly;
  };

  const expandPanel = () => {
    setPanelExpanded(!panelExpanded);
    Animated.spring(slideAnim, {
      toValue: panelExpanded ? height * 0.4 : height * 0.7,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
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

  // Get ride user info
  useEffect(() => {
    if (!ride?.userId) return;

    const getRideUser = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", ride.userId));
        setRideUser(userDoc.data());
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    getRideUser();
  }, [ride?.userId]);

  // Get route when locations are available
  useEffect(() => {
    if (currentLocation && ride?.pickupLocation && rideStage === 'pending') {
      getRoute(currentLocation.coords, ride.pickupLocation);
    } else if (currentLocation && ride?.destinationLocation && rideStage === 'started') {
      getRoute(currentLocation.coords, ride.destinationLocation);
    }
  }, [currentLocation, ride, rideStage]);

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

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current && ride?.pickupLocation && currentLocation) {
      const coordinates = [
        {
          latitude: ride.pickupLocation.latitude,
          longitude: ride.pickupLocation.longitude,
        },
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
      ];

      if (ride?.destinationLocation) {
        coordinates.push({
          latitude: ride.destinationLocation.latitude,
          longitude: ride.destinationLocation.longitude,
        });
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 450, left: 50 },
        animated: true,
      });
    }
  }, [ride, currentLocation]);

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

  const getStatusMessage = () => {
    if (rideStage === 'pending') return 'Ready to pick up rider';
    if (rideStage === 'started') return 'Heading to destination';
    if (rideStage === 'completed') return 'Ride completed successfully!';
    return 'Processing...';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
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
            <View
              style={{
                backgroundColor: colors.primary,
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: colors.background,
              }}
            >
              <Ionicons name="person" size={16} color={colors.background} />
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
            <View
              style={{
                backgroundColor: colors.primary,
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: colors.background,
              }}
            >
              <MaterialIcons name="place" size={16} color={colors.background} />
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
            <View
              style={{
                backgroundColor: colors.background,
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: colors.primary,
              }}
            >
              <Text style={{ fontSize: 16 }}>
                {ride?.rideType === "bike" ? "🚲" : "🚗"}
              </Text>
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Top Header */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          right: 20,
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 16,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
          }}
        >
          {ride?.rideType === "bike"
            ? "Bike"
            : ride?.rideType === "car"
              ? "Standard Car"
              : ride?.rideType === "car_plus"
                ? "Car Plus"
                : "Premium"}{" "}
          Ride - {getStatusMessage()}
        </Text>
      </View>

      {/* Bottom Panel */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: slideAnim,
          backgroundColor: colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        {/* Drag Handle */}
        <TouchableOpacity
          onPress={expandPanel}
          style={{ alignItems: "center", paddingVertical: 12 }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
            }}
          />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, paddingHorizontal: 20 }}
        >
          {/* Progress Bar */}
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
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Trip Progress
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: colors.border,
                borderRadius: 3,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  height: "100%",
                  backgroundColor: colors.primary,
                  borderRadius: 3,
                  width: `${getRideProgress()}%`,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {getRideProgress().toFixed(0)}% completed
            </Text>
          </View>

          {/* Rider Card */}
          {rideUser && (
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "600",
                      color: colors.background,
                    }}
                  >
                    {rideUser.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {rideUser.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <AntDesign name="star" size={16} color="#FCD34D" />
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                        marginLeft: 4,
                      }}
                    >
                      {rideUser.rating || "5.0"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${rideUser.phone || ""}`)}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 50,
                  }}
                >
                  <Feather name="phone" size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trip Stats */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.bg_accent,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 8,
                  borderRadius: 50,
                  marginBottom: 8,
                }}
              >
                <Feather name="navigation" size={16} color={colors.background} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {rideDistance ? rideDistance.toFixed(1) + " km" : "0.0 km"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Distance
              </Text>
            </View>
            {estimatedTime && (
              <View style={{ flex: 1, alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 50,
                    marginBottom: 8,
                  }}
                >
                  <Feather name="clock" size={16} color={colors.background} />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {estimatedTime}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>ETA</Text>
              </View>
            )}
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: colors.primary,
                  padding: 8,
                  borderRadius: 50,
                  marginBottom: 8,
                }}
              >
                <Feather name="dollar-sign" size={16} color={colors.background} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                ${calculateEarnings()}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Earnings</Text>
            </View>
          </View>

          {/* Navigation & Call Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => {
                const targetLocation = rideStage === 'pending' 
                  ? ride?.pickupLocation 
                  : ride?.destinationLocation;
                if (targetLocation) {
                  openNavigation(targetLocation.latitude, targetLocation.longitude);
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.bg_accent,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="navigation" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                }}
              >
                Navigate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${rideUser?.phone || ""}`)}
              style={{
                flex: 1,
                backgroundColor: colors.bg_accent,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="phone" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                }}
              >
                Call Rider
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          {rideStage === 'completed' ? (
            <View
              style={{
                backgroundColor: colors.bg_accent,
                borderRadius: 16,
                padding: 20,
                marginBottom: 40,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                Ride Completed!
              </Text>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: colors.primary,
                  marginBottom: 16,
                }}
              >
                Earnings: ${calculateEarnings()}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace("/(driver)/home")}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  borderRadius: 12,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.background,
                  }}
                >
                  Return to Home
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 40 }}>
              <TouchableOpacity
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
                style={{
                  flex: 1,
                  backgroundColor: colors.bg_accent,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Cancel Ride
                </Text>
              </TouchableOpacity>

              {rideStage === 'pending' && hasReachedPickup && (
                <TouchableOpacity
                  onPress={startRide}
                  disabled={!hasReachedPickup}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.background,
                    }}
                  >
                    Start Ride
                  </Text>
                </TouchableOpacity>
              )}

              {rideStage === 'started' && hasReachedDestination && (
                <TouchableOpacity
                  onPress={completeRide}
                  disabled={!hasReachedDestination}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.background,
                    }}
                  >
                    Complete Ride
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Ride Details Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={{ flex: 1, justifyContent: "end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{
              backgroundColor: colors.background,
              padding: 24,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
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
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                Ride Details
              </Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {ride && (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    Ride Type:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                      textTransform: "capitalize",
                    }}
                  >
                    {ride.rideType} Ride
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    Status:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                      textTransform: "capitalize",
                    }}
                  >
                    {rideStage === 'pending' ? 'Ready to Start' : 
                     rideStage === 'started' ? 'In Progress' : 'Completed'}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    Requested At:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {new Date(ride.createdAt).toLocaleTimeString()}
                  </Text>
                </View>

                {rideDistance && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                      Distance:
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {rideDistance.toFixed(1)} km
                    </Text>
                  </View>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    Estimated Earnings:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.primary,
                    }}
                  >
                    ${calculateEarnings()}
                  </Text>
                </View>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 16,
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    Pricing Breakdown:
                  </Text>
                  <View style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                        Base Fare:
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.text }}>
                        ${PRICING.baseFare.toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                        Distance Fare:
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.text }}>
                        {rideDistance?.toFixed(1)} km × $
                        {PRICING.perKm[
                          ride.rideType as keyof typeof PRICING.perKm
                        ].toFixed(2)}
                      </Text>
                    </View>
                    {parseFloat(calculateEarnings()) === PRICING.minFare && (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                          Minimum Fare:
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.text }}>
                          ${PRICING.minFare.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setShowDetails(false)}
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                marginTop: 24,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.background,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}