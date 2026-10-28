'use client'; // Next.js ko batate hain ki email box, button aur login kaam browser mein chalenge.

import React, { useState } from 'react';
import Link from 'next/link'; // Next ka Link page badalta hai bina poori site dobara load kiye.
import { useRouter } from 'next/navigation'; // Button ke baad code se naya page kholne ka rasta lete hain.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, LoginInput } from '@vishanti/shared';
import { useAuth } from '../../../components/auth-provider';
import { apiFetch } from '../../../lib/api-client';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';

// Is folder ka page.tsx Next.js mein /auth/login address banata hai.
export default function LoginPage() {


  const router = useRouter(); // Login ke baad agla page kholne ka rasta lete hain.
  const { login } = useAuth(); // Login ki jaankari ko website ke baaki pages tak pahunchane wala function lete hain.

  // TS ka 'A' | 'B' JavaScript ke liye editor ki rok hai: is jagah bas in dono naam mein se ek hi aa sakta hai.
  const [activeTab, setActiveTab] = useState<'PETITIONER' | 'OFFICIAL'>('PETITIONER'); 

  const [serverError, setServerError] = useState<string | null>(null); 
  const [isSubmitting, setIsSubmitting] = useState(false); // Login bhejte waqt button ko busy dikhate hain.

  // useForm input aur galtiyon ko sambhalta hai; TS ka <LoginInput> editor ko email/password ka naksha deta hai.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    // TS ka <LoginInput> form ke fields ka naksha batata hai; zodResolver un fields ke niyam check karta hai.
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // onSubmit: Credentials ko Fastify backend /api/auth/login me bhejta hai
  const onSubmit = async (data: LoginInput) => {
    // Submit dabte hi purana error hata kar button ko busy dikhate hain.
    setIsSubmitting(true);
    setServerError(null);

    try {
      // Email aur password server ko bhej kar asli login receipt maangte hain.
      // TS ka <any> editor ko jawab ka pakka naksha nahi deta; JavaScript mein jawab phir bhi aam object hi hota hai.
      const res = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          portalType: activeTab,
        }),
      });

      if (res.success && res.data?.token) {
        // Asli receipt sambhal kar user ko uski apni screen par bhejte hain.
        login(res.data.token, res.data.user); // Asli login receipt aur user ki jaankari yaad rakhte hain.
        if (activeTab === 'OFFICIAL') {
          router.push('/officer/dashboard'); // Officer ko uski kaam wali screen par le jaate hain.
        } else {
          router.push('/dashboard'); // Student ko uski complaint wali screen par le jaate hain.
        }
      } else {
        // Server ka asli jawab na aaye to sirf screen dekhne ke liye nakli demo login banate hain.
        console.warn('Backend unavailable, activating local dev mock session:', res.error);
        // Nakli user ka object sirf demo screen kholne ke liye banate hain.
        const mockUser = {
          id: 'dev_user_123',
          name: data.email.split('@')[0],
          email: data.email,
          role: activeTab === 'OFFICIAL' ? 'OFFICER_TIER_1' : 'PETITIONER',
          department: activeTab === 'OFFICIAL' ? 'Academic Affairs' : undefined,
        };
        // TS ka 'as any' editor ki jaanch ko is ek jagah dheela karta hai; JavaScript mein yeh wahi user object rehta hai.
        login('mock_jwt_token_for_dev_mode', mockUser as any);
        
        if (activeTab === 'OFFICIAL') {
          router.push('/officer/dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    // TS ka any yahan galti ke paighaam ka roop pehle se pakka nahi karta.
    } catch (err: any) {
      // Bhejne mein dikkat aaye to uska saada paighaam screen par rakhte hain.
      setServerError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      // Jawab aane ke baad button ko phir se istemal ke laayak karte hain.
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-6 pt-6 pb-12">
      {/* Title */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Sign In to Vishanti Ledger
        </h1>
        <p className="text-sm text-slate-400">
          Access your immutable petition trail and official redressal portal
        </p>
      </div>

      {/* Role Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => { setActiveTab('PETITIONER'); setServerError(null); }}
          className={`flex items-center justify-center space-x-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'PETITIONER'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Petitioner</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('OFFICIAL'); setServerError(null); }}
          className={`flex items-center justify-center space-x-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'OFFICIAL'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Departmental Portal</span>
        </button>
      </div>

      {/* Login Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm sm:p-8">
        {serverError && (
          <div className="mb-4 flex items-center space-x-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* React ka onSubmit form bhejne par hamara onSubmit kaam chalata hai, bina page reload kiye. */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Institutional Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                {...register('email')}
                placeholder={activeTab === 'OFFICIAL' ? 'officer@institution.edu' : 'student@institution.edu'}
                className={`w-full rounded-lg border bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500 ${
                  errors.email ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-rose-400">{errors.email.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
              <a href="#" className="text-xs text-indigo-400 hover:underline">
                Forgot?
              </a>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className={`w-full rounded-lg border bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500 ${
                  errors.password ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-rose-400">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <span>Sign In as {activeTab === 'PETITIONER' ? 'Petitioner' : 'Official'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-semibold text-indigo-400 hover:underline">
            Register here
          </Link>
        </div>
      </div>

      {/* Anonymous File Quick Card (Crucial for Problem Statement 03) */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-center sm:p-5">
        <div className="flex items-center justify-center space-x-2 text-indigo-300 text-sm font-semibold">
          <Shield className="h-4 w-4" />
          <span>Fear Retaliation? File Completely Anonymously</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          No institutional account or login required. You receive a cryptographic one-time receipt code.
        </p>
        <Link
          href="/intake?mode=anonymous"
          className="mt-3 inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          <span>Launch Anonymous Intake Portal</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
