import type { ReactNode } from 'react'; // TS ko batate hain ki metric card ke andar icon jaisa React visual aa sakta hai.
import { AlertTriangle, BarChart3, Clock3, ShieldCheck, Users } from 'lucide-react'; // Public page par dikhne wale chhote icons lete hain.
import { AuditChainVerifier } from '../../components/audit-chain-verifier'; // Browser mein ticket chain janchne wala modal lete hain.
import { TransparencyCharts } from '../../components/transparency-charts'; // Browser mein banne wale charts ka hissa lete hain.

// Next.js ko kehte hain ki is public page ki server copy har 60 second mein taaza ho.
export const revalidate = 60;

// Server ka pata environment mein diya ho to lete hain, warna local API istemal hoti hai.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// TS mein yeh interface public numbers ka naksha hai; JavaScript mein yeh saamanya object hota.
type PublicMetrics = {
  totals: { filed: number; resolved: number; active: number; escalated: number }; // Alag-alag haal ke total case numbers.
  averageResolutionHours: number | null; // Case solve hone ka ausat samay, ya abhi data nahi.
  slaCompliancePercent: number | null; // Waqt par hue kaam ka pratishat, ya abhi data nahi.
  resolutionVelocity: Array<{ tier: number; averageHours: number }>; // Har adhikari star par case solve hone ka ausat samay.
  categoryTrends: Array<{ category: string; count: number }>; // Har vishay ke case ki ginti.
  tierCompliance: Array<{ tier: number; compliant: number; breached: number }>; // Har authority star par time par aur late cases.
  clusters: Array<{ id: string; label: string; count: number; sentiment: number }>; // AI se mile common themes, bina complaint text ke.
  merkleRoot: { hash: string; timestamp: string } | null; // Roz ka public ledger seal, agar bana ho.
};

// Sirf jama hue kul numbers laate hain; koi vyakti ya uski complaint nahi mangwate.
async function getMetrics(): Promise<PublicMetrics | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/metrics`, { next: { revalidate: 60 } }); // Public numbers ki list API se lete hain aur use 60 second ke liye dobara istemal kar sakte hain.
    if (!response.ok) return null; // API theek jawab na de to nakli numbers dikhane se bachate hain.
    const payload = await response.json(); // Server ke jawab ko JavaScript object mein padhte hain.
    return payload.data ?? payload; // Jawab data dabbe ke andar ho to use, warna seedha jawab lete hain.
  } catch {
    return null; // API band ho to page phir bhi khulta hai aur unavailable batata hai.
  }
}

// Yeh server page pehle metrics mangwata hai, phir browser ko taiyar page deta hai.
export default async function TransparencyPage() {
  const metrics = await getMetrics(); // Page dikhane se pehle public numbers laate hain.
  return <main className="space-y-7 py-3">
    {/* Intro batata hai ki page par sirf jama numbers hain. */}
    <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6 sm:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><BarChart3 className="h-4 w-4" /> Public transparency ledger</div>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Institution-wide redressal, in the open</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Aggregated case outcomes and service levels. Individual petition text, identities, and attachments are never shown here.</p></div>
        {metrics?.merkleRoot && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:max-w-sm"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-4 w-4" /> Latest ledger checkpoint</div><code className="mt-2 block break-all font-mono text-[10px] text-slate-300">{metrics.merkleRoot.hash}</code><p className="mt-1 text-[10px] text-slate-500">Published {new Date(metrics.merkleRoot.timestamp).toLocaleString()}</p></div>}
      </div>
    </header>

    {/* API na ho to asli data na hone ki baat saaf batate hain. */}
    {!metrics ? <section role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div><h2 className="font-semibold text-amber-200">Public metrics are not available yet</h2><p className="mt-1 text-sm leading-6 text-slate-400">This page refreshes automatically when the public metrics endpoint is connected. No sample or private case data is displayed.</p></div></div></section> : <>
      {/* Chaar cards petition, solution, khule case aur deadline performance ka haal dikhate hain. */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Petitions filed" value={metrics.totals.filed} icon={<Users className="h-4 w-4" />} />
        <Metric label="Resolved" value={metrics.totals.resolved} icon={<ShieldCheck className="h-4 w-4" />} />
        <Metric label="Active cases" value={metrics.totals.active} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="SLA compliance" value={metrics.slaCompliancePercent == null ? '—' : `${metrics.slaCompliancePercent}%`} icon={<BarChart3 className="h-4 w-4" />} />
      </section>

      {/* Do charts browser mein chalte hain, jahan chart ki drawing library kaam karti hai. */}
      <TransparencyCharts resolutionVelocity={metrics.resolutionVelocity} categoryTrends={metrics.categoryTrends} />

      {/* Yeh hissa tier deadline aur AI ke common themes dikhata hai. */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><h2 className="font-semibold text-white">SLA compliance by authority tier</h2><p className="mt-1 text-xs text-slate-500">Aggregate counts only</p><div className="mt-5 space-y-4">{metrics.tierCompliance.map((item) => { const total = item.compliant + item.breached; const ratio = total ? Math.round(item.compliant / total * 100) : 0; return <div key={item.tier}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">Tier {item.tier}</span><span className="text-slate-500">{item.compliant} on time · {item.breached} breached</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio}%` }} /></div></div>; })}</div>{metrics.averageResolutionHours != null && <p className="mt-5 text-xs text-slate-400">Average resolution time: <strong className="text-slate-200">{metrics.averageResolutionHours} hours</strong></p>}</div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-300" /><h2 className="font-semibold text-white">Recurring themes</h2></div><p className="mt-1 text-xs text-slate-500">AI groups similar complaints; individual petition details stay private.</p>{metrics.clusters.length ? <div className="mt-4 space-y-3">{metrics.clusters.map((cluster) => <article key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-medium text-slate-200">{cluster.label}</h3><span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-300">{cluster.count} cases</span></div><p className="mt-2 text-[11px] text-slate-500">Aggregate distress signal: {Math.round(cluster.sentiment * 100)}%</p></article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">No recurring themes have been published yet.</p>}</div>
      </section>
    </>}
    {/* Public checker ticket chain ko user ke browser mein alag se dobara janchta hai. */}
    <AuditChainVerifier />
    {/* Chhote group ka count chhupana logon ko pehchaan lene se bachata hai. */}
    <p className="text-center text-[10px] text-slate-600">Aggregates refresh every 60 seconds. Counts may be suppressed when groups are too small to protect petitioner privacy.</p>
  </main>;
}

// Ek jaisa metric card sab public number ko ek saaf roop mein dikhata hai.
function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) { // TS batata hai ki label text hai aur value text ya number ho sakti hai.
  return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className="text-indigo-300">{icon}</span></div><p className="mt-2 text-2xl font-extrabold text-white">{value}</p></div>;
}

