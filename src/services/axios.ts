import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://heyanoop.site';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string | null) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

export function forceLogout(reason?: string) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userData');

  import('../store').then(({ store }) => {
    import('../store/slices/authSlice').then(({ clearAuth }) => {
      store.dispatch(clearAuth());
    });
  });

  if (window.location.pathname !== '/login') {
    const msg = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    window.location.replace(`/login${msg}`);
  }
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const url = originalRequest.url ?? '';
    if (url.includes('/auth/owner/login') || url.includes('/admin/auth/login')) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      forceLogout('session_expired');
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      forceLogout('session_expired');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          if (!newToken) {
            resolve(Promise.reject(error));
            return;
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      // Tripwise backend currently has no refresh endpoint; just force-logout.
      isRefreshing = false;
      onTokenRefreshed(null);
      forceLogout('session_expired');
      return Promise.reject(error);
    } catch (refreshError) {
      isRefreshing = false;
      onTokenRefreshed(null);
      forceLogout('session_expired');
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;


