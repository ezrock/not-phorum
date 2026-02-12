import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freak On! Forum',
  description: 'Suomalainen pelaajayhteisö vuodesta 2004',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fi">
      <body>
        <AuthProvider>
          <div className="min-h-screen bg-gray-100 flex flex-col">
            <Navigation />
            <main className="flex-1 pb-8">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
