import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loginUser,
  logoutUser,
  restoreAuth,
  clearError,
} from '../store/slices/authSlice';

export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const loading = useAppSelector((state) => state.auth.loading);
  const error = useAppSelector((state) => state.auth.error);

  const init = useCallback(() => {
    dispatch(restoreAuth());
  }, [dispatch]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await dispatch(loginUser({ email, password }));
      if (loginUser.rejected.match(result)) {
        throw result.payload;
      }
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    await dispatch(logoutUser());
  }, [dispatch]);

  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    init,
    login,
    logout,
    clearError: clearAuthError,
  };
}


