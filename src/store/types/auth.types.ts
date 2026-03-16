export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin';
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}


