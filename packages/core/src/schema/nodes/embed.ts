/**
 * Embed node specification.
 *
 * Supports embedding external content like YouTube videos, Twitter posts,
 * CodePen, Figma, and other embed providers.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * Supported embed providers.
 */
export type EmbedProvider =
  | 'youtube'
  | 'vimeo'
  | 'twitter'
  | 'codepen'
  | 'codesandbox'
  | 'figma'
  | 'loom'
  | 'spotify'
  | 'soundcloud'
  | 'generic';

/**
 * Embed node for external content.
 *
 * Renders as an iframe or embedded widget based on the provider.
 */
export const embedNode: NodeSpec = {
  group: 'block',
  atom: true,
  draggable: true,
  attrs: {
    id: { default: null },
    /** The original URL of the embed */
    url: { default: '' },
    /** The embed provider (youtube, twitter, etc.) */
    provider: { default: 'generic' as EmbedProvider },
    /** The embed ID extracted from the URL (video ID, tweet ID, etc.) */
    embedId: { default: '' },
    /** Optional caption */
    caption: { default: '' },
    /** Width in pixels or percentage */
    width: { default: null as number | string | null },
    /** Height in pixels */
    height: { default: null as number | null },
    /** Aspect ratio (e.g., '16:9', '4:3') */
    aspectRatio: { default: '16:9' },
  },
  parseDOM: [
    {
      tag: 'figure.beakblock-embed',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return {
          id: element.getAttribute('data-block-id'),
          url: element.getAttribute('data-url') || '',
          provider: element.getAttribute('data-provider') || 'generic',
          embedId: element.getAttribute('data-embed-id') || '',
          caption: element.querySelector('figcaption')?.textContent || '',
          width: element.getAttribute('data-width'),
          height: element.getAttribute('data-height'),
          aspectRatio: element.getAttribute('data-aspect-ratio') || '16:9',
        };
      },
    },
  ],
  toDOM: (node) => {
    const { url, provider, embedId, caption, width, height, aspectRatio } = node.attrs;
    const embedUrl = getEmbedIframeSrc(provider, embedId, url);

    const style = width ? `max-width: ${typeof width === 'number' ? `${width}px` : width}` : '';

    return [
      'figure',
      {
        class: `beakblock-embed beakblock-embed--${provider}`,
        'data-block-id': node.attrs.id || '',
        'data-url': url,
        'data-provider': provider,
        'data-embed-id': embedId,
        'data-aspect-ratio': aspectRatio,
        ...(width ? { 'data-width': String(width) } : {}),
        ...(height ? { 'data-height': String(height) } : {}),
        style,
      },
      [
        'div',
        {
          class: 'beakblock-embed-container',
          style: `aspect-ratio: ${aspectRatio.replace(':', '/')}`,
        },
        embedUrl
          ? [
              'iframe',
              {
                src: embedUrl,
                frameborder: '0',
                allowfullscreen: 'true',
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                loading: 'lazy',
              },
            ]
          : [
              'div',
              { class: 'beakblock-embed-placeholder' },
              ['span', { class: 'beakblock-embed-placeholder-text' }, 'Paste a URL to embed'],
            ],
      ],
      ...(caption
        ? [['figcaption', { class: 'beakblock-embed-caption' }, caption]]
        : []),
    ];
  },
};

/**
 * Normalizes pasted/typed URL into embed attrs (provider + embed id + stored URL).
 */
export function normalizeEmbedAttrsFromUrl(url: string): {
  url: string;
  provider: EmbedProvider;
  embedId: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: '', provider: 'generic', embedId: '' };
  }
  const parsed = parseEmbedUrl(trimmed);
  if (parsed) {
    return { url: trimmed, provider: parsed.provider, embedId: parsed.embedId };
  }
  return { url: trimmed, provider: 'generic', embedId: trimmed };
}

/**
 * Resolved iframe `src` for an embed node (exported for node views and tests).
 */
export function getEmbedIframeSrc(provider: EmbedProvider, embedId: string, originalUrl: string): string {
  if (!embedId && !originalUrl) return '';

  switch (provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${embedId}`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${embedId}`;
    case 'twitter':
      // Twitter embeds use their widget script, not iframe
      return '';
    case 'codepen':
      return `https://codepen.io/${embedId}/embed/preview`;
    case 'codesandbox':
      return `https://codesandbox.io/embed/${embedId}`;
    case 'figma':
      return `https://www.figma.com/embed?embed_host=beakblock&url=${encodeURIComponent(originalUrl)}`;
    case 'loom':
      return `https://www.loom.com/embed/${embedId}`;
    case 'spotify':
      return `https://open.spotify.com/embed/${embedId}`;
    case 'soundcloud':
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(originalUrl)}&auto_play=false`;
    case 'generic':
    default:
      return originalUrl;
  }
}

/**
 * Parses a URL and extracts embed information.
 *
 * @param url - The URL to parse
 * @returns Provider and embed ID, or null if not recognized
 */
export function parseEmbedUrl(url: string): { provider: EmbedProvider; embedId: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    // YouTube
    if (hostname === 'youtube.com' || hostname === 'youtu.be') {
      let videoId = '';
      if (hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v') || '';
        // Handle /embed/ URLs
        if (!videoId && urlObj.pathname.startsWith('/embed/')) {
          videoId = urlObj.pathname.split('/embed/')[1];
        }
      }
      if (videoId) {
        return { provider: 'youtube', embedId: videoId };
      }
    }

    // Vimeo
    if (hostname === 'vimeo.com') {
      const match = urlObj.pathname.match(/\/(\d+)/);
      if (match) {
        return { provider: 'vimeo', embedId: match[1] };
      }
    }

    // Twitter/X
    if (hostname === 'twitter.com' || hostname === 'x.com') {
      const match = urlObj.pathname.match(/\/\w+\/status\/(\d+)/);
      if (match) {
        return { provider: 'twitter', embedId: match[1] };
      }
    }

    // CodePen
    if (hostname === 'codepen.io') {
      const match = urlObj.pathname.match(/\/(\w+)\/pen\/(\w+)/);
      if (match) {
        return { provider: 'codepen', embedId: `${match[1]}/pen/${match[2]}` };
      }
    }

    // CodeSandbox
    if (hostname === 'codesandbox.io') {
      const match = urlObj.pathname.match(/\/s\/([^/]+)/);
      if (match) {
        return { provider: 'codesandbox', embedId: match[1] };
      }
    }

    // Figma
    if (hostname === 'figma.com') {
      if (urlObj.pathname.includes('/file/') || urlObj.pathname.includes('/proto/')) {
        return { provider: 'figma', embedId: url };
      }
    }

    // Loom
    if (hostname === 'loom.com') {
      const match = urlObj.pathname.match(/\/share\/([^/]+)/);
      if (match) {
        return { provider: 'loom', embedId: match[1] };
      }
    }

    // Spotify
    if (hostname === 'open.spotify.com') {
      const match = urlObj.pathname.match(/\/(track|album|playlist|episode)\/([^/]+)/);
      if (match) {
        return { provider: 'spotify', embedId: `${match[1]}/${match[2]}` };
      }
    }

    // SoundCloud
    if (hostname === 'soundcloud.com') {
      return { provider: 'soundcloud', embedId: url };
    }

    // Generic - try to embed as iframe
    return { provider: 'generic', embedId: url };
  } catch {
    return null;
  }
}
