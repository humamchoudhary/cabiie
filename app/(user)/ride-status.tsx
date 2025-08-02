// app/(user)/ride-status/index.tsx

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";

import * as Location from "expo-location";
import { firestore } from "@/config/firebase";
import { ref, onValue } from "firebase/database";
import { database } from "@/config/firebase";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { colors } from "@/utils/colors";
import {
  AntDesign,
  MaterialIcons,
  Ionicons,
  Feather,
} from "@expo/vector-icons";
import RatingModal from "@/components/RatingModal"; // Adjust path as needed
const { height, width } = Dimensions.get("window");

export default function RideStatusScreen() {
  const { rideId } = useLocalSearchParams();

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [rideStatusMessage, setRideStatusMessage] = useState(
    "Waiting for driver to accept...",
  );
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [distance, setDistance] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);

  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(height * 0.3)).current;

  useEffect(() => {
    let isMounted = true; // Add mounted check to prevent state updates on unmounted component

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission denied",
            "We need location permission to find rides",
          );
          return;
        }

        // Enable high accuracy
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setLocation(location);
        }
      } catch (error) {
        console.error("Error getting location:", error);
        if (isMounted) {
          Alert.alert(
            "Location Error",
            "Could not get your current location. Please try again.",
          );
        }
      }
    })();

    return () => {
      isMounted = false; // Cleanup
    };
  }, []);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completedRideData, setCompletedRideData] = useState(null);
  // Ride snapshot listener
  useEffect(() => {
    if (!rideId) return;

    const unsubscribeRide = onSnapshot(
      doc(firestore, "rides", rideId as string),
      async (d) => {
        const rideData = d.data();
        setRide(rideData);

        // Handle completed ride
        if (rideData?.status === "completed" && !rideData.rated) {
          console.log("Ride completed, showing rating modal");
          setCompletedRideData(rideData);
          setShowRatingModal(true);
        }
      },
    );

    return () => {
      unsubscribeRide();
    };
  }, [rideId]);

  const handleRatingSubmit = async (rating: number) => {
    if (!completedRideData || !rideId) return;

    try {
      console.log("Submitting rating:", rating);

      // Update ride with rating and mark as rated
      await updateDoc(doc(firestore, "rides", rideId as string), {
        rating,
        rated: true,
      });

      // Add rating to driver's document
      const driverRef = doc(firestore, "users", completedRideData.driverId);
      const driverDoc = await getDoc(driverRef);

      if (driverDoc.exists()) {
        const driverData = driverDoc.data();
        const currentRatings = driverData.ratings || [];
        const newRatings = [...currentRatings, rating];

        await updateDoc(driverRef, {
          ratings: newRatings,
          rating: calculateAverageRating(newRatings),
        });
      }

      // Close modal and navigate
      setShowRatingModal(false);
      setCompletedRideData(null);
    } catch (error) {
      console.error("Error saving rating:", error);
      Alert.alert("Error", "Failed to save rating. Please try again.");
    }
  };

  const handleRatingClose = () => {
    setShowRatingModal(false);
    setCompletedRideData(null);

    // Navigate back to home even if user skips rating
    setTimeout(() => {
      router.replace("/(user)/home");
    }, 1000);
  };

  const calculateAverageRating = (ratings: number[]) => {
    if (ratings.length === 0) return 5.0; // Default rating
    const sum = ratings.reduce((a, b) => a + b, 0);
    return parseFloat((sum / ratings.length).toFixed(1));
  };

  // Get driver info + live location
  useEffect(() => {
    if (!ride?.driverId) return;

    const getDriver = async () => {
      try {
        const driverDoc = await getDoc(doc(firestore, "users", ride.driverId));
        setDriver(driverDoc.data());
      } catch (error) {
        console.error("Error fetching driver:", error);
      }
    };

    const driverLocationUnsubscribe = onValue(
      ref(database, `drivers/${ride.driverId}`),
      (snapshot) => {
        const locationData = snapshot.val();
        setDriverLocation(locationData);

        // Get route when driver location updates
        if (locationData && ride?.pickupLocation) {
          getRoute(locationData, ride.pickupLocation);
        }
      },
    );

    getDriver();

    return () => {
      driverLocationUnsubscribe();
    };
  }, [ride?.driverId]);

  // Status message and UI updates
  useEffect(() => {
    if (!ride) return;

    switch (ride.status) {
      case "accepted":
        setRideStatusMessage("Driver is on the way to pick you up");
        break;
      case "arrived":
        setRideStatusMessage("Driver has arrived at pickup location");
        break;
      case "in_progress":
        setRideStatusMessage("Ride in progress - heading to your destination");
        break;
      case "completed":
        setRideStatusMessage("Ride completed successfully!");
        break;
      case "cancelled":
        setRideStatusMessage("Ride was cancelled");
        break;
      default:
        setRideStatusMessage("Waiting for driver to accept...");
    }
  }, [ride?.status]);

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current && ride?.pickupLocation && driverLocation) {
      const coordinates = [
        {
          latitude: ride.pickupLocation.latitude,
          longitude: ride.pickupLocation.longitude,
        },
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
      ];

      if (ride?.destinationLocation) {
        coordinates.push({
          latitude: ride.destinationLocation.latitude,
          longitude: ride.destinationLocation.longitude,
        });
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
        animated: true,
      });
    }
  }, [ride, driverLocation]);

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

        setDistance(leg.distance.text);
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

  const calculateDistance = (
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

  const expandPanel = () => {
    setPanelExpanded(!panelExpanded);
    Animated.spring(slideAnim, {
      toValue: panelExpanded ? height * 0.3 : height * 0.15,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const callDriver = () => {
    if (driver?.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    } else {
      Alert.alert("Error", "Driver phone number not available");
    }
  };

  const cancelRide = async () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await updateDoc(doc(firestore, "rides", rideId as string), {
              status: "cancelled",
              cancelledAt: new Date().toISOString(),
            });
            router.replace("/(user)/home");
          } catch (error) {
            Alert.alert("Error", "Failed to cancel ride");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const getStatusColor = () => {
    switch (ride?.status) {
      case "accepted":
        return colors.primary;
      case "arrived":
        return "#10b981";
      case "in_progress":
        return "#f59e0b";
      case "completed":
        return "#22c55e";
      case "cancelled":
        return "#ef4444";
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = () => {
    switch (ride?.status) {
      case "accepted":
        return "car";
      case "arrived":
        return "location";
      case "in_progress":
        return "navigate";
      case "completed":
        return "checkmark-circle";
      case "cancelled":
        return "close-circle";
      default:
        return "time";
    }
  };

  const callEmergency = () => {
    Linking.openURL(`tel:15`);
  };

  const shareDriverDetails = () => {
    if (!driver) return;

    const driverDetails = `
🚖 *Driver Details* 🚖
  
*Name:* ${driver.name}
*Phone:* ${driver.phone}
*Vehicle:* ${driver.vehicleInfo?.make || ""} ${driver.vehicleInfo?.model || ""}
*License Plate:* ${driver.vehicleInfo?.licensePlate || ""}
*Rating:* ${driver.rating || "5.0"} ⭐
  
*CNIC:* ${driver.cnic || "Not available"}
*License Number:* ${driver.licenseNumber || "Not available"}
  
I'm currently using this ride service and want to share these details for safety purposes.
  `.trim();

    const url = `https://wa.me/?text=${encodeURIComponent(driverDetails)}`;

    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        userInterfaceStyle="dark"
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
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

        {/* Destination Location */}
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
                backgroundColor: "#ef4444",
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: colors.background,
              }}
            >
              <MaterialIcons name="place" size={16} color="white" />
            </View>
          </Marker>
        )}

        {/* Driver Location */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title="Your Driver"
            rotation={driverLocation.heading || 0}
          >
            <View
              style={{
                backgroundColor: colors.text,
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
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      <TouchableOpacity
        style={{
          position: "absolute",
          top: 80,
          right: 16,
          backgroundColor: colors.bg_accent,
          padding: 12,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={() => {
          if (location && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }
        }}
      >
        <MaterialIcons name="my-location" size={20} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          position: "absolute",
          top: 140,
          right: 16,
          backgroundColor: "#ef4444",
          padding: 12,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={callEmergency}
      >
        <MaterialIcons name="emergency" size={20} color={colors.background} />
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          position: "absolute",
          top: 200,
          right: 16,
          backgroundColor: "#25D366",
          padding: 12,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={shareDriverDetails}
      >
        <Ionicons name="logo-whatsapp" size={20} color={colors.background} />
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity
        style={{
          position: "absolute",
          top: 20,
          left: 16,
          backgroundColor: colors.bg_accent,
          padding: 12,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={() => router.back()}
      >
        <AntDesign name="arrowleft" size={20} color={colors.text} />
      </TouchableOpacity>

      {/* Refresh Location Button */}
      <TouchableOpacity
        style={{
          position: "absolute",
          top: 20,
          right: 16,
          backgroundColor: colors.bg_accent,
          padding: 12,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={() => {
          if (mapRef.current && ride?.pickupLocation && driverLocation) {
            const coordinates = [
              {
                latitude: ride.pickupLocation.latitude,
                longitude: ride.pickupLocation.longitude,
              },
              {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              },
            ];
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
              animated: true,
            });
          }
        }}
      >
        <MaterialIcons name="refresh" size={20} color={colors.primary} />
      </TouchableOpacity>

      {/* Bottom Panel */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: slideAnim,
          backgroundColor: colors.bg_accent,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          borderBottomWidth: 0,
          paddingTop: 8,
        }}
      >
        {/* Drag Handle */}
        <TouchableOpacity
          onPress={expandPanel}
          style={{ alignItems: "center", paddingVertical: 8 }}
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
          style={{ flex: 1, padding: 16 }}
        >
          {/* Status Header */}
          <View style={{ marginBottom: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={getStatusIcon() as any}
                size={24}
                color={getStatusColor()}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {ride?.rideType?.charAt(0).toUpperCase() +
                  ride?.rideType?.slice(1)}{" "}
                Ride
              </Text>
              <View
                style={{
                  backgroundColor: getStatusColor() + "20",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: getStatusColor(),
                    fontSize: 12,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {ride?.status?.replace("_", " ")}
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {rideStatusMessage}
            </Text>
          </View>

          {/* Trip Info */}
          {(distance || estimatedTime) && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {distance && (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Feather name="navigation" size={20} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "600",
                      marginTop: 4,
                    }}
                  >
                    {distance}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Distance
                  </Text>
                </View>
              )}
              {estimatedTime && (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Feather name="clock" size={20} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "600",
                      marginTop: 4,
                    }}
                  >
                    {estimatedTime}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    ETA
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Driver Details */}
          {driver && (
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: colors.primary + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: "600" }}>
                    {driver.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {driver.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 2,
                    }}
                  >
                    <AntDesign name="star" size={14} color="#fbbf24" />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                        marginLeft: 4,
                      }}
                    >
                      {driver.rating || "5.0"} •{" "}
                      {driver.totalRides || driver.ratings.length || 0} rides
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={callDriver}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 25,
                  }}
                >
                  <Feather name="phone" size={18} color={colors.background} />
                </TouchableOpacity>
              </View>

              {/* Vehicle Info */}
              {driver.vehicleInfo && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Vehicle
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>
                      {driver.vehicleInfo.make} {driver.vehicleInfo.model}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      License Plate
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>
                      {driver.vehicleInfo.licensePlate}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Route Details */}
          {ride?.destinationAddress && (
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 12,
                }}
              >
                Trip Details
              </Text>
              <View style={{ gap: 12 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start" }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.primary,
                      marginRight: 12,
                      marginTop: 4,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Pickup
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      Current Location
                    </Text>
                  </View>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start" }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      backgroundColor: "#ef4444",
                      marginRight: 12,
                      marginTop: 4,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Destination
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {ride.destinationAddress}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            {ride?.status === "accepted" && (
              <Pressable
                onPress={cancelRide}
                disabled={loading}
                style={{
                  backgroundColor: "#ef4444",
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Feather
                      name="x"
                      size={16}
                      color={colors.background}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: colors.background,
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Cancel Ride
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {ride?.status === "completed" && (
              <Pressable
                onPress={() => router.replace("/(user)/home")}
                style={{
                  backgroundColor: colors.primary,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="home"
                  size={16}
                  color={colors.background}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    color: colors.background,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Book Another Ride
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <RatingModal
        visible={showRatingModal}
        onClose={handleRatingClose}
        onSubmit={handleRatingSubmit}
        driverName={completedRideData?.driverName || "your driver"}
      />
    </View>
  );
}
