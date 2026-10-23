import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorToYXmlFragment, ySyncPlugin } from 'y-prosemirror';
import { BeakBlockEditor } from './Editor';

const REMOTE = 'test-remote';

/** Minimal stand-in for y-websocket's provider: only the `sync` event matters here. */
class FakeSyncProvider {
  synced = false;
  private listeners = new Set<(isSynced: boolean) => void>();
  on(_event: 'sync', listener: (isSynced: boolean) => void): void {
    this.listeners.add(listener);
  }
  off(_event: 'sync', listener: (isSynced: boolean) => void): void {
    this.listeners.delete(listener);
  }
  markSynced(): void {
    this.synced = true;
    for (const listener of [...this.listeners]) listener(true);
  }
}

/** Links two in-memory Y.Docs by relaying updates, with a switch to hold traffic in flight. */
function connect(a: Y.Doc, b: Y.Doc) {
  const net = { paused: false, queue: [] as Array<[Y.Doc, Uint8Array]> };
  const relay = (to: Y.Doc) => (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE) return;
    if (net.paused) net.queue.push([to, update]);
    else Y.applyUpdate(to, update, REMOTE);
  };
  a.on('update', relay(b));
  b.on('update', relay(a));
  return {
    pause: () => {
      net.paused = true;
    },
    resume: () => {
      net.paused = false;
      for (const [to, update] of net.queue.splice(0)) Y.applyUpdate(to, update, REMOTE);
    },
  };
}

function paragraph(text: string) {
  return [
    {
      id: `p-${text}`,
      type: 'paragraph' as const,
      props: {},
      content: [{ type: 'text' as const, text, styles: {} }],
    },
  ];
}

function docText(editor: BeakBlockEditor): string {
  return editor
    .getDocument()
    .map((block) =>
      (block.content ?? []).map((item) => ('text' in item ? item.text : '')).join('')
    )
    .join('\n');
}

describe('collaboration seeding', () => {
  let containers: HTMLElement[];
  let editors: BeakBlockEditor[];

  beforeEach(() => {
    containers = [];
    editors = [];
  });

  afterEach(() => {
    for (const editor of editors) if (!editor.isDestroyed) editor.destroy();
    for (const container of containers) container.remove();
  });

  function makeClient(
    text: string,
    ydoc: Y.Doc,
    provider: FakeSyncProvider,
    seedSpy: () => void = () => {}
  ): BeakBlockEditor {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      history: false,
      initialContent: paragraph(text),
    });
    editors.push(editor);
    const fragment = ydoc.getXmlFragment('prosemirror');
    editor.enableCollaboration({
      plugins: [ySyncPlugin(fragment)],
      sync: {
        provider,
        ydoc,
        fragment,
        seed: (doc) => {
          seedSpy();
          prosemirrorToYXmlFragment(doc, fragment);
        },
      },
    });
    return editor;
  }

  it('seeds a fresh room once, and only after the provider has synced', () => {
    const ydoc = new Y.Doc();
    const provider = new FakeSyncProvider();
    const seedSpy = vi.fn();
    const editor = makeClient('Hello', ydoc, provider, seedSpy);

    expect(editor.isCollaborating).toBe(false);
    expect(ydoc.getXmlFragment('prosemirror').length).toBe(0);
    expect(seedSpy).not.toHaveBeenCalled();

    provider.markSynced();

    expect(editor.isCollaborating).toBe(true);
    expect(seedSpy).toHaveBeenCalledTimes(1);
    expect(ydoc.getXmlFragment('prosemirror').length).toBe(1);
    expect(docText(editor)).toBe('Hello');
  });

  it('two clients joining an empty room before exchanging updates do not duplicate content', () => {
    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();
    const network = connect(ydocA, ydocB);
    const providerA = new FakeSyncProvider();
    const providerB = new FakeSyncProvider();
    const seedA = vi.fn();
    const seedB = vi.fn();

    network.pause();
    const editorA = makeClient('Hello', ydocA, providerA, seedA);
    const editorB = makeClient('Hello', ydocB, providerB, seedB);

    // Both see an empty room before any traffic is delivered: both may seed.
    providerA.markSynced();
    providerB.markSynced();
    expect(seedA).toHaveBeenCalledTimes(1);
    expect(seedB).toHaveBeenCalledTimes(1);

    network.resume();

    expect(ydocA.getXmlFragment('prosemirror').length).toBe(1);
    expect(ydocB.getXmlFragment('prosemirror').length).toBe(1);
    expect(docText(editorA)).toBe('Hello');
    expect(docText(editorB)).toBe('Hello');
  });

  it('a client joining a non-empty room keeps the remote content and ignores its own initialContent', () => {
    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();
    connect(ydocA, ydocB);
    const providerA = new FakeSyncProvider();
    const providerB = new FakeSyncProvider();

    const editorA = makeClient('Remote text', ydocA, providerA);
    providerA.markSynced();
    expect(docText(editorA)).toBe('Remote text');

    const seedB = vi.fn();
    const editorB = makeClient('Local draft', ydocB, providerB, seedB);
    providerB.markSynced();

    expect(seedB).not.toHaveBeenCalled();
    expect(docText(editorB)).toBe('Remote text');
    expect(ydocB.getXmlFragment('prosemirror').length).toBe(1);
  });

  it('does not re-seed a room that was seeded before and is now empty', () => {
    const ydocA = new Y.Doc();
    const ydocC = new Y.Doc();
    const network = connect(ydocA, ydocC);
    const providerA = new FakeSyncProvider();
    const providerC = new FakeSyncProvider();

    const editorA = makeClient('Hello', ydocA, providerA);
    providerA.markSynced();
    expect(docText(editorA)).toBe('Hello');

    // Everyone deletes the content; the room is now empty but was already seeded.
    const fragmentA = ydocA.getXmlFragment('prosemirror');
    ydocA.transact(() => fragmentA.delete(0, fragmentA.length));
    expect(fragmentA.length).toBe(0);

    const seedC = vi.fn();
    makeClient('Late joiner', ydocC, providerC, seedC);
    network.resume();
    providerC.markSynced();

    expect(seedC).not.toHaveBeenCalled();
    expect(ydocC.getXmlFragment('prosemirror').length).toBe(0);
  });

  it('disabling collaboration before the provider syncs cancels the pending seed', () => {
    const ydoc = new Y.Doc();
    const provider = new FakeSyncProvider();
    const seedSpy = vi.fn();
    const editor = makeClient('Hello', ydoc, provider, seedSpy);

    editor.disableCollaboration();
    provider.markSynced();

    expect(editor.isCollaborating).toBe(false);
    expect(seedSpy).not.toHaveBeenCalled();
    expect(ydoc.getXmlFragment('prosemirror').length).toBe(0);
  });

  it('without a sync config, collaboration activates immediately (backward compatible)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const ydoc = new Y.Doc();
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      history: false,
      initialContent: paragraph('Hello'),
    });
    editors.push(editor);
    editor.enableCollaboration({ plugins: [ySyncPlugin(ydoc.getXmlFragment('prosemirror'))] });
    expect(editor.isCollaborating).toBe(true);
  });
});
