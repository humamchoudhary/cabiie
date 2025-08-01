// app/(user)/rides.tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { colors } from "@/utils/colors";
import { MaterialIcons, AntDesign, Feather } from "@expo/vector-icons";

interface Ride {
  id: string;
  rideType: string;
  status: string;
  createdAt: string;
  destinationAddress: string;
  fare?: number;
  driverId?: string;
  driverName?: string;
  rating?: number;
  pickupLocation: {
    latitude: number;
    longitude: number;
  };
  destinationLocation: {
    latitude: number;
    longitude: number;
  };
}

export default function RidesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">(
    "all",
  );

  useEffect(() => {
    if (!user?.uid) return;

    const ridesQuery = query(
      collection(firestore, "rides"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rideData: Ride[] = [];
      snapshot.forEach((doc) => {
        rideData.push({ id: doc.id, ...doc.data() } as Ride);
      });
      setRides(rideData);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const getFilteredRides = () => {
    switch (activeTab) {
      case "active":
        return rides.filter((ride) =>
          ["searching", "accepted", "arrived", "in_progress"].includes(
            ride.status,
          ),
        );
      case "completed":
        return rides.filter((ride) =>
          ["completed", "cancelled"].includes(ride.status),
        );
      default:
        return rides;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "searching":
        return colors.textSecondary;
      case "accepted":
      case "arrived":
        return colors.primary;
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "searching":
        return "Looking for driver";
      case "accepted":
        return "Driver assigned";
      case "arrived":
        return "Driver arrived";
      case "in_progress":
        return "In progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Today";
    } else if (diffDays === 2) {
      return "Yesterday";
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleRidePress = (ride: Ride) => {
    // If ride is active, navigate to ride status
    if (
      ["searching", "accepted", "arrived", "in_progress"].includes(ride.status)
    ) {
      router.push(`/(user)/ride-status?rideId=${ride.id}`);
    }
    // For completed/cancelled rides, you could show a detail view
    // router.push(`/(user)/ride-details?rideId=${ride.id}`);
  };

  const filteredRides = getFilteredRides();

  if (loading) {
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
        <Text style={{ color: colors.text, marginTop: 16 }}>
          Loading your rides...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: 60,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: colors.bg_accent,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              padding: 8,
              marginRight: 12,
            }}
          >
            <AntDesign name="arrowleft" size={24} color={colors.text} />
          </Pressable>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: colors.text,
              flex: 1,
            }}
          >
            My Rides
          </Text>
        </View>

        {/* Tab Navigation */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.background,
            borderRadius: 8,
            padding: 4,
          }}
        >
          {["all", "active", "completed"].map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab as any)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor:
                  activeTab === tab ? colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: activeTab === tab ? colors.background : colors.text,
                  fontWeight: activeTab === tab ? "600" : "400",
                  textTransform: "capitalize",
                }}
              >
                {tab} (
                {tab === "all"
                  ? rides.length
                  : tab === "active"
                    ? rides.filter((r) =>
                        [
                          "searching",
                          "accepted",
                          "arrived",
                          "in_progress",
                        ].includes(r.status),
                      ).length
                    : rides.filter((r) =>
                        ["completed", "cancelled"].includes(r.status),
                      ).length}
                )
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Rides List */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredRides.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 80,
            }}
          >
            <MaterialIcons
              name="directions-car"
              size={64}
              color={colors.textSecondary}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 18,
                fontWeight: "600",
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              No {activeTab === "all" ? "" : activeTab} rides
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              {activeTab === "active"
                ? "You don't have any active rides at the moment"
                : activeTab === "completed"
                  ? "You haven't completed any rides yet"
                  : "Start your first ride by booking from the home screen"}
            </Text>
            {activeTab === "all" && (
              <Pressable
                onPress={() => router.push("/(user)/home")}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 25,
                  marginTop: 20,
                }}
              >
                <Text
                  style={{
                    color: colors.background,
                    fontWeight: "600",
                  }}
                >
                  Book a Ride
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {filteredRides.map((ride) => (
              <Pressable
                key={ride.id}
                onPress={() => handleRidePress(ride)}
                style={{
                  backgroundColor: colors.bg_accent,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>
                    {getRideTypeIcon(ride.rideType)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {ride.rideType.replace("_", " ")} Ride
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {formatDate(ride.createdAt)}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: getStatusColor(ride.status) + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: getStatusColor(ride.status),
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {getStatusText(ride.status)}
                    </Text>
                  </View>
                </View>

                {/* Destination */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <MaterialIcons
                    name="place"
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginRight: 8, marginTop: 2 }}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      flex: 1,
                      lineHeight: 20,
                    }}
                    numberOfLines={2}
                  >
                    {ride.destinationAddress || "Unknown destination"}
                  </Text>
                </View>

                {/* Footer */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {ride.driverName && (
                      <>
                        <Feather
                          name="user"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          {ride.driverName}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {ride.fare && (
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 14,
                          fontWeight: "600",
                          marginRight: 8,
                        }}
                      >
                        ${ride.fare}
                      </Text>
                    )}
                    {[
                      "searching",
                      "accepted",
                      "arrived",
                      "in_progress",
                    ].includes(ride.status) && (
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.background,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          Active
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
