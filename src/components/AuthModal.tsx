import React, { useEffect, useState } from 'react';
import {
  X,
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { useSupabase } from '../contexts/SupabaseContext';

export type AuthModalMode =
  | 'signin'
  | 'signup'
  | 'forgot_password'
  | 'update_password'
  | 'profile';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: AuthModalMode;
  onClose: () => void;
  onSuccessToast?: (message: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccessToast,
}) => {
  const {
    user,
    profile,
    isConfigured,
    signIn,
    signUp,
    sendPasswordReset,
    updatePassword,
    updateProfile,
    clearRecoveryMode,
    signOut,
  } = useSupabase();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
      if (initialMode === 'profile') {
        setFullName(
          profile?.full_name ||
            (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ||
            ''
        );
      } else {
        setFullName('');
      }
    }
  }, [isOpen, initialMode, profile?.full_name, user?.user_metadata?.full_name]);

  if (!isOpen) return null;

  const switchMode = (next: AuthModalMode) => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    if (mode === 'update_password') {
      clearRecoveryMode();
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isConfigured) {
      setErrorMsg('Supabase environment variables are not configured in this workspace.');
      return;
    }

    if (mode === 'signin') {
      if (!EMAIL_REGEX.test(email.trim())) {
        setErrorMsg('Please enter a valid corporate or personal email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }

      setSubmitting(true);
      const res = await signIn(email, password);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      onSuccessToast?.('Signed in to BrandGuard AI workspace');
      onClose();
      return;
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setErrorMsg('Please enter your full name (at least 2 characters).');
        return;
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      setSubmitting(true);
      const res = await signUp(email, password, fullName);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      if (res.requiresEmailConfirmation) {
        setSuccessMsg(res.message || 'Check your email to confirm your account.');
        return;
      }

      onSuccessToast?.('Workspace account created & authenticated');
      onClose();
      return;
    }

    if (mode === 'forgot_password') {
      if (!EMAIL_REGEX.test(email.trim())) {
        setErrorMsg('Please enter the email address associated with your account.');
        return;
      }

      setSubmitting(true);
      const res = await sendPasswordReset(email);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg(res.message || 'Reset link sent.');
      return;
    }

    if (mode === 'update_password') {
      if (password.length < 8) {
        setErrorMsg('New password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      setSubmitting(true);
      const res = await updatePassword(password);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      onSuccessToast?.('Password updated successfully');
      onClose();
      return;
    }

    if (mode === 'profile') {
      if (fullName.trim().length < 2) {
        setErrorMsg('Display name must be at least 2 characters.');
        return;
      }
      setSubmitting(true);
      const res = await updateProfile(fullName);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg('Profile saved.');
      onSuccessToast?.('Account profile updated');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md glass-panel-elevated rounded-2xl border border-violet-500/40 overflow-hidden shadow-[0_0_60px_rgba(124,58,237,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-[#0e1323] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center border border-white/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white leading-tight">
                {mode === 'signin' && 'Sign In to BrandGuard AI'}
                {mode === 'signup' && 'Create BrandGuard Account'}
                {mode === 'forgot_password' && 'Reset Account Password'}
                {mode === 'update_password' && 'Set New Password'}
                {mode === 'profile' && 'Workspace Account Profile'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                {mode === 'profile'
                  ? user?.email || 'Authenticated Session'
                  : 'Supabase Row-Level Security Workspace'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs for Sign In / Sign Up */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b1020] rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`py-2 rounded-lg font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 rounded-lg font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {(mode === 'signup' || mode === 'profile') && (
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Rostova"
                  maxLength={120}
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>
            </div>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'forgot_password') && (
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>
            </div>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'update_password') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">
                  {mode === 'update_password' ? 'New Password' : 'Password'}
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-violet-400 hover:text-violet-300 font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Minimum 8 characters'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>
            </div>
          )}

          {(mode === 'signup' || mode === 'update_password') && (
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Confirm Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'profile' && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-slate-300 font-medium">Account Security</p>
                <p className="text-[11px] text-slate-400">Update your session password</p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('update_password')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-violet-300 font-medium"
              >
                Change Password
              </button>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold rounded-lg transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-white/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'signin' && (submitting ? 'Signing In...' : 'Sign In')}
                {mode === 'signup' && (submitting ? 'Creating Account...' : 'Create Account')}
                {mode === 'forgot_password' &&
                  (submitting ? 'Sending Reset Email...' : 'Send Reset Instructions')}
                {mode === 'update_password' &&
                  (submitting ? 'Updating Password...' : 'Save New Password')}
                {mode === 'profile' && (submitting ? 'Saving...' : 'Save Display Name')}
              </span>
            </button>

            {mode === 'forgot_password' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-full py-2 text-slate-400 hover:text-white flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            {mode === 'profile' && (
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  onSuccessToast?.('Signed out');
                  onClose();
                }}
                className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-medium transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>

          {(mode === 'signin' || mode === 'signup') && (
            <p className="text-[11px] text-center text-slate-400 pt-1">
              Preview demo mode remains accessible without signing in. Sign in to persist Brand
              Profiles and Audit History to your private workspace.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
