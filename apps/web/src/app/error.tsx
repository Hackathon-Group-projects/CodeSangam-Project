'use client'; // Error screen browser mein chalta hai, kyunki retry button page ko dobara kholta hai.

import Link from 'next/link'; // User ko home page tak le jaane wala link lete hain.
import { useEffect } from 'react'; // Error log karne ke liye page khulne ke baad chalne wala React tool lete hain.
import { AlertTriangle, RefreshCw } from 'lucide-react'; // Dikkat aur dobara koshish ke icons lete hain.

// TS batata hai ki Next.js is screen ko error ki jaankari aur retry button deta hai.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Page could not load:', error); }, [error]); // Browser ke console mein sirf madadgar error rakhte hain.
  return <section className="mx-auto my-12 max-w-xl rounded-2xl border border-rose-500/20 bg-slate-900/70 p-7 text-center"> {/* Dikkat ko ek saaf box mein dikhate hain. */}
    <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" /> {/* User ko dikhate hain ki page theek se nahi khula. */}
    <h1 className="mt-4 text-xl font-bold text-white">This page could not load</h1> {/* Dikkat ko seedhe shabdon mein samjhate hain. */}
    <p className="mt-2 text-sm leading-6 text-slate-400">Your saved information is unchanged. Try again, or return to the home page.</p> {/* Batate hain ki sirf screen ka load fail hua hai. */}
    <div className="mt-5 flex flex-wrap justify-center gap-3"> {/* Dono madad ke buttons ko saath rakhte hain. */}
      <button onClick={() => reset()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"><RefreshCw className="h-4 w-4" /> Try again</button> {/* Page ko dobara kholne ki koshish karte hain. */}
      <Link href="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Home</Link> {/* User ko home screen par le jaate hain. */}
    </div>
  </section>;
}
