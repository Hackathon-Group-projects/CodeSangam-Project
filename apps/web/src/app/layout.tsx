import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Vishanti Ledger | Cryptographic Grievance Redressal Portal',
  description: 'Tamper-Evident Collegiate Grievance Redressal & Cryptographic Audit Ledger',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/30">
                VL
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                  The Vishanti Ledger
                </span>
                <span className="ml-2.5 hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 sm:inline-block">
                  🔒 Cryptographic Audit Active
                </span>
              </div>
            </div>
            <nav className="flex items-center space-x-4 text-sm font-medium">
              <a
                href="/transparency"
                className="text-slate-400 transition hover:text-slate-200"
              >
                Public Transparency
              </a>
              <a
                href="/track"
                className="text-slate-400 transition hover:text-slate-200"
              >
                Track Receipt
              </a>
              <a
                href="/auth/login"
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
              >
                Portal Login
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
