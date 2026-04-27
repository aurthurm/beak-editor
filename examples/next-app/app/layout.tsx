import type { Metadata } from 'next';
import React from 'react';
import '@amusendame/beakblock-core/styles/editor.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'BeakBlock Next.js Showcase',
  description: 'Next.js showcase for the BeakBlock React bindings.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
