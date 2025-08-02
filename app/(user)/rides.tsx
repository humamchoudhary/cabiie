// app/(user)/rides.tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  StatusBar,
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
import {
  MaterialIcons,
  AntDesign,
  Feather,
  Ionicons,
  FontAwesome5,
} from "@expo/vector-icons";

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
        return { icon: "motorcycle", lib: FontAwesome5 };
      case "car":
        return { icon: "car", lib: FontAwesome5 };
      case "car_plus":
        return { icon: "car-sport", lib: Ionicons };
      case "premium":
        return { icon: "car", lib: Ionicons };
      default:
        return { icon: "car", lib: FontAwesome5 };
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
    if (
      ["searching", "accepted", "arrived", "in_progress"].includes(ride.status)
    ) {
      router.push(`/(user)/ride-status?rideId=${ride.id}`);
    }
  };

  const filteredRides = getFilteredRides();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your rides...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <AntDesign name="arrowleft" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>My Rides</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {["all", "active", "completed"].map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab as any)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
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
        style={styles.content}
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
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons
                name="directions-car"
                size={48}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyStateTitle}>
              No {activeTab === "all" ? "" : activeTab} rides
            </Text>
            <Text style={styles.emptyStateDescription}>
              {activeTab === "active"
                ? "You don't have any active rides at the moment"
                : activeTab === "completed"
                  ? "You haven't completed any rides yet"
                  : "Start your first ride by booking from the home screen"}
            </Text>
            {activeTab === "all" && (
              <Pressable
                onPress={() => router.push("/(user)/home")}
                style={styles.bookRideButton}
              >
                <Ionicons name="add" size={20} color={colors.background} />
                <Text style={styles.bookRideButtonText}>Book a Ride</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.ridesList}>
            {filteredRides.map((ride) => {
              const rideIcon = getRideTypeIcon(ride.rideType);
              const IconComponent = rideIcon.lib;

              return (
                <Pressable
                  key={ride.id}
                  onPress={() => handleRidePress(ride)}
                  style={styles.rideCard}
                >
                  {/* Header */}
                  <View style={styles.rideCardHeader}>
                    <View style={styles.rideTypeIconContainer}>
                      <IconComponent
                        name={rideIcon.icon}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rideInfo}>
                      <Text style={styles.rideTypeName}>
                        {ride.rideType.replace("_", " ")} Ride
                      </Text>
                      <Text style={styles.rideDate}>
                        {formatDate(ride.createdAt)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(ride.status) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(ride.status) },
                        ]}
                      >
                        {getStatusText(ride.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Destination */}
                  <View style={styles.destinationContainer}>
                    <MaterialIcons
                      name="place"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.destinationText} numberOfLines={2}>
                      {ride.destinationAddress || "Unknown destination"}
                    </Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.rideCardFooter}>
                    <View style={styles.driverInfo}>
                      {ride.driverName && (
                        <>
                          <Feather
                            name="user"
                            size={14}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.driverName}>
                            {ride.driverName}
                          </Text>
                        </>
                      )}
                    </View>

                    <View style={styles.rideFooterRight}>
                      {ride.fare && (
                        <Text style={styles.fareText}>PKR {ride.fare}</Text>
                      )}
                      {[
                        "searching",
                        "accepted",
                        "arrived",
                        "in_progress",
                      ].includes(ride.status) && (
                        <View style={styles.activeBadge}>
                          <View style={styles.activeDot} />
                          <Text style={styles.activeText}>Active</Text>
                        </View>
                      )}
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.text,
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    backgroundColor: colors.background,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.bg_accent,
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.text,
    fontWeight: "500",
    fontSize: 14,
    textTransform: "capitalize",
  },
  tabTextActive: {
    color: colors.background,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    backgroundColor: colors.bg_accent,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateDescription: {
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  bookRideButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  bookRideButtonText: {
    color: colors.background,
    fontWeight: "600",
    fontSize: 16,
  },
  ridesList: {
    padding: 16,
  },
  rideCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rideCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  rideTypeIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: colors.bg_accent,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rideInfo: {
    flex: 1,
  },
  rideTypeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 2,
  },
  rideDate: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  destinationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingLeft: 4,
  },
  destinationText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    marginLeft: 8,
  },
  rideCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  driverName: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 6,
  },
  rideFooterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fareText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  activeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
});
