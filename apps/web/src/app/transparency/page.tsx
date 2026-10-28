import { AlertTriangle, BarChart3, Clock3, ShieldCheck, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';

export const revalidate = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type PublicMetrics = {
  totals: { filed: number; resolved: number; active: number; escalated: number };
  averageResolutionHours: number | null;
  slaCompliancePercent: number | null;
  resolutionVelocity: Array<{ date: string; resolved: number }>;
  categoryTrends: Array<{ category: string; count: number }>;
  tierCompliance: Array<{ tier: number; compliant: number; breached: number }>;
  clusters: Array<{ id: string; label: string; count: number; sentiment: number }>;
  merkleRoot: { hash: string; timestamp: string } | null;
};

async function getMetrics(): Promise<PublicMetrics | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/metrics`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data ?? payload;
  } catch {
    return null;
  }
}

export default async function TransparencyPage() {
  const metrics = await getMetrics();
  return <main className="space-y-7 py-3">
    <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6 sm:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><BarChart3 className="h-4 w-4" /> Public transparency ledger</div>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Institution-wide redressal, in the open</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Aggregated case outcomes and service levels. Individual petition text, identities, and attachments are never shown here.</p></div>
        {metrics?.merkleRoot && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:max-w-sm"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-4 w-4" /> Latest ledger checkpoint</div><code className="mt-2 block break-all font-mono text-[10px] text-slate-300">{metrics.merkleRoot.hash}</code><p className="mt-1 text-[10px] text-slate-500">Published {new Date(metrics.merkleRoot.timestamp).toLocaleString()}</p></div>}
      </div>
    </header>

    {!metrics ? <section role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div><h2 className="font-semibold text-amber-200">Public metrics are not available yet</h2><p className="mt-1 text-sm leading-6 text-slate-400">This page refreshes automatically when the public metrics endpoint is connected. No sample or private case data is displayed.</p></div></div></section> : <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Petitions filed" value={metrics.totals.filed} icon={<Users className="h-4 w-4" />} />
        <Metric label="Resolved" value={metrics.totals.resolved} icon={<ShieldCheck className="h-4 w-4" />} />
        <Metric label="Active cases" value={metrics.totals.active} icon={<Clock3 className="h-4 w-4" />} />
        <Metric label="SLA compliance" value={metrics.slaCompliancePercent == null ? '—' : `${metrics.slaCompliancePercent}%`} icon={<BarChart3 className="h-4 w-4" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Resolution velocity" subtitle="Cases resolved per day"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.resolutionVelocity} margin={{ top: 10, right: 12, bottom: 4, left: -18 }}><CartesianGrid stroke="#1e293b" strokeDasharray="4 4" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0' }} /><Line type="monotone" dataKey="resolved" name="Resolved" stroke="#818cf8" strokeWidth={2.5} dot={{ fill: '#818cf8', r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Category trends" subtitle="Submitted cases by category"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.categoryTrends} margin={{ top: 10, right: 8, bottom: 28, left: -18 }}><CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0' }} /><Bar dataKey="count" name="Petitions" fill="#6366f1" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><h2 className="font-semibold text-white">SLA compliance by authority tier</h2><p className="mt-1 text-xs text-slate-500">Aggregate counts only</p><div className="mt-5 space-y-4">{metrics.tierCompliance.map((item) => { const total = item.compliant + item.breached; const ratio = total ? Math.round(item.compliant / total * 100) : 0; return <div key={item.tier}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">Tier {item.tier}</span><span className="text-slate-500">{item.compliant} on time · {item.breached} breached</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio}%` }} /></div></div>; })}</div>{metrics.averageResolutionHours != null && <p className="mt-5 text-xs text-slate-400">Average resolution time: <strong className="text-slate-200">{metrics.averageResolutionHours} hours</strong></p>}</div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-300" /><h2 className="font-semibold text-white">Recurring themes</h2></div><p className="mt-1 text-xs text-slate-500">AI groups similar complaints; individual petition details stay private.</p>{metrics.clusters.length ? <div className="mt-4 space-y-3">{metrics.clusters.map((cluster) => <article key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-medium text-slate-200">{cluster.label}</h3><span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-300">{cluster.count} cases</span></div><p className="mt-2 text-[11px] text-slate-500">Aggregate distress signal: {Math.round(cluster.sentiment * 100)}%</p></article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">No recurring themes have been published yet.</p>}</div>
      </section>
    </>}
    <p className="text-center text-[10px] text-slate-600">Aggregates refresh every 60 seconds. Counts may be suppressed when groups are too small to protect petitioner privacy.</p>
  </main>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className="text-indigo-300">{icon}</span></div><p className="mt-2 text-2xl font-extrabold text-white">{value}</p></div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p><div className="mt-4 h-64 w-full">{children}</div></div>;
}
