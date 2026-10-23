import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../components/auth-provider';
import { Navbar } from '../components/navbar';

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
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
