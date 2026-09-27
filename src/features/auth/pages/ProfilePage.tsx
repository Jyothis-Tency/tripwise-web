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
  "w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
      <div className="flex h-full items-center justify-center bg-[var(--bg-main)]">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-main)]">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm dark:bg-indigo-500">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Owner Profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              View your account details and change password
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Profile details */}
          <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638]">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-transparent opacity-80"
              aria-hidden
            />
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-[#1e2638]">
              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
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

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500 dark:border-[#1e2638] dark:bg-white/[0.03] dark:text-slate-400">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Last login
                  </p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                    {formatDate(profile?.lastLogin)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Member since
                  </p>
                  <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                    {formatDate(profile?.createdAt)}
                  </p>
                </div>
              </div>

              {profileMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {profileMsg}
                </div>
              )}
              {profileErr && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  {profileErr}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
          <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638]">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent opacity-70"
              aria-hidden
            />
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-[#1e2638]">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Password
              </h2>
            </div>
            <form onSubmit={changePassword} className="space-y-4 p-5">
              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {passwordMsg}
                </div>
              )}
              {passwordErr && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  {passwordErr}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
