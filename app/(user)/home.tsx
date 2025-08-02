// app/(user)/home.tsx
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore, database } from "@/config/firebase";
import { ref, onValue, off, set } from "firebase/database";
import { colors } from "@/utils/colors";
import {
  AntDesign,
  MaterialIcons,
  Ionicons,
  FontAwesome,
  FontAwesome5,
  Feather,
} from "@expo/vector-icons";

const { height } = Dimensions.get("window");

const rideTypes = [
  {
    id: "bike",
    name: "Bike",
    icon: "motorcycle",
    iconLib: FontAwesome5,
    multiplier: 1,
    time: "5-10 min",
    baseRate: 10, // PKR per km
  },
  {
    id: "car",
    name: "Standard",
    icon: "car",
    iconLib: FontAwesome5,
    multiplier: 1,
    time: "8-15 min",
    baseRate: 100, // PKR per km
  },
  {
    id: "car_plus",
    name: "Comfort",
    icon: "car-sport",
    iconLib: Ionicons,
    multiplier: 1.5,
    time: "10-18 min",
    baseRate: 150, // PKR per km
  },
  {
    id: "premium",
    name: "Premium",
    icon: "car",
    iconLib: Ionicons,
    multiplier: 2,
    time: "5-12 min",
    baseRate: 200, // PKR per km
  },
];

export default function UserHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.6844,
    longitude: 73.0479,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(
    null,
  );
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);

  // Get user location
  // Update your useEffect for location
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
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
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

  useEffect(() => {
    let isMounted = true;
    let watchId: Location.LocationSubscription | null = null;

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

        // Get initial position
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setLocation(location);
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        }

        // Watch for position updates
        watchId = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 50, // Update every 50 meters
            timeInterval: 5000, // Update every 5 seconds
          },
          (newLocation) => {
            if (isMounted) {
              setLocation(newLocation);
              // You might not want to update the region on every small change
              // to avoid the map jumping around
            }
          },
        );
      } catch (error) {
        console.error("Location error:", error);
      }
    })();

    return () => {
      isMounted = false;
      if (watchId) {
        watchId.remove(); // Cleanup the watcher
      }
    };
  }, []);
  // Animate panel on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: height * 0.45,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, []);

  // Calculate fare when destination or ride type changes
  useEffect(() => {
    if (location && selectedLocation && selectedRide) {
      const distance = calculateDistanceInKm(
        location.coords.latitude,
        location.coords.longitude,
        selectedLocation.latitude,
        selectedLocation.longitude,
      );

      const rideType = rideTypes.find((r) => r.id === selectedRide);
      if (rideType) {
        const fare = calculateFare(rideType.baseRate, distance);
        setEstimatedDistance(distance);
        setEstimatedFare(fare);
        setEstimatedTime(calculateEstimatedTime(distance));
      }
    } else {
      setEstimatedFare(null);
      setEstimatedDistance(null);
      setEstimatedTime(null);
    }
  }, [selectedLocation, selectedRide, location]);

  // Listen for nearby drivers
  useEffect(() => {
    if (!location) return;

    const driversRef = ref(database, "drivers");
    const unsubscribe = onValue(driversRef, (snapshot) => {
      const drivers: any[] = [];
      snapshot.forEach((childSnapshot) => {
        const driver = childSnapshot.val();
        if (driver.status === "available") {
          const distance = calculateDistanceInKm(
            location.coords.latitude,
            location.coords.longitude,
            driver.latitude,
            driver.longitude,
          );
          if (distance <= 6) {
            // Only show drivers within 5km
            drivers.push({
              id: childSnapshot.key,
              ...driver,
              distance,
            });
          }
        }
      });
      setNearbyDrivers(drivers);
    });

    return () => off(driversRef);
  }, [location]);

  const calculateDistanceInKm = (
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

  const calculateEstimatedTime = (distance: number) => {
    const averageSpeed = 30; // km/h (city traffic)
    const timeInHours = distance / averageSpeed;
    const minutes = Math.ceil(timeInHours * 60);
    return minutes > 1 ? `${minutes} mins` : "1 min";
  };

  const calculateFare = (baseRate: number, distance: number) => {
    const MIN_FARE = 100; // PKR
    const calculatedFare = distance * baseRate;
    return Math.ceil(Math.max(calculatedFare, MIN_FARE));
  };

  const searchPlaces = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query,
        )}&key=${apiKey}&language=en`,
      );

      const json = await response.json();

      if (json.status !== "OK") {
        console.error(
          "Google Places API error:",
          json.status,
          json.error_message,
        );
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      const results = await Promise.all(
        json.predictions.map(async (prediction: any) => {
          const details = await fetchPlaceDetails(prediction.place_id, apiKey);

          if (details) {
            return {
              id: prediction.place_id,
              name: prediction.structured_formatting.main_text,
              address: prediction.description,
              latitude: details.latitude,
              longitude: details.longitude,
            };
          } else {
            return null;
          }
        }),
      );

      const validResults = results.filter((item) => item !== null);
      setSearchResults(validResults as any[]);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const fetchPlaceDetails = async (placeId: string, apiKey: string) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&language=en`,
      );
      const json = await response.json();

      if (json.status === "OK") {
        const result = json.result;
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
          name: result.name,
        };
      } else {
        console.error("Place details error:", json.status, json.error_message);
        return null;
      }
    } catch (error) {
      console.error("Place details fetch failed:", error);
      return null;
    }
  };

  const selectSearchResult = (place: any) => {
    setDestination(place.name);
    setSelectedLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
    });
    setShowSearchResults(false);

    if (location && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: place.latitude,
            longitude: place.longitude,
          },
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 450, left: 50 },
          animated: true,
        },
      );
    }
  };

  const handleMapPress = (e: any) => {
    const coordinate = e.nativeEvent.coordinate;
    setSelectedLocation(coordinate);
    setDestination(
      `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
    );
    setShowSearchResults(false);
  };

  const expandPanel = () => {
    setPanelExpanded(!panelExpanded);
    Animated.spring(slideAnim, {
      toValue: panelExpanded ? height * 0.45 : height * 0.8,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const requestRide = async () => {
    if (!selectedRide || !location || !selectedLocation) {
      Alert.alert(
        "Missing Information",
        "Please select a ride type and destination",
      );
      return;
    }

    setLoading(true);
    try {
      const rideType = rideTypes.find((r) => r.id === selectedRide);
      const distance = calculateDistanceInKm(
        location.coords.latitude,
        location.coords.longitude,
        selectedLocation.latitude,
        selectedLocation.longitude,
      );

      const fare = rideType ? calculateFare(rideType.baseRate, distance) : 100;

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
        destinationAddress: selectedLocation.address || destination,
        status: "searching",
        createdAt: new Date().toISOString(),
        distance: parseFloat(distance.toFixed(2)),
        estimatedTime: calculateEstimatedTime(distance),
        fare,
        fareCurrency: "PKR",
      };

      const rideId = `ride_${Date.now()}`;

      await Promise.all([
        setDoc(doc(firestore, "rides", rideId), rideRequest),
        set(ref(database, `rideRequests/${rideId}`), {
          ...rideRequest,
          id: rideId,
        }),
      ]);

      router.push(`/(user)/ride-status?rideId=${rideId}`);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to request ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        region={mapRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        customMapStyle={[]}
      >
        {/* User Location */}
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
              <Ionicons name="person" size={16} color={colors.background} />
            </View>
          </Marker>
        )}

        {/* Selected Destination */}
        {selectedLocation && (
          <Marker coordinate={selectedLocation} title="Destination">
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

        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver) => {
          const IconComponent = driver.rideType.includes("bike")
            ? FontAwesome5
            : FontAwesome5;
          const iconName = driver.rideType.includes("bike")
            ? "motorcycle"
            : "car";

          return (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              title={`Driver ${driver.id.slice(-4)}`}
              description={`${driver.rideType.join(", ")} available`}
            >
              <View
                style={{
                  backgroundColor: colors.background,
                  padding: 6,
                  borderRadius: 15,
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              >
                <IconComponent
                  name={iconName}
                  size={12}
                  color={colors.primary}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top Navigation */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          right: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.background,
              padding: 12,
              borderRadius: 50,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
            onPress={() => router.push("/profile")}
          >
            <AntDesign name="user" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.background,
              padding: 12,
              borderRadius: 50,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
            onPress={() => router.push("/(user)/rides")}
          >
            <MaterialIcons name="history" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: colors.background,
            padding: 12,
            borderRadius: 50,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}
          onPress={() => {
            console.log(location);
            console.log(mapRef.current);
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
      </View>

      {/* Search Results Overlay */}
      {showSearchResults && searchResults.length > 0 && (
        <View
          style={{
            position: "absolute",
            top: 130,
            left: 20,
            right: 20,
            backgroundColor: colors.background,
            borderRadius: 16,
            maxHeight: 200,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <ScrollView>
            {searchResults.map((place, index) => (
              <Pressable
                key={place.id}
                onPress={() => selectSearchResult(place)}
                style={{
                  padding: 16,
                  borderBottomWidth: index < searchResults.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>
                  {place.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  {place.address}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

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
          {/* Destination Input */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 12,
              }}
            >
              Where to?
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.bg_accent,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
              }}
            >
              <Feather
                name="search"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                placeholder="Search destinations..."
                placeholderTextColor={colors.textSecondary}
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  searchPlaces(text);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  color: colors.text,
                  fontSize: 16,
                }}
              />
            </View>
            <Text
              style={{
                color: selectedLocation ? colors.primary : colors.textSecondary,
                fontSize: 12,
                marginTop: 8,
                fontWeight: selectedLocation ? "600" : "400",
              }}
            >
              {selectedLocation
                ? "✓ Destination selected"
                : "Tap on map or search to select destination"}
            </Text>
          </View>

          {/* Ride Types */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 16,
              }}
            >
              Choose a ride
            </Text>
            <View style={{ gap: 12 }}>
              {rideTypes.map((ride) => {
                const IconComponent = ride.iconLib;
                return (
                  <Pressable
                    key={ride.id}
                    onPress={() => setSelectedRide(ride.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor:
                        selectedRide === ride.id
                          ? colors.secondary
                          : colors.background,
                      borderWidth: selectedRide === ride.id ? 2 : 1,
                      borderColor:
                        selectedRide === ride.id
                          ? colors.primary
                          : colors.border,
                      borderRadius: 16,
                      padding: 16,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor:
                          selectedRide === ride.id
                            ? colors.primary
                            : colors.bg_accent,
                        padding: 12,
                        borderRadius: 50,
                        marginRight: 16,
                      }}
                    >
                      <IconComponent
                        name={ride.icon}
                        size={20}
                        color={
                          selectedRide === ride.id
                            ? colors.background
                            : colors.primary
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "600",
                          fontSize: 16,
                          marginBottom: 4,
                        }}
                      >
                        {ride.name}
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 14 }}
                      >
                        {ride.time} •{" "}
                        {
                          nearbyDrivers.filter((d) =>
                            d.rideType.includes(ride.id),
                          ).length
                        }{" "}
                        nearby
                      </Text>
                    </View>
                    {estimatedFare && selectedRide === ride.id ? (
                      <Text
                        style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}
                      >
                        PKR{estimatedFare.toFixed(0)}
                      </Text>
                    ) : (
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 14 }}
                      >
                        PKR{ride.baseRate}/km
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ride Details */}
          {selectedRide && selectedLocation && (
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#000000",
                  marginBottom: 16,
                }}
              >
                Trip Details
              </Text>
              <View style={{ gap: 12 }}>
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
                        backgroundColor: "#000000",
                        padding: 6,
                        borderRadius: 50,
                        marginRight: 12,
                      }}
                    >
                      <Feather name="navigation" size={12} color="#FFFFFF" />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Distance</Text>
                  </View>
                  <Text style={{ color: "#000000", fontWeight: "600" }}>
                    {estimatedDistance
                      ? estimatedDistance.toFixed(1) + " km"
                      : "--"}
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
                        backgroundColor: "#000000",
                        padding: 6,
                        borderRadius: 50,
                        marginRight: 12,
                      }}
                    >
                      <Feather name="clock" size={12} color="#FFFFFF" />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>
                      Estimated Time
                    </Text>
                  </View>
                  <Text style={{ color: "#000000", fontWeight: "600" }}>
                    {estimatedTime || "--"}
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
                        backgroundColor: "#000000",
                        padding: 6,
                        borderRadius: 50,
                        marginRight: 12,
                      }}
                    >
                      <Feather name="dollar-sign" size={12} color="#FFFFFF" />
                    </View>
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Fare</Text>
                  </View>
                  <Text
                    style={{
                      color: "#000000",
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    {estimatedFare ? "PKR" + estimatedFare.toFixed(0) : "--"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Request Button */}
          <Pressable
            onPress={requestRide}
            disabled={!selectedRide || !selectedLocation || loading}
            style={{
              backgroundColor:
                !selectedRide || !selectedLocation
                  ? "#E5E7EB"
                  : "#000000",
              padding: 18,
              borderRadius: 16,
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  color: !selectedRide || !selectedLocation ? "#9CA3AF" : "#FFFFFF",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Request{" "}
                {selectedRide
                  ? rideTypes.find((r) => r.id === selectedRide)?.name
                  : "Ride"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}