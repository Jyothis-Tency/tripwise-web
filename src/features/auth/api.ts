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

  async requestPasswordResetOtp(email: string) {
    const res = await apiClient.post(ApiEndpoints.ownerForgotPassword, {
      email,
      userType: 'owner',
    });
    const raw: any = res.data ?? {};
    return {
      message: raw.message ?? 'If an account exists, a reset code has been sent.',
      expiresInMinutes: raw.data?.expiresInMinutes ?? 15,
    };
  },

  async resetPasswordWithOtp(
    email: string,
    otp: string,
    newPassword: string,
  ) {
    const res = await apiClient.post(ApiEndpoints.ownerResetPassword, {
      email,
      otp,
      newPassword,
      userType: 'owner',
    });
    const raw: any = res.data ?? {};
    return { message: raw.message ?? 'Password updated successfully.' };
  },
};


