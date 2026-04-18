import { createHash } from 'node:crypto';

/**
 * SHA-256 of a compliance export payload for independent verification.
 *
 * Matches the browser: `JSON.stringify(bundle, null, 2)` then UTF-8 SHA-256 hex
 * (see `buildComplianceExportPayload` in utils/complianceExport — checksum excludes `exportChecksum`).
 *
 * Body:
 * - `{ "bundle": { ... } }` — canonical stringification applied server-side
 * - `{ "raw": "<exact json string>" }` — hash the raw string (use when key order must match a file byte-for-byte)
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let utf8: string;
  if (body && typeof body === 'object' && 'raw' in body && typeof (body as { raw: unknown }).raw === 'string') {
    utf8 = (body as { raw: string }).raw;
  } else if (body && typeof body === 'object' && 'bundle' in body) {
    utf8 = JSON.stringify((body as { bundle: unknown }).bundle, null, 2);
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Expected JSON body { bundle: object } or { raw: string }',
    });
  }

  const checksum = createHash('sha256').update(utf8, 'utf8').digest('hex');
  return { algorithm: 'sha256', encoding: 'hex', checksum };
});
