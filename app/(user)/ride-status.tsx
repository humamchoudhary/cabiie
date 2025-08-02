// app/(user)/ride-status.tsx

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
  const slideAnim = useRef(new Animated.Value(height * 0.4)).current;

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

        console.log("Location fetched:", location); // Add this for debugging

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

  // Ride snapshot listener
  useEffect(() => {
    if (!rideId) return;

    const unsubscribeRide = onSnapshot(
      doc(firestore, "rides", rideId as string),
      (d) => {
        const rideData = d.data();
        setRide(rideData);

        // Auto-navigate when ride is completed
        if (rideData?.status === "completed") {
          setTimeout(() => {
            router.replace("/(user)/home");
          }, 3000);
        }
      },
    );

    return () => {
      unsubscribeRide();
    };
  }, [rideId]);

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
        edgePadding: { top: 100, right: 50, bottom: 450, left: 50 },
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
      toValue: panelExpanded ? height * 0.4 : height * 0.7,
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
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        customMapStyle={[]}
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

      {/* Top Header with Trip Title */}
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
          Ongoing Trip
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
          {/* Driver Card */}
          {driver && (
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
                    {driver.name?.charAt(0).toUpperCase()}
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
                    {driver.name}
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
                      {driver.rating || "5.0"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={callDriver}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 50,
                    marginRight: 8,
                  }}
                >
                  <Feather name="phone" size={20} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={shareDriverDetails}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 50,
                  }}
                >
                  <Feather name="share-2" size={20} color={colors.background} />
                </TouchableOpacity>
              </View>

              {/* Vehicle Info */}
              {driver.vehicleInfo && (
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: colors.text,
                        marginBottom: 4,
                      }}
                    >
                      {driver.vehicleInfo.make} {driver.vehicleInfo.model}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: colors.text,
                        letterSpacing: 1,
                      }}
                    >
                      {driver.vehicleInfo.licensePlate}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.secondary,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.primary,
                      }}
                    >
                      {ride?.rideType?.toUpperCase() || "CAR"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Trip Stats */}
          {(distance || estimatedTime) && (
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
              {distance && (
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
                    {distance}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Distance
                  </Text>
                </View>
              )}
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
                  ${ride?.fare || "10.50"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Fare</Text>
              </View>
            </View>
          )}

          {/* Route Details */}
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
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Feather name="map-pin" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                }}
              >
                Journey Hill, United States
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="navigation" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {ride?.destinationAddress || "Way, Regina SK S4S, United States"}
              </Text>
            </View>
          </View>

          {/* Support & Cancel Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 40 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.bg_accent,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={callEmergency}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                Support
              </Text>
            </TouchableOpacity>
            {ride?.status === "accepted" && (
              <TouchableOpacity
                onPress={cancelRide}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.background,
                    }}
                  >
                    Cancel Trip
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}