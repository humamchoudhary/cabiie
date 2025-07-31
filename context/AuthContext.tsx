// app/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as fSignOut } from "firebase/auth";
import { auth, firestore } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

type UserRole = "user" | "driver" | "unset";

interface AuthContextType {
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  refreshUserRole: () => Promise<void>;

  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: "unset",
  loading: true,
  refreshUserRole: async () => {},

  signOut: () => Promise<void>,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("unset");
  const [loading, setLoading] = useState(true);

  const signOut = async () => {
    try {
      await fSignOut(auth); // Sign out from Firebase
      setUser(null);
      setUserRole("unset");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const refreshUserRole = async (uid?: string) => {
    if (!uid && !user) return;
    const userId = uid || user?.uid;

    try {
      const userDoc = await getDoc(doc(firestore, "users", userId!));
      if (userDoc.exists()) {
        const role = userDoc.data().userType as UserRole;
        setUserRole(role || "unset");
      } else {
        setUserRole("unset");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole("unset");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await refreshUserRole(user.uid);
      } else {
        setUserRole("unset");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, userRole, loading, refreshUserRole, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
