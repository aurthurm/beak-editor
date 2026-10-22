/**
 * Small helpers shared by the Office shell components.
 *
 * @module
 */

import { useEffect, useState } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';

/** Join class names, skipping falsy values. */
export function joinClass(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/**
 * Re-render when the editor dispatches a transaction or the registry executes a command.
 * Returns a counter that changes on each of those events.
 */
export function useRegistryRefresh(
  registry: CommandRegistry | null | undefined,
  editor?: BeakBlockEditor | null
): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    if (editor && !editor.isDestroyed) {
      unsubscribers.push(editor.on('transaction', () => setTick((value) => value + 1)));
    }
    if (registry) {
      unsubscribers.push(registry.onExecute(() => setTick((value) => value + 1)));
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [registry, editor]);
  return tick;
}
