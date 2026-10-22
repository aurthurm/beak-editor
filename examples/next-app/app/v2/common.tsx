"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';

/** Header card for a scenario: what roadmap capability it shows, and what to try. */
export function ScenarioIntro({
  kicker,
  title,
  capability,
  children,
  actions,
}: {
  kicker: string;
  title: string;
  capability: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="v2-intro">
      <div className="v2-intro__text">
        <p className="v2-kicker">{kicker}</p>
        <h2 className="v2-title">{title}</h2>
        <p className="v2-capability">
          <span className="v2-chip">Roadmap</span> {capability}
        </p>
        {children ? <div className="v2-lede">{children}</div> : null}
      </div>
      {actions ? <div className="v2-intro__actions">{actions}</div> : null}
    </header>
  );
}

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'ai'; children: ReactNode; title?: string }) {
  return (
    <span className={`v2-badge v2-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Panel({ title, children, right, className }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`v2-panel ${className ?? ''}`}>
      <div className="v2-panel__head">
        <h3>{title}</h3>
        {right}
      </div>
      <div className="v2-panel__body">{children}</div>
    </section>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return (
    <div className={`v2-notice v2-notice--${tone}`} role={tone === 'bad' ? 'alert' : 'status'} aria-live="polite">
      {children}
    </div>
  );
}

/** Re-renders when the editor dispatches a transaction. Returns a counter. */
export function useEditorTick(editor: BeakBlockEditor | null | undefined): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    return editor.on('transaction', () => setTick((value) => value + 1));
  }, [editor]);
  return tick;
}

/** Triggers a browser download of bytes or text. No-op outside the browser. */
export function downloadFile(filename: string, data: Uint8Array | string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Keeps the latest value in a ref without re-running effects. Layout effect, so the ref is current before any passive effect dispatches a transaction. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Shows a short-lived message near an action. */
export function useFlash(ms = 4000): [{ tone: 'ok' | 'bad' | 'info'; text: string } | null, (tone: 'ok' | 'bad' | 'info', text: string) => void] {
  const [flash, setFlash] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (tone: 'ok' | 'bad' | 'info', text: string) => {
      setFlash({ tone, text });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), ms);
    },
    [ms]
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [flash, show];
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
