import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

export type OwnerProfile = {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  businessType?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
};

export const authApi = {
  async login(emailOrPhone: string, password: string) {
    const res = await apiClient.post(ApiEndpoints.ownerLogin, {
      email: emailOrPhone,
      password,
    });
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
        company: user.company ?? '',
        phone: user.phone ?? '',
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

  async getOwnerProfile(): Promise<OwnerProfile> {
    const res = await apiClient.get(ApiEndpoints.ownerProfile);
    const raw: any = res.data ?? {};
    const data = raw.data ?? raw;
    return {
      id: data._id ?? data.id ?? '',
      name: data.name ?? data.fullName ?? '',
      email: data.email ?? '',
      company: data.company ?? '',
      phone: data.phone ?? '',
      businessType: data.businessType ?? '',
      isActive: data.isActive,
      createdAt: data.createdAt,
      lastLogin: data.lastLogin,
    };
  },

  async updateOwnerProfile(payload: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  }): Promise<OwnerProfile> {
    const res = await apiClient.put(ApiEndpoints.ownerProfile, payload);
    const raw: any = res.data ?? {};
    const data = raw.data ?? raw;
    return {
      id: data._id ?? data.id ?? '',
      name: data.name ?? data.fullName ?? '',
      email: data.email ?? '',
      company: data.company ?? '',
      phone: data.phone ?? '',
      businessType: data.businessType ?? '',
      isActive: data.isActive,
      createdAt: data.createdAt,
      lastLogin: data.lastLogin,
    };
  },

  async changeOwnerPassword(currentPassword: string, newPassword: string) {
    const res = await apiClient.put(ApiEndpoints.ownerChangePassword, {
      currentPassword,
      newPassword,
    });
    const raw: any = res.data ?? {};
    return { message: raw.message ?? 'Password changed successfully' };
  },
};
