'use client';

import React from 'react';
import { Status } from '@vishanti/shared';
import { Check, Clock, AlertTriangle, ShieldAlert, Sparkles, FileText, UserCheck, Search } from 'lucide-react';

interface StatusStepperProps {
  currentStatus: Status;
  currentTier: number; // 1 = Officer, 2 = Committee, 3 = Ombudsman
}

interface StepConfig {
  status: Status;
  label: string;
  subLabel: string;
}

const STEPS: StepConfig[] = [
  { status: 'FILED', label: 'Filed', subLabel: 'Genesis Seq #0' },
  { status: 'ASSIGNED', label: 'Assigned', subLabel: 'AI Triage Routed' },
  { status: 'IN_REVIEW', label: 'In Review', subLabel: 'Active Investigation' },
  { status: 'RESOLVED', label: 'Resolved', subLabel: '72h Dispute Window' },
];

export function StatusStepper({ currentStatus, currentTier }: StatusStepperProps) {
  const isEscalated = currentStatus === 'ESCALATED';

  // Get current step index for linear progression
  const getStepIndex = (status: Status) => {
    switch (status) {
      case 'FILED': return 0;
      case 'ASSIGNED': return 1;
      case 'IN_REVIEW': return 2;
      case 'RESOLVED': return 3;
      case 'ESCALATED': return 2; // Branches out of in review / assigned
      default: return 0;
    }
  };

  const activeIndex = getStepIndex(currentStatus);

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 1: return 'Tier 1: Redressal Officer';
      case 2: return 'Tier 2: Escalation Committee';
      case 3: return 'Tier 3: Ombudsman';
      default: return `Tier ${tier}`;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
      
      {/* Top Header with Tier & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Current Lifecycle State
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <h2 className="text-xl font-extrabold text-white">
              {isEscalated ? 'ESCALATED TO HIGHER AUTHORITY' : currentStatus.replace('_', ' ')}
            </h2>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              {getTierLabel(currentTier)}
            </span>
          </div>
        </div>

        {/* Dynamic Status Pill */}
        {isEscalated ? (
          <div className="flex items-center space-x-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-300 animate-pulse">
            <ShieldAlert className="h-4 w-4" />
            <span>Escalation Protocol Active</span>
          </div>
        ) : currentStatus === 'RESOLVED' ? (
          <div className="flex items-center space-x-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
            <Check className="h-4 w-4" />
            <span>Officially Resolved</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-300">
            <Clock className="h-4 w-4" />
            <span>Under Active Redressal</span>
          </div>
        )}
      </div>

      {/* Stepper Progress Bar */}
      <div className="relative pt-2">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIndex || (idx === 3 && currentStatus === 'RESOLVED');
            const isCurrent = idx === activeIndex && !isEscalated;

            return (
              <div key={step.status} className="flex flex-col items-center text-center space-y-2">
                
                {/* Circle Icon Indicator */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                      ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-4 ring-indigo-500/20'
                      : 'border-slate-800 bg-slate-950 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 stroke-[2.5]" />
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>

                {/* Labels */}
                <div>
                  <p
                    className={`text-xs font-bold ${
                      isCurrent || isCompleted ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="hidden text-[10px] text-slate-400 sm:block">
                    {step.subLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Escalated Callout Branch (if status is ESCALATED) */}
        {isEscalated && (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-300">
                  Case Escalated to Authority Level {currentTier} ({getTierLabel(currentTier)})
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Triggered due to either an automated SLA timer expiration or a petitioner dispute within the 72-hour window. A fresh SLA clock has been initiated for this tier.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
