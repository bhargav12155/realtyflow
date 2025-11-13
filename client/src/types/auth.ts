// Authentication types for the client
export interface User {
  id: string | number;
  name: string;
  email: string;
  type: "agent" | "public";
  username?: string; // Only for agents
  agentSlug?: string; // Only for public users
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  isNewUser?: boolean; // For public user login
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: string;
}

export interface PublicUserData {
  email: string;
  agentSlug: string;
  name?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
