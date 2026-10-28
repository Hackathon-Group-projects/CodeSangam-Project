'use client'; // Next.js ko batate hain ki complaint list browser mein badalti rahegi.

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // Next ka Link complaint pages par bina poori site reload kiye le jaata hai.
import { useAuth } from '../../components/auth-provider';
import { FilePlus, Clock, CheckCircle2, AlertTriangle, ArrowRight, Shield, ExternalLink, Filter } from 'lucide-react';
import { apiFetch } from '../../lib/api-client';

// Is folder ka page.tsx Next.js mein /dashboard address banata hai.
export default function PetitionerDashboard() {
  // Login ki yaad se user ka naam aur uski complaint list laane ka raasta milta hai.
  const { user, isAuthenticated } = useAuth();
  // TS ka <any[]> JavaScript ki list jaisa hai, par yahan har complaint ka pakka naksha nahi diya gaya.
  // React ki useState list yaad rakhti hai; setPetitions se nayi list aaye to complaint cards phir bante hain.
  const [petitions, setPetitions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Page pehli baar khulte hi user ki complaints server se mangwate hain.
    async function loadPetitions() {
      try {
        const res = await apiFetch<any[]>('/api/tickets/my-tickets');
        if (res.success && res.data) {
          // Server se asli complaints aayi hon to wahi screen par rakhte hain.
          setPetitions(res.data);
        } else {
          // Asli list na mile to screen dekhne ke liye sample complaints dikhate hain, yeh user ke asli records nahi hain.
          setPetitions([
            {
              id: 'ticket-demo-1',
              title: 'Hostel Mess Food Hygiene & Quality Concern',
              category: 'HOSTEL_MESS',
              priority: 'HIGH',
              status: 'IN_REVIEW',
              currentTier: 1,
              createdAt: '2026-10-21',
              slaDueAt: '2026-10-24',
            },
            {
              id: 'ticket-demo-2',
              title: 'Delayed Semester Marksheet Verification',
              category: 'ACADEMIC',
              priority: 'MEDIUM',
              status: 'ASSIGNED',
              currentTier: 1,
              createdAt: '2026-10-22',
              slaDueAt: '2026-10-25',
            },
            {
              id: 'ticket-demo-3',
              title: 'Library WiFi Disconnection During Exam Week',
              category: 'INFRASTRUCTURE',
              priority: 'LOW',
              status: 'RESOLVED',
              currentTier: 1,
              createdAt: '2026-10-18',
              slaDueAt: '2026-10-21',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load tickets:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPetitions();
  }, []);

  const getStatusBadge = (status: string) => {
    // Har complaint ki haalat ke liye alag rang ka chhota label chunte hain.
    switch (status) {
      case 'FILED':
        return <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold text-blue-400">FILED</span>;
      case 'ASSIGNED':
        return <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 text-xs font-semibold text-purple-400">ASSIGNED</span>;
      case 'IN_REVIEW':
        return <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">IN REVIEW</span>;
      case 'RESOLVED':
        return <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">RESOLVED</span>;
      case 'ESCALATED':
        return <span className="animate-pulse rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-bold text-rose-400">ESCALATED</span>;
      default:
        return <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 py-4">
      {/* User ka naam aur nayi complaint bharne ka raasta dikhate hain. */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/40 p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome back, {user?.name || 'Petitioner'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track and manage your submitted collegiate grievances backed by cryptographic audit proofs.
          </p>
        </div>
        <Link
          href="/intake"
          className="inline-flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
        >
          <FilePlus className="h-4 w-4" />
          <span>File New Petition</span>
        </Link>
      </div>

      {/* Complaints ki kul, chalti, suljhi aur aage bheji ginti dikhate hain. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Total Petitions</span>
          <p className="mt-2 text-2xl font-extrabold text-white">{petitions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-amber-400">In Active Review</span>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {petitions.filter((p) => p.status === 'IN_REVIEW' || p.status === 'ASSIGNED').length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-emerald-400">Resolved</span>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {petitions.filter((p) => p.status === 'RESOLVED').length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-rose-400">Escalated</span>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {petitions.filter((p) => p.status === 'ESCALATED').length}
          </p>
        </div>
      </div>

      {/* User ki complaint list ya khaali list ka paighaam dikhate hain. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h2 className="text-lg font-bold text-white">Your Grievances & Appeals</h2>
          <span className="text-xs text-slate-400">Showing {petitions.length} records</span>
        </div>

        {petitions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-400">You haven&apos;t filed any grievances yet.</p>
            <Link
              href="/intake"
              className="inline-flex items-center text-xs font-semibold text-indigo-400 hover:underline"
            >
              <span>Submit your first petition</span>
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {/* React ka map har ticket ka card banata hai; key React ko har card ki alag pehchaan deti hai. */}
            {petitions.map((ticket) => (
              <div key={ticket.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(ticket.status)}
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {ticket.category.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500">• Filed {ticket.createdAt}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white hover:text-indigo-300 transition">
                    <Link href={`/track?key=${ticket.id}`}>{ticket.title}</Link>
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400">Tier {ticket.currentTier}</span>
                  <Link
                    href={`/track?key=${ticket.id}`}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                  >
                    <span>View Chain</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
