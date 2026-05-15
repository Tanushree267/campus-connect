import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/lib/api";
import type { User } from "@/lib/mock-data";

interface AuthContextValue {
  currentUser: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateCurrentUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getStoredToken = () => localStorage.getItem("token");

/**
 * MERGED NORMALIZE FUNCTION
 * - Preserves original logic
 * - Adds _id normalization support from the new file
 * - Ensures both id and _id stay synced
 */
const normalizeUser = (user: User): User => {
  const mongoId =
    (user as User & { _id?: string })._id ||
    user.id ||
    "";

  return {
    ...user,
    _id: mongoId,
    id: user.id || mongoId,
  } as User;
};

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(getStoredToken());

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [loading, setLoading] = useState<boolean>(() =>
    Boolean(getStoredToken())
  );

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken(null);
    setCurrentUser(null);
    setLoading(false);
  };

  const refreshUser = async () => {
    const storedToken = getStoredToken();

    if (!storedToken) {
      logout();
      return;
    }

    setLoading(true);

    try {
      const user = normalizeUser(await getCurrentUser());

      localStorage.setItem("user", JSON.stringify(user));

      setCurrentUser(user);
      setToken(storedToken);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      logout();
      return;
    }

    void refreshUser();
  }, [token]);

  const login = (newToken: string, user: User) => {
    const normalizedUser = normalizeUser(user);

    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(normalizedUser));

    setToken(newToken);
    setCurrentUser(normalizedUser);
    setLoading(false);
  };

  const updateCurrentUser = (user: User) => {
    const normalizedUser = normalizeUser(user);

    localStorage.setItem("user", JSON.stringify(normalizedUser));

    setCurrentUser(normalizedUser);
  };

  const value = useMemo(
    () => ({
      currentUser,
      token,
      loading,
      isAuthenticated: Boolean(currentUser && token),

      login,
      logout,
      refreshUser,
      updateCurrentUser,
    }),
    [currentUser, token, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}