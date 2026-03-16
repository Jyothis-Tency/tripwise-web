import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

export const authApi = {
  async login(email: string, password: string) {
    const res = await apiClient.post(ApiEndpoints.ownerLogin, { email, password });
    const raw: any = res.data ?? {};
    const data = raw.data ?? raw;
    const user = data.owner ?? data.user ?? {};

    return {
      token: data.token ?? '',
      user: {
        _id: user._id ?? user.id ?? '',
        name: user.name ?? user.fullName ?? '',
        email: user.email ?? '',
        role: (user.role as string) ?? 'owner',
      },
    };
  },

  async logout() {
    await apiClient.post(ApiEndpoints.ownerLogout);
  },
};


