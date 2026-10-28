// Next.js loading.tsx ko khud dikhata hai jab is address ka page taiyaar ho raha hota hai.
export default function Loading() {
  return <div className="animate-pulse space-y-6 py-4" aria-label="Loading page"> {/* Loading dauran page ki jagah khali na lage. */}
    <div className="h-12 w-2/3 rounded-lg bg-slate-800" /> {/* Heading ki jagah ek dhundla patta dikhate hain. */}
    <div className="h-5 w-1/2 rounded bg-slate-800/80" /> {/* Chhoti jaankari ki jagah doosra patta dikhate hain. */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"> {/* Phone se badi screen par cards ko kai columns mein rakhte hain. */}
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-xl border border-slate-800 bg-slate-900/70" />)} {/* Chaar metric cards ke aane ki jagah dikhate hain. */}
    </div>
    <div className="grid gap-5 lg:grid-cols-2"> {/* Chart boxes ki jagah responsive jagah rakhte hain. */}
      <div className="h-72 rounded-2xl border border-slate-800 bg-slate-900/70" /> {/* Pehle chart ke liye khaali dhundla box. */}
      <div className="h-72 rounded-2xl border border-slate-800 bg-slate-900/70" /> {/* Doosre chart ke liye khaali dhundla box. */}
    </div>
  </div>;
}
