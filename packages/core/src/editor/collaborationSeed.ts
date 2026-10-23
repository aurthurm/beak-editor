/**
 * Seeding for sync-gated collaboration.
 *
 * Problem: y-prosemirror replaces the editor document with the shared fragment
 * as soon as it binds. A fresh room has an empty fragment, so local initial
 * content would be erased. Seeding must therefore run after the provider has
 * synced, and must happen at most once per room.
 *
 * Design:
 * - Seed only when the fragment is empty after sync AND the room has no seed
 *   marker. The marker is a Y.Map key, so it survives after the content is
 *   later deleted, and a deliberately emptied room is not refilled.
 * - Two clients can still both see an empty room if they sync before any
 *   update is exchanged. Each writes its marker and its content in one
 *   transaction. Yjs resolves the concurrent map write to one winner on every
 *   client. Each client that observes a different winner removes the content
 *   it inserted, so the room converges on the winner's copy. The only data
 *   lost is text typed into the losing copy before it was removed.
 *
 * @module
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type {
  CollaborationDocLike,
  CollaborationFragmentLike,
  CollaborationMapLike,
} from './EditorConfig';

/** Y.Map name that holds the room's seed marker. */
export const COLLAB_META_MAP = 'beakblockCollab';
/** Key inside {@link COLLAB_META_MAP} that records which client seeded the room. */
export const COLLAB_SEED_KEY = 'seed';

const SEED_ORIGIN = 'beakblock-collab-seed';

function newSeedToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Seed the shared fragment if the room is empty and has never been seeded.
 *
 * Call only after the provider has synced. Returns a cleanup function that
 * stops the race-resolution observer. Call it when collaboration is torn down.
 */
export function seedRoomOnce(options: {
  ydoc: CollaborationDocLike;
  fragment: CollaborationFragmentLike;
  doc: ProseMirrorNode;
  seed: (doc: ProseMirrorNode) => void;
}): () => void {
  const { ydoc, fragment, doc, seed } = options;
  const meta: CollaborationMapLike = ydoc.getMap(COLLAB_META_MAP);

  if (fragment.length > 0 || meta.has(COLLAB_SEED_KEY)) {
    return () => {};
  }

  const token = newSeedToken();
  let ownNodes: unknown[] = [];

  ydoc.transact(() => {
    meta.set(COLLAB_SEED_KEY, token);
    seed(doc);
    // The fragment was empty, so everything it holds now is this client's seed.
    ownNodes = fragment.toArray();
  }, SEED_ORIGIN);

  const reconcile = () => {
    if (ownNodes.length === 0) return;
    if (meta.get(COLLAB_SEED_KEY) === token) return;
    // Another client's seed won the race. Remove our copy.
    const nodes = ownNodes;
    ownNodes = [];
    ydoc.transact(() => {
      for (const node of nodes) {
        const index = fragment.toArray().indexOf(node);
        if (index >= 0) fragment.delete(index, 1);
      }
    }, SEED_ORIGIN);
  };

  meta.observe(reconcile);
  return () => meta.unobserve(reconcile);
}
