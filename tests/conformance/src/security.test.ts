/**
 * Security suite (roadmap 5K and section 8). The client is treated as hostile throughout.
 *
 * - Forged operations: crafted submissions against the reference server store (verifyDocumentChange).
 * - Client lock bypass: the client guard is a UX layer; the server must reject what it lets through.
 * - Replay and stale updates: base hashes, submission ids and forged snapshots.
 * - Tenant isolation: documents, grants and existence are scoped per tenant.
 * - Signature attributes: written only by the signature service.
 * - AI proposals: denied for sections the user cannot edit, and the provider is not called.
 *
 * Each attack has a positive control so that a passing denial cannot be vacuous.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeakBlockEditor, blocksToDoc, type Block, type BeakExtension } from '@amusendame/beakblock-core';
import { SIGNATURE_SERVICE_META, qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { createAICommandLayer, createMockProvider } from '@amusendame/beakblock-ai';
import { CommandRegistry } from '@amusendame/beakblock-commands';
import { createPermissionGuardPlugin, PERMISSION_BYPASS_META, type PolicyContext } from '@amusendame/beakblock-permissions';
import { reviewExtension } from '@amusendame/beakblock-review';
import { TextSelection } from 'prosemirror-state';

import { cloneBlocks } from './corpus';
import { PRINCIPALS, secureSop } from './support/secureSop';
import { ServerDocumentStore, hashBlocks, lockedSectionsOf, type SubmitRequest } from './support/serverStore';

const TENANT = 'tenant-a';
const DOC = 'sop-sec-1';

function freshStore(): ServerDocumentStore {
  const store = new ServerDocumentStore();
  store.createDocument(TENANT, DOC, secureSop());
  for (const [user, grants] of Object.entries(PRINCIPALS)) store.grant(TENANT, user, grants);
  return store;
}

/** Reads the current state as `userId` and returns a submission builder bound to that base. */
function clientFor(store: ServerDocumentStore, userId: string) {
  const snapshot = store.read(TENANT, userId, DOC);
  if (!snapshot) throw new Error(`no read for ${userId}`);
  let counter = 0;
  return {
    base: snapshot,
    submit: (blocks: Block[], submissionId = `${userId}-${Date.now()}-${(counter += 1)}`) => {
      const request: SubmitRequest = { documentId: DOC, userId, baseHash: snapshot.hash, submissionId, blocks };
      return store.submit(TENANT, request);
    },
    edit: (mutate: (blocks: Block[]) => void) => {
      const blocks = cloneBlocks(snapshot.blocks);
      mutate(blocks);
      return blocks;
    },
  };
}

/** Removes a block by id from a tree (returns true when it was found). */
function removeBlock(blocks: Block[], id: string): boolean {
  const index = blocks.findIndex((b) => b.id === id);
  if (index >= 0) {
    blocks.splice(index, 1);
    return true;
  }
  return blocks.some((b) => (b.children ? removeBlock(b.children, id) : false));
}

function sectionBlock(blocks: Block[], sectionId: string): Block {
  const found = (nodes: Block[]): Block | undefined => {
    for (const node of nodes) {
      if (node.type === 'controlledSection' && node.props.sectionId === sectionId) return node;
      const inner = node.children ? found(node.children) : undefined;
      if (inner) return inner;
    }
    return undefined;
  };
  const block = found(blocks);
  if (!block) throw new Error(`no section ${sectionId}`);
  return block;
}

describe('security: forged operations are rejected by the server', () => {
  it('positive control: Ann edits text in her own section', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      sectionBlock(b, 'scope').children![0].content = [{ type: 'text', text: 'Scope revised by Ann.', styles: {} }];
    });
    expect(client.submit(blocks).ok).toBe(true);
  });

  it('rejects an edit to an approved (locked) section, even for a principal with grants on it', () => {
    const store = freshStore();
    store.grant(TENANT, 'admin', { roles: ['author'], sectionGrants: { purpose: ['section.editText'] } });
    const client = clientFor(store, 'admin');
    const blocks = client.edit((b) => {
      sectionBlock(b, 'purpose').children![0].content = [{ type: 'text', text: 'Forged purpose.', styles: {} }];
    });
    const result = client.submit(blocks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('forbidden');
  });

  it('rejects deleting a required section', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      removeBlock(b, sectionBlock(b, 'scope').id);
    });
    expect(client.submit(blocks).ok).toBe(false);
  });

  it('nested section bypass: deleting the parent hides a required nested section, and it is still rejected', () => {
    const store = freshStore();
    const client = clientFor(store, 'ben');
    const blocks = client.edit((b) => {
      removeBlock(b, sectionBlock(b, 'procedure').id);
    });
    const result = client.submit(blocks);
    expect(result.ok).toBe(false);
  });

  it('nested section bypass: editing the nested required section without its grant is rejected', () => {
    const store = freshStore();
    const client = clientFor(store, 'ben');
    const blocks = client.edit((b) => {
      sectionBlock(b, 'safety').children![0].content = [{ type: 'text', text: 'Skip gloves.', styles: {} }];
    });
    expect(client.submit(blocks).ok).toBe(false);
  });

  it('rejects moving another section\'s content across a boundary', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      const proc = sectionBlock(b, 'procedure');
      const moved = proc.children!.find((c) => c.type === 'paragraph' && c.content?.[0] && 'text' in c.content[0] && (c.content[0] as { text: string }).text === 'Procedure text.')!;
      proc.children = proc.children!.filter((c) => c !== moved);
      sectionBlock(b, 'scope').children!.push(moved);
    });
    expect(client.submit(blocks).ok).toBe(false);
  });

  it('rejects renaming a section without the rename capability', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      sectionBlock(b, 'scope').props.title = 'Scope (edited)';
    });
    expect(client.submit(blocks).ok).toBe(false);
  });

  it('rejects changes to protected attributes (required, workflowState) by a section author', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const relax = client.edit((b) => {
      sectionBlock(b, 'scope').props.required = false;
    });
    expect(client.submit(relax).ok).toBe(false);
    const approve = clientFor(store, 'ann').edit((b) => {
      sectionBlock(b, 'scope').props.workflowState = 'approved';
    });
    expect(clientFor(store, 'ann').submit(approve).ok).toBe(false);
  });

  it('rejects uncontrolled text edits from a principal without document.editUncontrolled', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      b[1].content = [{ type: 'text', text: 'Changed uncontrolled text.', styles: {} }];
    });
    expect(client.submit(blocks).ok).toBe(false);
  });

  it('positive control: the uncontrolled editor may change uncontrolled text', () => {
    const store = freshStore();
    const client = clientFor(store, 'uncontrolledEditor');
    const blocks = client.edit((b) => {
      b[1].content = [{ type: 'text', text: 'Changed uncontrolled text.', styles: {} }];
    });
    expect(client.submit(blocks).ok).toBe(true);
  });

  it('rejects a malformed submission with duplicate block ids', () => {
    const store = freshStore();
    const client = clientFor(store, 'ann');
    const blocks = client.edit((b) => {
      sectionBlock(b, 'scope').children![0].id = sectionBlock(b, 'procedure').children![0].id;
    });
    expect(client.submit(blocks).ok).toBe(false);
  });
});

describe('security: the client guard is UX only, the server still decides', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  /**
   * Editor guarded by `principal`. The document is first loaded as the system principal (the QMS
   * service), because a guarded editor rejects loading for an ordinary user. Then the principal
   * switches to the user under test.
   */
  function guardedEditor(blocks: Block[], user: { userId: string; roles: string[]; sectionGrants: Record<string, string[]> }) {
    const SYSTEM: PolicyContext = { userId: 'qms-service', roles: ['system'], sectionGrants: {} };
    let principal: PolicyContext = SYSTEM;
    const guard: BeakExtension = { name: 'guard', plugins: () => [createPermissionGuardPlugin({ getContext: () => principal })] };
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: [qmsExtension({}), guard] });
    // setDocument is a plain transaction and the guard rejects it for every principal. The QMS
    // service loads documents with the bypass meta, which the guard honours only for `system`.
    const doc = blocksToDoc(editor.pm.state.schema, cloneBlocks(blocks));
    const load = editor.pm.createTransaction();
    load.setMeta(PERMISSION_BYPASS_META, true);
    load.replaceWith(0, editor.pm.doc.content.size, doc.content);
    editor.pm.dispatch(load);
    principal = { ...user, sectionGrants: user.sectionGrants as PolicyContext['sectionGrants'], lockedSections: lockedSectionsOf(editor.getDocument()) };
    return editor;
  }

  it('positive control: the guarded editor lets the system load the document and an author edit her own section', () => {
    const blocks = secureSop();
    const editor = guardedEditor(blocks, { userId: 'ann', roles: ['author'], sectionGrants: { scope: ['section.editText'] } });
    try {
      expect(editor.getDocument().length).toBe(blocks.length);
      const target = sectionBlock(editor.getDocument(), 'scope').children![0];
      const text = (target.content?.[0] as { text: string }).text;
      const pos = findTextPosition(editor, text);
      editor.pm.dispatch(editor.pm.state.tr.insertText('Edited. ', pos.from));
      expect(JSON.stringify(editor.getDocument())).toContain('Edited. ');
    } finally {
      editor.destroy();
    }
  });

  it('the guarded editor rejects a transaction that deletes a locked section', () => {
    const blocks = secureSop();
    const editor = guardedEditor(blocks, { userId: 'ann', roles: ['author'], sectionGrants: { scope: ['section.editText', 'section.insertBlock'] } });
    try {
      const before = JSON.stringify(editor.getDocument());
      editor.removeBlocks([sectionBlock(blocks, 'purpose').id]);
      expect(JSON.stringify(editor.getDocument())).toBe(before);
    } finally {
      editor.destroy();
    }
  });

  it('the permission bypass meta is ignored for a principal without the system role', () => {
    const blocks = secureSop();
    const editor = guardedEditor(blocks, { userId: 'ann', roles: ['author'], sectionGrants: { scope: ['section.editText'] } });
    try {
      const before = JSON.stringify(editor.getDocument());
      const text = (sectionBlock(blocks, 'purpose').children![0].content![0] as { text: string }).text;
      const pos = findTextPosition(editor, text);
      editor.pm.dispatch(editor.pm.state.tr.setMeta(PERMISSION_BYPASS_META, true).delete(pos.from, pos.to));
      expect(JSON.stringify(editor.getDocument())).toBe(before);
    } finally {
      editor.destroy();
    }
  });

  it('a malicious client that skips the editor and sends the deletion directly is rejected by the server', () => {
    const store = freshStore();
    const forged = secureSop().filter((b) => b.props.sectionId !== 'purpose');
    const client = clientFor(store, 'ann');
    const result = client.submit(forged);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('forbidden');
  });

  it('the QMS plugin also refuses to delete a required section in the editor (defence in depth)', () => {
    const blocks = secureSop();
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: [qmsExtension({})] });
    try {
      editor.setDocument(cloneBlocks(blocks));
      const before = JSON.stringify(editor.getDocument());
      editor.removeBlocks([sectionBlock(blocks, 'purpose').id]);
      expect(JSON.stringify(editor.getDocument())).toBe(before);
    } finally {
      editor.destroy();
    }
  });
});

describe('security: replay and stale updates', () => {
  it('rejects a stale base: a second author who edited the old revision is refused', () => {
    const store = freshStore();
    const ann = clientFor(store, 'ann');
    const ben = clientFor(store, 'ben');
    const annEdit = ann.edit((b) => {
      sectionBlock(b, 'scope').children![0].content = [{ type: 'text', text: 'Ann first.', styles: {} }];
    });
    expect(ann.submit(annEdit).ok).toBe(true);
    const benEdit = ben.edit((b) => {
      sectionBlock(b, 'procedure').children![0].content = [{ type: 'text', text: 'Ben against old base.', styles: {} }];
    });
    const result = ben.submit(benEdit);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('stale-base');
  });

  it('rejects a replayed submission even though its base was accepted once', () => {
    const store = freshStore();
    const ann = clientFor(store, 'ann');
    const edit = ann.edit((b) => {
      sectionBlock(b, 'scope').children![0].content = [{ type: 'text', text: 'Once only.', styles: {} }];
    });
    const first = ann.submit(edit, 'sub-1');
    expect(first.ok).toBe(true);
    const replay = store.submit(TENANT, { documentId: DOC, userId: 'ann', baseHash: ann.base.hash, submissionId: 'sub-1', blocks: edit });
    expect(replay).toMatchObject({ ok: false, code: 'replayed' });
  });

  it('a stale snapshot with a forged current base hash cannot revert another author\'s section', () => {
    const store = freshStore();
    const old = clientFor(store, 'ben');
    // Ann changes her section, so the stored state moves on.
    const ann = clientFor(store, 'ann');
    expect(
      ann.submit(
        ann.edit((b) => {
          sectionBlock(b, 'scope').children![0].content = [{ type: 'text', text: 'Ann changed scope.', styles: {} }];
        })
      ).ok
    ).toBe(true);
    // Ben forges the current hash and sends his old snapshot, which reverts Ann's scope text.
    const current = store.read(TENANT, 'ben', DOC)!;
    const forged = structuredClone(old.base.blocks);
    const result = store.submit(TENANT, { documentId: DOC, userId: 'ben', baseHash: current.hash, submissionId: 'forged-1', blocks: forged });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('forbidden');
  });

  it('the server hash changes with every accepted revision', () => {
    const store = freshStore();
    const before = store.read(TENANT, 'ann', DOC)!.hash;
    const ann = clientFor(store, 'ann');
    ann.submit(
      ann.edit((b) => {
        sectionBlock(b, 'scope').children![0].content = [{ type: 'text', text: 'Hash changes.', styles: {} }];
      })
    );
    const after = store.read(TENANT, 'ann', DOC)!;
    expect(after.hash).not.toBe(before);
    expect(after.hash).toBe(hashBlocks(after.blocks));
  });
});

describe('security: tenant isolation', () => {
  it('another tenant cannot read a document', () => {
    const store = freshStore();
    store.grant('tenant-b', 'ann', { roles: ['author'], sectionGrants: { scope: ['section.editText'] } });
    expect(store.read('tenant-b', 'ann', DOC)).toBeNull();
  });

  it('another tenant cannot submit to a document with the same id', () => {
    const store = freshStore();
    store.grant('tenant-b', 'ann', { roles: ['author'], sectionGrants: { scope: ['section.editText', 'section.insertBlock'] } });
    const base = store.read(TENANT, 'ann', DOC)!;
    const result = store.submit('tenant-b', { documentId: DOC, userId: 'ann', baseHash: base.hash, submissionId: 'x-1', blocks: base.blocks });
    expect(result).toMatchObject({ ok: false, code: 'not-found' });
  });

  it('grants do not travel: a user with grants in tenant A has none in tenant B', () => {
    const store = freshStore();
    store.createDocument('tenant-b', 'other', secureSop());
    const base = store.read('tenant-b', 'ann', 'other');
    expect(base).toBeNull();
  });
});

describe('security: signature attributes are written only by the signature service', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const signed = (): Block[] => [
    { id: 'sig-1', type: 'signatureBlock', props: { id: 'sig-1', role: 'Approver', signerName: 'K. Phiri', signedAt: '2026-05-06T14:12:00.000Z', meaning: 'approved', contentHash: 'sha256:abc', signatureId: 'sig-9' } },
  ];

  it('a client cannot insert a pre-signed signature block', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: [qmsExtension({})] });
    try {
      editor.setDocument(signed());
      expect(editor.getDocument().some((b) => b.type === 'signatureBlock')).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('the signature service can insert a signed signature block', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'controlled', extensions: [qmsExtension({})] });
    try {
      const tr = editor.pm.createTransaction();
      tr.setMeta(SIGNATURE_SERVICE_META, true);
      const node = editor.pm.state.schema.nodeFromJSON({ type: 'signatureBlock', attrs: { id: 'sig-1', role: 'Approver', signerName: 'K. Phiri', signedAt: '2026-05-06T14:12:00.000Z', meaning: 'approved', contentHash: 'sha256:abc', signatureId: 'sig-9' } });
      tr.insert(tr.doc.content.size, node);
      editor.pm.dispatch(tr);
      expect(editor.getDocument().some((b) => b.type === 'signatureBlock' && b.props.signatureId === 'sig-9')).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('the server rejects a change to a signed signature block by any author', () => {
    const store = new ServerDocumentStore();
    store.createDocument(TENANT, 'rel', signed());
    store.grant(TENANT, 'ann', { roles: ['author'], sectionGrants: {}, defaultGrants: ['document.editUncontrolled'] });
    const base = store.read(TENANT, 'ann', 'rel')!;
    const forged = structuredClone(base.blocks);
    forged[0].props.signerName = 'Forger';
    const result = store.submit(TENANT, { documentId: 'rel', userId: 'ann', baseHash: base.hash, submissionId: 's', blocks: forged });
    expect(result.ok).toBe(false);
  });
});

describe('security: AI proposals respect policy', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function setup(context: PolicyContext) {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      mode: 'controlled',
      extensions: [qmsExtension({}), reviewExtension({ enabled: true, author: { id: context.userId, name: context.userId } })],
    });
    editor.setDocument(secureSop());
    const registry = new CommandRegistry();
    const provider = createMockProvider({
      'ai.rewriteSelection': { text: 'A rewritten sentence.' },
    });
    const ai = createAICommandLayer({
      provider,
      editor,
      registry,
      author: { id: context.userId, name: 'Test user' },
      getPolicyContext: () => context,
    });
    return { editor, provider, ai, registry };
  }

  function selectText(editor: BeakBlockEditor, text: string): void {
    const pos = findTextPosition(editor, text);
    editor.pm.dispatch(editor.pm.state.tr.setSelection(TextSelection.create(editor.pm.state.doc, pos.from, pos.to)));
  }

  it('denies a rewrite inside a section the user cannot edit, and never calls the provider', async () => {
    const context: PolicyContext = { userId: 'ann', roles: ['author'], sectionGrants: { scope: ['section.editText', 'section.insertBlock'] }, lockedSections: ['purpose'] };
    const { editor, provider, ai } = setup(context);
    try {
      selectText(editor, 'Procedure text.');
      const result = await ai.run('ai.rewriteSelection', { instruction: 'Plain English' });
      expect(result.status).toBe('denied');
      expect(provider.calls).toHaveLength(0);
      expect(editor.getPendingTrackChanges?.().length ?? 0).toBe(0);
      expect(editor.getDocument().find((b) => b.props.sectionId === 'procedure')).toBeDefined();
    } finally {
      ai.dispose();
      editor.destroy();
    }
  });

  it('denies a rewrite inside an approved (locked) section even for a principal with grants', async () => {
    const context: PolicyContext = { userId: 'admin', roles: ['author'], sectionGrants: { purpose: ['section.editText'] }, lockedSections: ['purpose'] };
    const { editor, provider, ai } = setup(context);
    try {
      selectText(editor, 'Approved purpose statement.');
      const result = await ai.run('ai.rewriteSelection', { instruction: 'Shorter' });
      expect(result.status).toBe('denied');
      expect(provider.calls).toHaveLength(0);
    } finally {
      ai.dispose();
      editor.destroy();
    }
  });

  it('positive control: a rewrite inside an editable section is proposed as an AI tracked change', async () => {
    const context: PolicyContext = { userId: 'ann', roles: ['author'], sectionGrants: { scope: ['section.editText', 'section.insertBlock'] }, lockedSections: [] };
    const { editor, provider, ai } = setup(context);
    try {
      selectText(editor, 'Scope statement.');
      const result = await ai.run('ai.rewriteSelection', { instruction: 'Shorter' });
      expect(result.status).toBe('proposed');
      expect(provider.calls).toHaveLength(1);
    } finally {
      ai.dispose();
      editor.destroy();
    }
  });
});

/** Finds the document range of a text string (first occurrence). */
function findTextPosition(editor: BeakBlockEditor, text: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  editor.pm.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return !found;
    const index = node.text.indexOf(text);
    if (index >= 0 && text.length > 0) {
      found = { from: pos + index, to: pos + index + text.length };
      return false;
    }
    return true;
  });
  if (!found) throw new Error(`text not found: ${text}`);
  return found;
}
