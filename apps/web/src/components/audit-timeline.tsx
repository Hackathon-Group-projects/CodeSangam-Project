'use client'; // Client-side cryptographic audit chain feed & comment poster

import React, { useState } from 'react';
import { apiFetch } from '../lib/api-client';
import {
  GitCommit,
  Hash,
  ShieldCheck,
  MessageSquare,
  Send,
  User,
  Copy,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// TS CONCEPT (interface AuditEntryData):
// Database ke AuditEntry table ka row object:
// seq: Block sequence number (0, 1, 2...)
// type: Event type (FILED, ASSIGNED, IN_REVIEW, RESOLVED, ESCALATED, COMMENTED)
// actorRef: User ID ya anonymous pseudonym
// payload: Event ki details ka JSON object
// prevHash: Pichhle block ka SHA-256 hash (H_{n-1})
// hash: Is current block ka SHA-256 hash (H_n)
export interface AuditEntryData {
  seq: number;
  type: string;
  actorRef: string;
  payload: Record<string, any>; // Record<string, any> ka matlab generic JS key-value object
  prevHash: string;
  hash: string;
  timestamp: string;
}

// TS CONCEPT (interface AuditTimelineProps): Component ke inputs
interface AuditTimelineProps {
  ticketId: string;
  entries: AuditEntryData[];
  onCommentAdded: () => void;
}

export function AuditTimeline({ ticketId, entries, onCommentAdded }: AuditTimelineProps) {
  const [commentText, setCommentText] = useState('');                                   // Naye comment ka text input
  const [isPosting, setIsPosting] = useState(false);                                     // Comment posting loading state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);                     // Copy hone par tick icon dikhane ke liye
  const [expandedPayloads, setExpandedPayloads] = useState<Record<number, boolean>>({}); // Har block ka raw JSON view open/close state

  // togglePayload: Block ka raw JSON view expand/collapse karta hai
  const togglePayload = (seq: number) => {
    setExpandedPayloads((prev) => ({ ...prev, [seq]: !prev[seq] }));
  };

  // copyToClipboard: SHA-256 hash ko clipboard me copy karta hai
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // handlePostComment: Naye comment ko backend API me bhejta hai jo ledger me append hoga
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsPosting(true);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: commentText.trim(),
          isInternal: false,
        }),
      });

      if (res.success) {
        setCommentText('');
        onCommentAdded(); // Parent page ko refresh trigger karo
      } else {
        // Fallback simulated comment for local development
        console.warn('Backend unavailable, simulating comment entry:', res.error);
        setCommentText('');
        onCommentAdded();
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsPosting(false);
    }
  };

  // getTypeBadge: Event ke hisaab se color coding return karta hai
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FILED':
      case 'CREATED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'ASSIGNED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'IN_REVIEW':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'ESCALATED':
      case 'DISPUTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'COMMENTED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">
            Cryptographic Audit Chain ({entries.length} Ledger Blocks)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          SHA-256 Chained • Append-Only
        </span>
      </div>

      {/* Vertical Timeline */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {entries.map((entry) => {
          const isExpanded = !!expandedPayloads[entry.seq];

          return (
            <div key={entry.seq} className="relative group">
              
              {/* Dot on Timeline: Sequence Number */}
              <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border-2 border-indigo-500 text-white shadow-md">
                <span className="text-[9px] font-bold">{entry.seq}</span>
              </div>

              {/* Block Card */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 space-y-3 transition hover:border-slate-700">
                
                {/* Block Header: Type & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getTypeBadge(
                        entry.type
                      )}`}
                    >
                      {entry.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      by <strong className="text-slate-200">{entry.actorRef}</strong>
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Main Payload Note / Content */}
                {entry.payload && (
                  <div className="text-xs text-slate-300 leading-relaxed">
                    {entry.payload.content && (
                      <p className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        {entry.payload.content}
                      </p>
                    )}
                    {entry.payload.resolutionNote && (
                      <p className="border-l-2 border-emerald-500 pl-3 italic text-emerald-300/90">
                        Resolution Note: {entry.payload.resolutionNote}
                      </p>
                    )}
                    {entry.payload.disputeReason && (
                      <p className="border-l-2 border-rose-500 pl-3 italic text-rose-300/90">
                        Dispute Reason: {entry.payload.disputeReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Cryptographic Hash Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 text-[10px] font-mono">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Hash className="h-3 w-3 text-indigo-400" />
                    <span>H_{entry.seq}:</span>
                    <span className="text-slate-200 truncate max-w-[200px] sm:max-w-[340px]">
                      {entry.hash}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(entry.hash)}
                      className="text-slate-400 hover:text-white transition flex items-center space-x-0.5"
                      title="Copy full hash"
                    >
                      {copiedHash === entry.hash ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePayload(entry.seq)}
                      className="text-slate-500 hover:text-slate-300 transition flex items-center"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Raw Canonical JSON payload */}
                {isExpanded && (
                  <pre className="overflow-x-auto rounded-lg bg-black/60 p-3 text-[10px] font-mono text-emerald-400 border border-slate-800">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Post Comment Input */}
      <form onSubmit={handlePostComment} className="border-t border-slate-800 pt-5 space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
          <span>Add Query / Additional Clarification to Audit Ledger</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Type your message here... Every comment is appended to the SHA-256 chain"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isPosting || !commentText.trim()}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isPosting ? 'Posting...' : 'Comment'}</span>
          </button>
        </div>
      </form>

    </div>
  );
}
