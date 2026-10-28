'use client'; // Browser me interactive popup modal chalane ke liye

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Copy, Check, Download, ArrowRight, Key } from 'lucide-react';

// TS CONCEPT (interface ReceiptModalProps):
// Is React component ko parent page se jo props (inputs) milte hain, unka structure
interface ReceiptModalProps {
  isOpen: boolean;        // Modal open hai ya band (true/false)
  ticketId: string;      // Generated Ticket UUID
  receiptSecret: string; // 32-byte secret code jo user ko copy karna hai
  title: string;         // Complaint ka title
}

export function ReceiptModal({
  isOpen,
  ticketId,
  receiptSecret,
  title,
}: ReceiptModalProps) {
  const router = useRouter();             // Next.js page navigation hook
  const [copied, setCopied] = useState(false); // State: Copy button clicked hua ya nahi

  // Agar modal open nahi hai toh kuch bhi render mat karo
  if (!isOpen) return null;

  // handleCopy: Browser clipboard me secret key copy karta hai aur 2.5s ke liye 'Copied' state dikhata hai
  const handleCopy = () => {
    navigator.clipboard.writeText(receiptSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // handleDownloadTxt: Browser ke andar hi direct .txt file generate karke auto-download karwata hai
  const handleDownloadTxt = () => {
    const textContent = `=====================================================
THE VISHANTI LEDGER - ANONYMOUS PETITION RECEIPT
=====================================================
Ticket Title: ${title}
Ticket UUID: ${ticketId}
Receipt Secret: ${receiptSecret}
Filed At: ${new Date().toISOString()}

CRITICAL INSTRUCTIONS:
This receipt secret is your ONLY credential to track your petition
and exercise your 72-hour dispute window if dissatisfied.
The system does NOT store your identity, IP, or raw secret.
If you lose this key, your case cannot be recovered.
=====================================================`;

    // JavaScript Blob: Text ko file stream me convert karta hai
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vishanti-receipt-${ticketId.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // handleProceed: User ko secret key ke saath tracking page par le jata hai
  const handleProceed = () => {
    router.push(`/track?key=${encodeURIComponent(receiptSecret)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-6 sm:p-8">
        
        {/* Warning Badge Header */}
        <div className="flex items-start space-x-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Save Your Anonymous Receipt Secret
            </h2>
            <p className="mt-0.5 text-xs text-amber-300 font-medium">
              One-Time Cryptographic Token • Never Shown Again
            </p>
          </div>
        </div>

        {/* Advisory Box */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300 leading-relaxed">
          <p>
            Your petition has been recorded in the ledger at <strong>Sequence #0 (FILED)</strong>. Because you selected <strong>Anonymous Mode</strong>, no name, email, or IP address is associated with this record.
          </p>
          <p className="mt-2 text-amber-400/90 font-medium">
            ⚠️ You MUST copy or download this secret code now. It is required to view status updates and file disputes.
          </p>
        </div>

        {/* Receipt Code Display */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Key className="h-3.5 w-3.5 text-amber-400" />
            <span>32-Byte Receipt Secret Key</span>
          </label>
          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950 p-2.5">
            <code className="flex-1 font-mono text-xs text-amber-300 break-all select-all px-2">
              {receiptSecret}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-2 flex items-center space-x-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            <Download className="h-4 w-4" />
            <span>Download Receipt File (.txt)</span>
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
          >
            <span>I Have Saved It • Track Case</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
