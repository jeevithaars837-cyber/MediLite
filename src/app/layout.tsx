import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CareSync — Low-bandwidth & Offline Healthcare',
  description: 'Healthcare that works even when the network doesn\'t. Text-first, low data, offline capable medical consultations.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0c8ce9" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col selection:bg-brand-500 selection:text-white">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
