/** SHA-256 (hex) of UTF-8 text — for content integrity on checkpoints. */
export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
