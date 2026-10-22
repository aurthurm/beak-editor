/**
 * Release manifests: hashes of the composed document and its sections, signatures bound to the
 * document hash, an optional rendition hash, and verification against the composed document.
 *
 * @module
 */

import { contentHash, sha256Hex, sectionContentHash } from './hash';
import type { ComposedDocument } from './compose';
import type { ReleaseManifest, ReleaseMismatch, ReleaseSignature, SectionRef, SignatureRecord } from './types';

/** Thrown when a signature does not bind to the release it is attached to. */
export class SignatureBindingError extends Error {
  readonly code = 'signature-hash-mismatch';

  constructor(message: string) {
    super(message);
    this.name = 'SignatureBindingError';
  }
}

/** A signature to bind to a release. `contentHash` must equal the document hash. */
export interface SignatureInput {
  signatureId: string;
  signerId: string;
  meaning: ReleaseSignature['meaning'];
  at: string;
  /** Defaults to the document hash in `createRelease`. Required for `bindSignature`. */
  contentHash?: string;
}

/** Options for {@link createRelease}. */
export interface ReleaseOptions {
  composed: ComposedDocument;
  /** The released document revision. Must match the composed revision. */
  documentRevision: string;
  releasedBy: string;
  releasedAt?: string;
  signatures?: SignatureInput[];
}

function toSignature(input: SignatureInput, documentHash: string): ReleaseSignature {
  const hash = input.contentHash ?? documentHash;
  if (hash !== documentHash) {
    throw new SignatureBindingError(`Signature "${input.signatureId}" is bound to a different document hash`);
  }
  return { signatureId: input.signatureId, signerId: input.signerId, meaning: input.meaning, contentHash: hash, at: input.at };
}

/** Hash of the whole composed document. */
export function documentHashOf(composed: ComposedDocument): Promise<string> {
  return contentHash(composed.document);
}

/**
 * Creates a release manifest for a composed document.
 *
 * @throws {Error} when the revision differs from the composed revision, or a signature is bound to another hash
 */
export async function createRelease(options: ReleaseOptions): Promise<ReleaseManifest> {
  const { composed } = options;
  if (composed.document.properties.revision !== options.documentRevision) {
    throw new Error(`Release revision "${options.documentRevision}" does not match the composed revision`);
  }
  const documentHash = await documentHashOf(composed);
  return {
    documentId: composed.manifestDraft.documentId,
    docNumber: composed.manifestDraft.docNumber,
    revision: options.documentRevision,
    releasedAt: options.releasedAt ?? new Date().toISOString(),
    releasedBy: options.releasedBy,
    sections: composed.manifestDraft.sections.map((s): SectionRef => ({ ...s })),
    documentHash,
    signatures: (options.signatures ?? []).map((s) => toSignature(s, documentHash)),
  };
}

/**
 * Binds a signature to a release. Rejects a signature whose hash is not the manifest's document hash.
 *
 * @throws {SignatureBindingError} on a hash mismatch or duplicate signature id
 */
export function bindSignature(manifest: ReleaseManifest, signature: SignatureInput & { contentHash: string }): ReleaseManifest {
  const bound = toSignature(signature, manifest.documentHash);
  if (manifest.signatures.some((s) => s.signatureId === bound.signatureId)) {
    throw new SignatureBindingError(`Signature "${bound.signatureId}" is already bound`);
  }
  return { ...manifest, signatures: [...manifest.signatures, bound] };
}

/** Attaches the hash of the immutable PDF rendition. */
export async function attachRendition(manifest: ReleaseManifest, pdfBytes: Uint8Array): Promise<ReleaseManifest> {
  return { ...manifest, renditionHash: await sha256Hex(pdfBytes) };
}

/**
 * Recomputes every hash from the composed document and reports mismatches.
 *
 * Checks the document hash, each section's content hash (against the composed section with the same
 * sectionId), each signature's binding, and the rendition hash when bytes are given.
 */
export async function verifyRelease(
  manifest: ReleaseManifest,
  composed: ComposedDocument,
  options: { renditionBytes?: Uint8Array } = {}
): Promise<{ ok: boolean; mismatches: ReleaseMismatch[] }> {
  const mismatches: ReleaseMismatch[] = [];
  if (composed.manifestDraft.documentId !== manifest.documentId) {
    mismatches.push({ kind: 'revision', expected: manifest.documentId, actual: composed.manifestDraft.documentId });
  }
  if (composed.document.properties.revision !== manifest.revision) {
    mismatches.push({ kind: 'revision', expected: manifest.revision, actual: String(composed.document.properties.revision ?? '') });
  }

  const documentHash = await documentHashOf(composed);
  if (documentHash !== manifest.documentHash) {
    mismatches.push({ kind: 'document', expected: manifest.documentHash, actual: documentHash });
  }

  const composedSections = new Map<string, unknown[]>();
  for (const section of composed.document.sections) {
    for (const block of section.blocks) {
      if (block.type === 'controlledSection') {
        composedSections.set(String((block.props as Record<string, unknown>).sectionId ?? ''), block.children ?? []);
      }
    }
  }
  for (const ref of manifest.sections) {
    const children = composedSections.get(ref.sectionId);
    if (!children) {
      mismatches.push({ kind: 'section', sectionId: ref.sectionId, expected: ref.contentHash, actual: 'missing' });
      continue;
    }
    const actual = await sectionContentHash(children as Parameters<typeof sectionContentHash>[0]);
    if (actual !== ref.contentHash) {
      mismatches.push({ kind: 'section', sectionId: ref.sectionId, expected: ref.contentHash, actual });
    }
  }

  for (const sig of manifest.signatures) {
    if (sig.contentHash !== manifest.documentHash) {
      mismatches.push({ kind: 'signature', signatureId: sig.signatureId, expected: manifest.documentHash, actual: sig.contentHash });
    }
  }

  if (manifest.renditionHash !== undefined) {
    if (!options.renditionBytes) {
      mismatches.push({ kind: 'rendition', expected: manifest.renditionHash, actual: 'not supplied' });
    } else {
      const actual = await sha256Hex(options.renditionBytes);
      if (actual !== manifest.renditionHash) mismatches.push({ kind: 'rendition', expected: manifest.renditionHash, actual });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/** Converts a service signature record into a release signature input. */
export function signatureInputFromRecord(record: SignatureRecord, signerId: string): SignatureInput {
  return { signatureId: record.signatureId, signerId, meaning: record.meaning, at: record.signedAt, contentHash: record.contentHash };
}
