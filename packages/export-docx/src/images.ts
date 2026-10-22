/**
 * Image decoding and intrinsic size detection for embedded pictures.
 *
 * Only `data:` URIs are embedded. Remote URLs are reported as losses by the writer.
 *
 * @module
 */

import { strToU8 } from 'fflate';

/** A decoded embedded image. */
export interface DecodedImage {
  mime: string;
  bytes: Uint8Array;
}

/** Image formats Word reads without a fallback. */
export const SUPPORTED_IMAGE_TYPES: Readonly<Record<string, { ext: string; contentType: string }>> = {
  'image/png': { ext: 'png', contentType: 'image/png' },
  'image/jpeg': { ext: 'jpeg', contentType: 'image/jpeg' },
  'image/jpg': { ext: 'jpeg', contentType: 'image/jpeg' },
  'image/gif': { ext: 'gif', contentType: 'image/gif' },
};

function base64ToBytes(payload: string): Uint8Array | null {
  const decode = (globalThis as { atob?: (value: string) => string }).atob;
  if (!decode) return null;
  try {
    const binary = decode(payload.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Decodes a `data:` URI. Returns `null` for anything that is not a decodable data URI.
 *
 * @example
 * ```typescript
 * decodeDataUri('data:image/png;base64,iVBORw0KGgo=')?.mime; // 'image/png'
 * ```
 */
export function decodeDataUri(src: string): DecodedImage | null {
  if (!src.startsWith('data:')) return null;
  const comma = src.indexOf(',');
  if (comma < 0) return null;
  const header = src.slice(5, comma);
  const payload = src.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mime = header.split(';')[0].trim().toLowerCase();
  if (!mime) return null;
  if (isBase64) {
    const bytes = base64ToBytes(payload);
    return bytes ? { mime, bytes } : null;
  }
  try {
    return { mime, bytes: strToU8(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

/** Intrinsic pixel dimensions from PNG, GIF or JPEG headers, or `null` when unknown. */
export function intrinsicSize(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG: IHDR width and height are big-endian at offsets 16 and 20.
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // GIF: logical screen width and height are little-endian at offsets 6 and 8.
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  // JPEG: walk segments until a start-of-frame marker.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let index = 2;
    while (index + 9 < bytes.length) {
      if (bytes[index] !== 0xff) return null;
      const marker = bytes[index + 1];
      if (marker === 0xff) {
        index += 1;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) {
        return { height: (bytes[index + 5] << 8) | bytes[index + 6], width: (bytes[index + 7] << 8) | bytes[index + 8] };
      }
      index += 2 + ((bytes[index + 2] << 8) | bytes[index + 3]);
    }
  }
  return null;
}
