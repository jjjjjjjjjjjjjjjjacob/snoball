import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Snoball - AI Trading Platform',
  description: 'Automated trading with PDT compliance for accounts under $25k',
  keywords: 'trading, AI, stocks, options, PDT, day trading',
  authors: [{ name: 'Snoball Team' }],
  openGraph: {
    title: 'Snoball - AI Trading Platform',
    description: 'Automated trading with PDT compliance',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}