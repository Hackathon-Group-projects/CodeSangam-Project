import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../components/auth-provider';
import { Navbar } from '../components/navbar';

// Next.js is jaankari ko browser tab ke naam aur search mein page ke chhote vivaran ke liye use karta hai.
export const metadata: Metadata = {
  title: 'The Vishanti Ledger | Cryptographic Grievance Redressal Portal',
  description: 'Tamper-Evident Collegiate Grievance Redressal & Cryptographic Audit Ledger',
};

// TS mein React.ReactNode ka matlab hai: is frame ke andar koi bhi page ka dikhne wala hissa aa sakta hai.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next.js mein layout sab pages ko gherne wala common frame hai; children ki jagah har page khud aata hai.
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
