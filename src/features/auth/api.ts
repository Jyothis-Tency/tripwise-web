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

function mapAuthUser(user: any, fallbackRole: string) {
  return {
    _id: user._id ?? user.id ?? '',
    id: user._id ?? user.id ?? '',
    name: user.name ?? user.fullName ?? '',
    email: user.email ?? '',
    role: (user.role as string) ?? fallbackRole,
    company: user.company ?? '',
    phone: user.phone ?? '',
  };
}

export const authApi = {
  /**
   * Same login form for owners and admins.
   * Tries owner login first; on failure tries admin — no UI mention of admin.
   */
  async login(emailOrPhone: string, password: string) {
    try {
      const res = await apiClient.post(ApiEndpoints.ownerLogin, {
        email: emailOrPhone,
        password,
      });
      const raw: any = res.data ?? {};
      const data = raw.data ?? raw;
      const user = data.owner ?? data.user ?? {};
      return {
        token: data.token ?? '',
        user: mapAuthUser(user, 'owner'),
      };
    } catch (ownerErr: any) {
      const status = ownerErr?.response?.status;
      // Only fall through to admin for auth failures
      if (status && status !== 401 && status !== 403 && status !== 404) {
        throw ownerErr;
      }
      try {
        const res = await apiClient.post(ApiEndpoints.adminLogin, {
          email: emailOrPhone,
          password,
        });
        const raw: any = res.data ?? {};
        const data = raw.data ?? raw;
        const user = data.user ?? data.admin ?? {};
        return {
          token: data.token ?? '',
          user: mapAuthUser(user, 'admin'),
        };
      } catch {
        throw ownerErr;
      }
    }
  },

  async logout() {
    const raw = localStorage.getItem('userData');
    let role = 'owner';
    try {
      role = raw ? (JSON.parse(raw)?.role as string) || 'owner' : 'owner';
    } catch {
      /* ignore */
    }
    const path =
      role === 'admin' || role === 'super_admin'
        ? ApiEndpoints.adminLogout
        : ApiEndpoints.ownerLogout;
    await apiClient.post(path);
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
