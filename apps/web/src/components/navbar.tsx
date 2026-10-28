'use client'; // Next.js ko batate hain ki menu login aur khulne/band hone par browser mein badlega.

import React, { useState } from 'react';
import Link from 'next/link'; // Next ka Link pages ke beech jaane deta hai bina poori site dobara load kiye.
import { usePathname } from 'next/navigation'; // Abhi khule address ko padhkar usi menu ko chuna hua dikhate hain.
import { useAuth } from './auth-provider';
import { ShieldCheck, Menu, X, LogOut, User, FileText, BarChart3, Search } from 'lucide-react';

export function Navbar() {
  // Login ki jaankari se pata lagate hain ki kaunse menu links dikhane hain.
  const { user, isAuthenticated, logout } = useAuth();
  // Chhoti screen par menu khula hai ya band, yeh yaad rakhte hain.
  // React ka useState menu khula hai ya band, yeh yaad rakhta hai aur button dabne par menu phir dikhata hai.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Abhi ka page pata karke uske menu link ko chuna hua dikhate hain.
  const pathname = usePathname();

  // Pehchante hain ki logged-in user officer ya staff group mein aata hai.
  const isOfficial = user && ['OFFICER_TIER_1', 'COMMITTEE_TIER_2', 'OMBUDSMAN_TIER_3', 'AUDITOR', 'ADMIN'].includes(user.role);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Cryptographic Badge */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-extrabold text-white shadow-md shadow-indigo-600/30">
              VL
            </div>
            <span className="text-base font-bold tracking-tight text-white sm:text-lg">
              The Vishanti Ledger
            </span>
          </Link>
          <div className="hidden items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 sm:flex">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            <span>Cryptographic Chain Active</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-5 text-sm font-medium md:flex">
          <Link
            href="/transparency"
            className={`flex items-center space-x-1.5 transition hover:text-white ${
              pathname === '/transparency' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Public Ledger</span>
          </Link>

          <Link
            href="/track"
            className={`flex items-center space-x-1.5 transition hover:text-white ${
              pathname === '/track' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Track Receipt</span>
          </Link>

          {/* React ka ? : chunta hai ki login user ko uska menu mile ya login ke links. */}
          {isAuthenticated ? (
            <>
              {isOfficial ? (
                <Link
                  href="/officer/dashboard"
                  className={`rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20`}
                >
                  🛡️ Official Triage ({user?.role.replace('_', ' ')})
                </Link>
              ) : (
                <>
                  <Link
                    href="/intake"
                    className={`flex items-center space-x-1 text-slate-400 transition hover:text-white ${
                      pathname === '/intake' ? 'text-indigo-400 font-semibold' : ''
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>File Petition</span>
                  </Link>

                  <Link
                    href="/dashboard"
                    className={`text-slate-400 transition hover:text-white ${
                      pathname === '/dashboard' ? 'text-indigo-400 font-semibold' : ''
                    }`}
                  >
                    My Dashboard
                  </Link>
                </>
              )}

              {/* User badge & Logout */}
              <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
                <div className="flex items-center space-x-2 text-xs text-slate-300">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <span className="max-w-[120px] truncate font-medium">{user?.name || user?.email}</span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2.5">
              <Link
                href="/intake?mode=anonymous"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Anonymous File
              </Link>
              <Link
                href="/auth/login"
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Portal Login
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-3 md:hidden">
          <Link
            href="/transparency"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 py-1"
          >
            📊 Public Ledger
          </Link>
          <Link
            href="/track"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 py-1"
          >
            🔍 Track Receipt
          </Link>
          <Link
            href="/intake?mode=anonymous"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-amber-400 py-1"
          >
            🛡️ File Anonymously
          </Link>
          {isAuthenticated ? (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{user?.name || user?.email}</span>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="text-xs text-rose-400 font-medium"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800">
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white"
              >
                Sign In / Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
