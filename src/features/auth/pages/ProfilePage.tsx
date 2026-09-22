import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  User,
} from "lucide-react";
import { authApi, type OwnerProfile } from "../api";
import { useAuth } from "../../../hooks/useAuth";

const fieldCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function formatDate(d?: string) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProfileErr(null);
    try {
      const p = await authApi.getOwnerProfile();
      setProfile(p);
      setName(p.name);
      setEmail(p.email);
      setPhone(p.phone);
      setCompany(p.company);
    } catch {
      setProfileErr("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    if (!name.trim() || !email.trim() || !phone.trim() || !company.trim()) {
      setProfileErr("Name, email, phone, and company are required.");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authApi.updateOwnerProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
      });
      setProfile(updated);
      // Keep local auth display in sync
      try {
        const raw = localStorage.getItem("userData");
        if (raw) {
          const u = JSON.parse(raw);
          localStorage.setItem(
            "userData",
            JSON.stringify({
              ...u,
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              company: updated.company,
            }),
          );
        }
      } catch {
        /* ignore */
      }
      setProfileMsg("Profile updated successfully.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update profile.";
      setProfileErr(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordErr(null);
    if (!currentPassword) {
      setPasswordErr("Enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr("New password and confirm password do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await authApi.changeOwnerPassword(
        currentPassword,
        newPassword,
      );
      setPasswordMsg(res.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to change password.";
      setPasswordErr(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (profile?.name || user?.name || "O")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-sm">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Owner Profile</h1>
            <p className="text-sm text-slate-500">
              View your account details and change password
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Profile details */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                Account details
              </h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-4 p-5">
              <div>
                <FieldLabel>Full name</FieldLabel>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${fieldCls} pl-9`}
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${fieldCls} pl-9`}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`${fieldCls} pl-9`}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Company</FieldLabel>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={`${fieldCls} pl-9`}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">
                    Last login
                  </p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {formatDate(profile?.lastLogin)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">
                    Member since
                  </p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {formatDate(profile?.createdAt)}
                  </p>
                </div>
              </div>

              {profileMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {profileMsg}
                </div>
              )}
              {profileErr && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {profileErr}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save details
              </button>
            </form>
          </section>

          {/* Password */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Shield className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                Password
              </h2>
            </div>
            <form onSubmit={changePassword} className="space-y-4 p-5">
              <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-800">
                Your password is stored securely and cannot be shown. Enter your
                current password to set a new one.
              </div>

              <div>
                <FieldLabel>Current password</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`${fieldCls} pl-9 pr-10`}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>New password</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${fieldCls} pl-9 pr-10`}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>Confirm new password</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${fieldCls} pl-9 pr-10`}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {passwordMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {passwordMsg}
                </div>
              )}
              {passwordErr && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {passwordErr}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Change password
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
