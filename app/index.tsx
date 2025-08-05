import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";

export default function Index() {
  const { user, userRole, loading } = useAuth();
  const [userVerified, setUserVerified] = useState<boolean | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (user && userRole === "driver") {
        setCheckingVerification(true);
        try {
          const userDocRef = doc(firestore, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserVerified(userData.verified || false);
          } else {
            setUserVerified(false);
          }
        } catch (error) {
          console.log("Error checking verification status:", error);
          setUserVerified(false);
        } finally {
          setCheckingVerification(false);
        }
      }
    };

    checkVerificationStatus();
  }, [user, userRole]);

  // Show loading while auth is initializing or checking verification
  if (loading || (userRole === "driver" && checkingVerification)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    // No user logged in, redirect to auth flow
    return <Redirect href="/(auth)/login" />;
  }

  // User is logged in, redirect based on role and verification status
  switch (userRole) {
    case "user":
      return <Redirect href="/(user)" />;
    case "driver":
      // Check if driver is verified
      if (userVerified === false) {
        return <Redirect href="/(auth)/unverified" />;
      } else if (userVerified === true) {
        return <Redirect href="/(driver)/home" />;
      } else {
        // Still checking verification status, show loading
        return (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" />
          </View>
        );
      }
    default:
      // If user has no role set (shouldn't happen in normal flow)
      return <Redirect href="/(auth)/role-selection" />;
  }
}
