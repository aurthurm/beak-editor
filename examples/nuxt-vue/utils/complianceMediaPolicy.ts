/**
 * Allowed image hosts for compliance demo (block arbitrary hotlinks).
 * Extend or replace in production (env-driven list, CSP, etc.).
 */
export const DEFAULT_COMPLIANCE_IMAGE_HOST_ALLOWLIST = [
  'upload.wikimedia.org',
  'plus.unsplash.com',
  'images.unsplash.com',
];

export function isImageSrcAllowed(src: string, allowlist: readonly string[]): boolean {
  try {
    const u = new URL(src);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return allowlist.some((h) => host === h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`));
  } catch {
    return false;
  }
}
