'use client';

import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, Building2, ArrowRight, AlertCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signErr) {
        setError(
          'Invalid email or confidential password. Check the auto-generated credentials sent to your Carrybee email.'
        );
        return;
      }
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleOAuth() {
    setError(null);
    setOauthLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (oauthErr) {
        setError(
          'Use your emailed confidential password to sign in (or enable Google OAuth client in Supabase Auth settings).'
        );
        setOauthLoading(false);
      }
    } catch {
      setOauthLoading(false);
    }
  }

  return (
    <div className="app-shell login-shell min-h-screen flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="premium-logo flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E3A8A] text-white">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Carrybee Commercial Operations
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
              Lead Bank &amp; Merchant COD Portal
            </h1>
          </div>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-7">
          <div className="mb-6 border-b border-[#E2E8F0] pb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">Authorized Team Sign-In</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#475569]">
              Sign in with your Carrybee email and the confidential auto-generated password
              delivered directly to your inbox.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold text-[#334155]"
              >
                Carrybee Email Address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@carrybee.com"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] placeholder-[#94A3B8] transition-colors duration-150 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-[#334155]"
              >
                Auto-Generated Confidential Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password from your email"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 font-mono text-sm text-[#0F172A] placeholder-[#94A3B8] transition-colors duration-150 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Lead Bank'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#64748B]">
              Or Workspace OAuth
            </span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleOAuth}
            disabled={oauthLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] transition-colors duration-150 hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <span>{oauthLoading ? 'Redirecting...' : 'Continue with Google OAuth'}</span>
          </button>

          <div className="mt-6 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]"
                aria-hidden="true"
              />
              <div className="text-[11px] leading-relaxed text-[#475569]">
                <p className="font-semibold text-[#0F172A]">Zero-Knowledge Lead &amp; Password Isolation</p>
                <p className="mt-0.5">
                  Passwords are encrypted in Supabase and purged from Sent Mail upon delivery. Your
                  Lead Bank rows are strictly isolated to your personal account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
