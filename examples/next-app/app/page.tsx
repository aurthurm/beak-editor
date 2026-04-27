"use client";

import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const BeakBlockShowcase = nextDynamic(() => import('./editor-shell').then((mod) => mod.BeakBlockShowcase), {
  ssr: false,
});

export default function Home() {
  return <BeakBlockShowcase />;
}
