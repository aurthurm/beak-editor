/**
 * Package-level reading: zip entries, relationships, media and document properties.
 *
 * @module
 */

import { unzipSync } from 'fflate';

import { anyAttr, childrenNamed, child, kids, parseXml, textOf, type DomParserLike } from './dom';
import type { Relationship } from './context';
import type { DocumentProperties } from './model';

/** Unzips a DOCX package. Throws when the bytes are not a zip archive. */
export function readPackage(bytes: Uint8Array | ArrayBuffer): Record<string, Uint8Array> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return unzipSync(data);
}

/** Decodes a package entry as UTF-8 text, or `null` when absent. */
export function readText(files: Record<string, Uint8Array>, path: string): string | null {
  const data = files[path];
  if (!data) return null;
  return new TextDecoder('utf-8').decode(data);
}

/** Relationships part path for a part, e.g. `word/_rels/document.xml.rels`. */
export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  const dir = slash >= 0 ? partPath.slice(0, slash) : '';
  const name = slash >= 0 ? partPath.slice(slash + 1) : partPath;
  return dir ? `${dir}/_rels/${name}.rels` : `_rels/${name}.rels`;
}

/** Resolves a relationship target against the directory of its source part. */
export function resolvePartPath(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const slash = sourcePart.lastIndexOf('/');
  const segments = (slash >= 0 ? sourcePart.slice(0, slash) : '').split('/').filter(Boolean);
  for (const part of target.split('/')) {
    if (part === '..') segments.pop();
    else if (part !== '.' && part !== '') segments.push(part);
  }
  return segments.join('/');
}

/** Parses the relationships part of `partPath`. Missing or malformed parts yield an empty map. */
export function readRelationships(
  files: Record<string, Uint8Array>,
  partPath: string,
  parser: DomParserLike,
): Map<string, Relationship> {
  const out = new Map<string, Relationship>();
  const xml = readText(files, relsPathFor(partPath));
  if (xml === null) return out;
  const doc = parseXml(xml, parser);
  if (!doc) return out;
  for (const rel of childrenNamed(doc.documentElement, 'Relationship')) {
    const id = anyAttr(rel, 'Id');
    const type = anyAttr(rel, 'Type') ?? '';
    const rawTarget = anyAttr(rel, 'Target') ?? '';
    const external = anyAttr(rel, 'TargetMode') === 'External';
    if (!id) continue;
    out.set(id, { type, target: external ? rawTarget : resolvePartPath(partPath, rawTarget), external });
  }
  return out;
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  emf: 'image/emf',
  wmf: 'image/wmf',
  webp: 'image/webp',
};

/** MIME type for a media part, from its extension. */
export function mimeForPath(path: string): string {
  const dot = path.lastIndexOf('.');
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** Encodes bytes as a base64 `data:` URI. */
export function toDataUri(mime: string, bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Document property names that map to dedicated `DocumentProperties` fields. */
const NAMED_PROPS = ['title', 'docNumber', 'revision', 'effectiveDate', 'owner', 'lab'] as const;

/**
 * Reads `docProps/core.xml` (title, revision) and `docProps/custom.xml`
 * (docNumber, revision, effectiveDate, owner, lab, and all other names as `custom`).
 */
export function readDocumentProperties(files: Record<string, Uint8Array>, parser: DomParserLike): DocumentProperties {
  const props: DocumentProperties = {};
  const core = readText(files, 'docProps/core.xml');
  if (core) {
    const doc = parseXml(core, parser);
    const root = doc?.documentElement;
    if (root) {
      for (const el of kids(root)) {
        if (el.localName === 'title' && textOf(el)) props.title = textOf(el);
        if (el.localName === 'revision' && textOf(el)) props.revision = textOf(el);
      }
    }
  }

  const custom = readText(files, 'docProps/custom.xml');
  if (custom) {
    const doc = parseXml(custom, parser);
    const root = doc?.documentElement;
    const values: Record<string, string> = {};
    for (const prop of childrenNamed(root, 'property')) {
      const name = anyAttr(prop, 'name');
      const value = kids(prop)[0];
      if (!name || !value) continue;
      values[name] = textOf(value);
    }
    for (const key of NAMED_PROPS) {
      if (values[key] !== undefined && values[key] !== '') props[key] = values[key];
      delete values[key];
    }
    if (Object.keys(values).length > 0) props.custom = values;
  }
  return props;
}

/** Returns the `w:body` element of a document part root, if present. */
export function bodyOf(doc: Document): Element | null {
  return child(doc.documentElement, 'body');
}
