import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  AuthState,
  User,
  LoginCredentials,
  RegisterData,
  PublicUserData,
  AuthResponse,
} from "@/types/auth";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  publicLogin: (data: PublicUserData) => Promise<AuthResponse>;
  universalLogin: (identifier: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check authentication status on app load
  const checkAuth = async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch("/api/auth/check", {
        credentials: "include", // Include cookies
      });

      if (response.ok) {
        const data = await response.json();

        if (data.authenticated && data.user) {
          setAuthState({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Failed to check authentication",
      });
    }
  };

  // Agent login
  const login = async (
    credentials: LoginCredentials
  ): Promise<AuthResponse> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null }));

      const response = await fetch("/api/auth/agent/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success && data.user) {
        setAuthState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          error: data.error || "Login failed",
        }));
      }

      return data;
    } catch (error) {
      const errorMessage = "Login failed. Please try again.";
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
      return { success: false, message: errorMessage };
    }
  };

  // Agent registration
  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null }));

      const response = await fetch("/api/auth/agent/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.user) {
        setAuthState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          error: result.error || "Registration failed",
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = "Registration failed. Please try again.";
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
      return { success: false, message: errorMessage };
    }
  };

  // Public user login (no password required)
  const publicLogin = async (data: PublicUserData): Promise<AuthResponse> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null }));

      const response = await fetch("/api/auth/public/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.user) {
        setAuthState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          error: result.error || "Authentication failed",
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = "Authentication failed. Please try again.";
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
      return { success: false, message: errorMessage };
    }
  };

  // Universal login - auto-detects user type
  const universalLogin = async (identifier: string): Promise<AuthResponse> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null }));

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ identifier }),
      });

      const result = await response.json();

      if (result.success && result.user) {
        setAuthState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          error: result.error || "Authentication failed",
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = "Authentication failed. Please try again.";
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
      return { success: false, message: errorMessage };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      // Always clear local auth state
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    ...authState,
    login,
    register,
    publicLogin,
    universalLogin,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
