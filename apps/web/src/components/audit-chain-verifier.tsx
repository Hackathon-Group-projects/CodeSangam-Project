'use client'; // Next.js ko batate hain ki user ka input aur button browser mein chalenge.

import { type FormEvent, useState } from 'react'; // Form bhejne aur screen ka haal yaad rakhne ke React tools lete hain.
import { AlertTriangle, CheckCircle2, LoaderCircle, Search, ShieldCheck, X } from 'lucide-react'; // Check, wait aur search ke icons lete hain.
import { apiFetch } from '../lib/api-client'; // API se ledger entries mangwane wala helper lete hain.
import { type AuditEntryForVerification, verifyAuditChain } from '../lib/audit-verifier'; // Entry ka TS naksha aur seal check karne wala browser helper lete hain.

// Ticket code dekar uski public audit chain ko check karne wala box banate hain.
export function AuditChainVerifier() {
  // React ke useState se form, popup aur jawab yaad rehte hain; badalne par naya haal screen par dikh jata hai.
  const [ticketId, setTicketId] = useState(''); // User jo ticket code likhega use yahan yaad rakhte hain.
  const [busy, setBusy] = useState(false); // Check chal raha hai ya nahi dikhane ke liye nishani rakhte hain.
  const [open, setOpen] = useState(false); // Check wala chhota modal khula hai ya band, yeh yaad rakhte hain.
  const [error, setError] = useState(''); // API na mile ya ticket na mile to wajah rakhte hain.
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyAuditChain>> | null>(null); // Check ka final jawab yaad rakhte hain; TS is jawab ka roop khud nikalta hai.

  // Button dabne par API se entries lekar har entry ki seal browser mein jaanchte hain.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // Browser ko form bhejkar page reload karne se rokte hain.
    const cleanId = ticketId.trim(); // Aage-peeche ke khaali spaces hata dete hain.
    if (!cleanId) return; // Khaali code bhejne ka faayda nahi, isliye rukte hain.
    setBusy(true); // Check poora hone tak button par wait dikhate hain.
    setError(''); // Purana error hata dete hain.
    setResult(null); // Purana jawab hata dete hain.
    const response = await apiFetch<AuditEntryForVerification[]>(`/api/tickets/${encodeURIComponent(cleanId)}/audit`); // Is ticket ki ledger entries API se mangwate hain.
    if (!response.success || !Array.isArray(response.data)) { // Jawab theek list na ho to user ko batate hain.
      setError(response.error || 'The public audit record could not be loaded.'); // API ka error ya seedha sandesh rakhte hain.
      setBusy(false); // Request khatam hone par wait band karte hain.
      return; // Check karne ke liye entries hi nahi to aage nahi badhte.
    }
    try {
      setResult(await verifyAuditChain(response.data, cleanId)); // Browser se har seal dobara banwakar jawab screen par rakhte hain.
    } catch {
      setError('This browser could not run the record check. Please try a recent browser.'); // Browser hash na bana sake to simple baat batate hain.
    }
    setBusy(false); // Jawab aane ke baad wait band karte hain.
  }

  // Checker ka box aur uske natije screen par dikhate hain.
  return <>
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
    {/* Heading aur seedhi zubaan mein tool ka kaam batate hain. */}
    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-semibold text-white">Check a ticket record</h2><p className="mt-1 text-xs text-slate-500">We compare every saved entry with a fresh seal made in your browser.</p></div></div>
    {/* User code dale aur button dabaye to record check hota hai. */}
    <button onClick={() => setOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"><Search className="h-4 w-4" /> Open record checker</button>
    </section>
    {open && <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="audit-modal-title" className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 id="audit-modal-title" className="font-semibold text-white">Check a ticket record</h2><p className="mt-1 text-xs text-slate-500">Enter a ticket ID to check the saved record chain.</p></div><button onClick={() => setOpen(false)} aria-label="Close record checker" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div>
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row"><label htmlFor="audit-ticket-id" className="sr-only">Ticket ID</label><input id="audit-ticket-id" value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="Paste ticket ID" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" /><button disabled={busy || !ticketId.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Checking…</> : <><Search className="h-4 w-4" /> Verify record</>}</button></form>
    {/* Check na ho paye to error ko alag rang mein dikhate hain. */}
    {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
    {/* Sahi chain ho to kitni entries check hui, woh batate hain. */}
    {result?.valid && <div role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /><div><p className="text-sm font-semibold text-emerald-200">Chain intact — {result.checked} entries match</p><p className="mt-1 text-xs leading-5 text-slate-400">The saved entries match each other and the data returned by the ledger.</p></div></div>}
    {/* Chain mein dikkat ho to kis number par hui, seedha dikhate hain. */}
    {result && !result.valid && <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" /><div><p className="text-sm font-semibold text-rose-200">Chain mismatch — a record may be changed or missing</p><p className="mt-1 text-xs leading-5 text-slate-400">{result.reason}{result.failedSeq !== undefined ? ` Problem at entry ${result.failedSeq}.` : ''} Checked before the problem: {result.checked}.</p></div></div>}
      </section>
    </div>}
  </>;
}
