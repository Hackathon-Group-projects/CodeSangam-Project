'use client'; // Recharts browser mein SVG tasveer banata hai, isliye yeh hissa browser par chalayenge.

import type { ReactNode } from 'react'; // TS ko batate hain ki chart card ke andar doosra React visual aa sakta hai.
import { CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'; // Public numbers ko column charts mein dikhane ke parts lete hain.

// TS mein yeh type chart ko milne wale do data lists ka naqsha hai.
type TransparencyChartProps = {
  resolutionVelocity: Array<{ tier: number; averageHours: number }>; // Har authority star ka ausat solve samay.
  categoryTrends: Array<{ category: string; count: number }>; // Har complaint vishay ki ginti.
};

// Dono charts ko chhote aur bade screen ke hisaab se dikhate hain.
export function TransparencyCharts({ resolutionVelocity, categoryTrends }: TransparencyChartProps) { // TS check karta hai ki dono lists sahi shape mein aayi hain.
  return <section className="grid gap-5 lg:grid-cols-2"> {/* Phone par ek chart aur bade screen par do chart paas-paas rakhte hain. */}
    <ChartCard title="Average resolution time by tier" subtitle="Hours from filing to resolution"> {/* Pehla chart har tier ka ausat samay dikhata hai. */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={resolutionVelocity} margin={{ top: 10, right: 12, bottom: 4, left: -18 }}> {/* Data se seedhe khambe banwate hain. */}
          <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} /> {/* Halke seedhe guide marks dikhate hain. */}
          <XAxis dataKey="tier" tickFormatter={(tier) => `Tier ${tier}`} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /> {/* Neeche har adhikari star ka naam dikhate hain. */}
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /> {/* Side par ghanton ki ginti dikhate hain. */}
          <Tooltip formatter={(value) => [`${value} hours`, 'Average']} labelFormatter={(tier) => `Tier ${tier}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0' }} /> {/* Mouse le jaane par exact number dikhate hain. */}
          <Bar dataKey="averageHours" name="Average hours" fill="#818cf8" radius={[5, 5, 0, 0]} /> {/* Har tier ka khamba uska ausat samay batata hai. */}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
    <ChartCard title="Category trends" subtitle="Submitted cases by category"> {/* Doosra chart batata hai kaunse vishay par kitne case aaye. */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={categoryTrends} margin={{ top: 10, right: 8, bottom: 28, left: -18 }}> {/* Har category ke liye alag khamba banate hain. */}
          <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} /> {/* Ginti samajhne ke liye guide marks dikhate hain. */}
          <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} /> {/* Neeche category ke naam jagah bachane ke liye tedhe dikhate hain. */}
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} /> {/* Side par case ki poori ginti dikhate hain. */}
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0' }} /> {/* Mouse le jaane par category ki exact ginti dikhate hain. */}
          <Bar dataKey="count" name="Petitions" fill="#6366f1" radius={[5, 5, 0, 0]} /> {/* Har category ka khamba uske case ginta hai. */}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  </section>;
}

// Har chart ko naam, chhoti samajh aur barabar height wala dabba milta hai.
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { // TS batata hai ki chart ke andar ek React visual aayega.
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p><div className="mt-4 h-64 w-full">{children}</div></div>; // Title aur chart ko ek card mein jodte hain.
}
