// Next.js app/page.tsx ko website ka pehla address, yani /, bana deta hai.
export default function HomePage() {
  // Pehla page project ka kaam samjhata hai aur complaint, tracking ke raaste dikhata hai.
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-10 text-center">
      {/* Hero Badge */}
      <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-400">
        WEBSTER 2026 • Problem Statement 03
      </div>

      {/* Hero Header */}
      <div className="max-w-3xl space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
          Zero-Tamper Grievance Redressal for Academic Institutions
        </h1>
        <p className="text-lg text-slate-400 sm:text-xl">
          Every complaint, status change, and official comment is cryptographically chained with SHA-256. 
          Enforced by deterministic state machines, automated SLA escalations, and structural anonymity.
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <a
          href="/intake?mode=anonymous"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          🛡️ File Anonymous Petition
        </a>
        <a
          href="/track"
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-6 py-3.5 text-base font-semibold text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600"
        >
          🔍 Track Petition via Receipt
        </a>
      </div>

      {/* Architecture Highlights Grid */}
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 pt-10 text-left sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="text-2xl mb-2">⛓️</div>
          <h3 className="text-lg font-bold text-white">SHA-256 Hash Chained</h3>
          <p className="mt-1 text-sm text-slate-400">
            Append-only audit trail at the database level. Any retroactive edits break future cryptographic hashes.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="text-2xl mb-2">⏱️</div>
          <h3 className="text-lg font-bold text-white">Automated SLA Escalation</h3>
          <p className="mt-1 text-sm text-slate-400">
            Overdue tickets escalate automatically (Officer → Committee → Ombudsman) through durable BullMQ background workers.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="text-2xl mb-2">🧠</div>
          <h3 className="text-lg font-bold text-white">Local AI Semantic Triage</h3>
          <p className="mt-1 text-sm text-slate-400">
            Local Transformers.js embeddings with pgvector cluster recurring systemic issues without leaking confidential student data.
          </p>
        </div>
      </div>
    </div>
  );
}
