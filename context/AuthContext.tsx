// app/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User, signOut as authSignOut } from "firebase/auth";
import { auth, firestore } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

type UserRole = "user" | "driver" | "unset";

interface AuthContextType {
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  error: Error | null;
  refreshUserRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: "unset",
  loading: true,
  error: null,
  refreshUserRole: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("unset");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshUserRole = useCallback(async (uid?: string) => {
    try {
      const userId = uid || user?.uid;
      if (!userId) {
        setUserRole("unset");
        return;
      }

      const userDoc = await getDoc(doc(firestore, "users", userId));
      if (userDoc.exists()) {
        const role = userDoc.data().userType as UserRole;
        setUserRole(role || "unset");
      } else {
        setUserRole("unset");
        console.warn("User document not found in Firestore");
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching user role:", err);
      setUserRole("unset");
      setError(err instanceof Error ? err : new Error("Failed to fetch user role"));
    }
  }, [user?.uid]);

  const signOut = useCallback(async () => {
    try {
      await authSignOut(auth);
      setUser(null);
      setUserRole("unset");
      setError(null);
    } catch (err) {
      console.error("Error signing out:", err);
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);
        setUser(user);
        
        if (user) {
          await refreshUserRole(user.uid);
        } else {
          setUserRole("unset");
        }
        
        setError(null);
      } catch (err) {
        console.error("Auth state change error:", err);
        setError(err instanceof Error ? err : new Error("Auth state change failed"));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshUserRole]);

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        userRole, 
        loading, 
        error,
        refreshUserRole, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};