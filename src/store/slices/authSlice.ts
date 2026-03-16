import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, AuthTokens, User } from '../types/auth.types';
import { authApi } from '../../features/auth/api';

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  // Start in loading state so ProtectedRoute waits for restoreAuth on reload
  loading: true,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(payload.email, payload.password);

      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));

      return data;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  },
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
  } catch (error: any) {
    return rejectWithValue(error);
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    restoreAuth(state) {
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('userData');

      if (token && userData) {
        try {
          const user = JSON.parse(userData) as User;
          state.user = user;
          state.tokens = { accessToken: token };
          state.isAuthenticated = true;
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userData');
        }
      }
      state.loading = false;
    },
    updateTokens(state, action: PayloadAction<AuthTokens>) {
      state.tokens = action.payload;
      localStorage.setItem('accessToken', action.payload.accessToken);
    },
    clearError(state) {
      state.error = null;
    },
    clearAuth(state) {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        const payload: any = action.payload ?? {};
        const rawUser: any = payload.user ?? payload.owner ?? {};

        const user: User = {
          id: rawUser._id ?? rawUser.id ?? '',
          name: rawUser.name ?? rawUser.fullName ?? '',
          email: rawUser.email ?? '',
          role: (rawUser.role as any) ?? 'owner',
        };

        state.user = user;
        const token = payload.token ?? payload.accessToken ?? '';
        state.tokens = { accessToken: token };
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        const error = action.payload as any;
        state.error =
          error?.response?.data?.message || error?.message || 'Login failed. Please try again.';
        state.isAuthenticated = false;
      });

    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
      });
  },
});

export const { restoreAuth, updateTokens, clearError, clearAuth } = authSlice.actions;
export default authSlice.reducer;


