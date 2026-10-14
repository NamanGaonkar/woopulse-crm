import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WooPulse CRM',
  description: 'A lightweight CRM for WooCommerce stores — customers, orders, communications, and a Retention Agent.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
