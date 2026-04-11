/**
 * Embed block node view: iframe/placeholder + top-right options (⋯ / right-click).
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { deleteMediaNode, updateMediaAttrs } from '../plugins/mediaMenuPlugin';
import type { EmbedProvider } from '../schema/nodes/embed';
import { getEmbedIframeSrc, normalizeEmbedAttrsFromUrl } from '../schema/nodes/embed';

type MenuPanel = 'main' | 'url' | 'caption';

export class EmbedNodeView implements NodeView {
  dom: HTMLElement;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private menuEl: HTMLElement | null = null;
  private menuPanel: MenuPanel = 'main';
  private outsidePointerHandler: (e: MouseEvent) => void;
  private contextMenuHandler: (e: MouseEvent) => void;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;
    this.dom = document.createElement('figure');

    this.outsidePointerHandler = (e: MouseEvent) => {
      if (this.menuEl?.contains(e.target as Node)) return;
      this.closeMenu();
    };

    this.contextMenuHandler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.beakblock-embed__dropdown')) return;
      if ((e.target as HTMLElement).closest('.beakblock-embed__menu-trigger')) return;
      e.preventDefault();
      this.openMenu(e.clientX, e.clientY, 'main');
    };
    this.dom.addEventListener('contextmenu', this.contextMenuHandler);

    this.render(node);
  }

  private pos(): number | undefined {
    const p = this.getPos();
    return typeof p === 'number' ? p : undefined;
  }

  private closeMenu(): void {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    document.removeEventListener('mousedown', this.outsidePointerHandler, true);
  }

  private openMenu(
    atX: number,
    atY: number,
    panel: MenuPanel,
    placeMode: 'at' | 'blockTopRight' = 'at'
  ): void {
    this.closeMenu();
    this.menuPanel = panel;

    const initial = this.currentNode();
    if (!initial) return;

    const menu = document.createElement('div');
    menu.className = 'beakblock-embed__dropdown';
    menu.setAttribute('role', 'menu');

    const snap = (): PMNode => this.currentNode() ?? initial;

    const buildMain = (n: PMNode) => {
      menu.replaceChildren();

      const mainHeader = document.createElement('div');
      mainHeader.className = 'beakblock-embed__dropdown-header';
      mainHeader.textContent = 'Embed options';
      menu.appendChild(mainHeader);

      const addItem = (label: string, sub: MenuPanel | 'remove', title?: string) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'beakblock-embed__dropdown-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = label;
        if (title) btn.title = title;
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (sub === 'remove') {
            const p = this.pos();
            if (p !== undefined) deleteMediaNode(this.view, p);
            this.closeMenu();
            this.view.focus();
            return;
          }
          this.menuPanel = sub;
          refresh();
        });
        menu.appendChild(btn);
      };

      addItem('Edit URL…', 'url', 'Change embed link');
      addItem('Caption…', 'caption', 'Add or edit caption');

      const ratioLabel = document.createElement('div');
      ratioLabel.className = 'beakblock-embed__dropdown-label';
      ratioLabel.textContent = 'Aspect ratio';
      menu.appendChild(ratioLabel);

      for (const ratio of ['16:9', '4:3', '1:1'] as const) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'beakblock-embed__dropdown-item beakblock-embed__dropdown-item--compact';
        b.textContent = ratio;
        b.setAttribute('role', 'menuitem');
        if (String(n.attrs.aspectRatio) === ratio) b.classList.add('beakblock-embed__dropdown-item--active');
        b.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.applyAttrs({ aspectRatio: ratio });
          this.closeMenu();
          this.view.focus();
        });
        menu.appendChild(b);
      }

      addItem('Remove embed', 'remove');

      const hint = document.createElement('p');
      hint.className = 'beakblock-embed__dropdown-hint';
      hint.textContent = 'You can also select the block to use the media toolbar.';
      menu.appendChild(hint);
    };

    const fillUrlForm = (n: PMNode) => {
      menu.replaceChildren();
      const subHeader = document.createElement('div');
      subHeader.className = 'beakblock-embed__dropdown-header beakblock-embed__dropdown-header--sub';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'beakblock-embed__dropdown-back';
      back.textContent = '← Back';
      back.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.menuPanel = 'main';
        refresh();
      });
      const subTitle = document.createElement('span');
      subTitle.className = 'beakblock-embed__dropdown-header-title';
      subTitle.textContent = 'Edit URL';
      subHeader.appendChild(back);
      subHeader.appendChild(subTitle);
      menu.appendChild(subHeader);

      const label = document.createElement('label');
      label.className = 'beakblock-embed__dropdown-field-label';
      label.textContent = 'URL';
      const input = document.createElement('input');
      input.type = 'url';
      input.className = 'beakblock-embed__dropdown-input';
      input.placeholder = 'https://…';
      input.value = String(n.attrs.url ?? '');
      label.appendChild(input);
      menu.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'beakblock-embed__dropdown-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'beakblock-embed__dropdown-btn beakblock-embed__dropdown-btn--ghost';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.menuPanel = 'main';
        refresh();
      });
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'beakblock-embed__dropdown-btn beakblock-embed__dropdown-btn--primary';
      save.textContent = 'Apply';
      save.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const next = normalizeEmbedAttrsFromUrl(input.value);
        this.applyAttrs(next);
        this.closeMenu();
        this.view.focus();
      });
      actions.appendChild(cancel);
      actions.appendChild(save);
      menu.appendChild(actions);
      requestAnimationFrame(() => input.focus());
    };

    const fillCaptionForm = (n: PMNode) => {
      menu.replaceChildren();
      const subHeader = document.createElement('div');
      subHeader.className = 'beakblock-embed__dropdown-header beakblock-embed__dropdown-header--sub';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'beakblock-embed__dropdown-back';
      back.textContent = '← Back';
      back.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.menuPanel = 'main';
        refresh();
      });
      const subTitle = document.createElement('span');
      subTitle.className = 'beakblock-embed__dropdown-header-title';
      subTitle.textContent = 'Caption';
      subHeader.appendChild(back);
      subHeader.appendChild(subTitle);
      menu.appendChild(subHeader);

      const label = document.createElement('label');
      label.className = 'beakblock-embed__dropdown-field-label';
      label.textContent = 'Caption';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'beakblock-embed__dropdown-input';
      input.placeholder = 'Optional caption';
      input.value = String(n.attrs.caption ?? '');
      label.appendChild(input);
      menu.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'beakblock-embed__dropdown-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'beakblock-embed__dropdown-btn beakblock-embed__dropdown-btn--ghost';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.menuPanel = 'main';
        refresh();
      });
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'beakblock-embed__dropdown-btn beakblock-embed__dropdown-btn--primary';
      save.textContent = 'Apply';
      save.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.applyAttrs({ caption: input.value });
        this.closeMenu();
        this.view.focus();
      });
      actions.appendChild(cancel);
      actions.appendChild(save);
      menu.appendChild(actions);
      requestAnimationFrame(() => input.focus());
    };

    const refresh = () => {
      const n = snap();
      if (this.menuPanel === 'url') fillUrlForm(n);
      else if (this.menuPanel === 'caption') fillCaptionForm(n);
      else buildMain(n);
    };

    document.body.appendChild(menu);
    refresh();

    const place = () => {
      const mw = menu.offsetWidth || 220;
      const mh = menu.offsetHeight || 120;
      let x = atX;
      let y = atY;
      if (placeMode === 'blockTopRight') {
        const rect = this.dom.getBoundingClientRect();
        x = rect.right - mw - 8;
        y = rect.top + 8;
      }
      menu.style.position = 'fixed';
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - mw - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - mh - 8))}px`;
      menu.style.zIndex = '10000';
    };
    place();
    requestAnimationFrame(place);

    this.menuEl = menu;
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', this.outsidePointerHandler, true);
    });
  }

  private currentNode(): PMNode | null {
    const p = this.pos();
    if (p === undefined) return null;
    return this.view.state.doc.nodeAt(p);
  }

  private applyAttrs(attrs: Record<string, unknown>): void {
    const p = this.pos();
    if (p === undefined) return;
    updateMediaAttrs(this.view, p, attrs);
  }

  private render(node: PMNode): void {
    const { url, provider, embedId, caption, width, height, aspectRatio, id } = node.attrs;
    const prov = provider as EmbedProvider;
    const embedUrl = getEmbedIframeSrc(prov, String(embedId), String(url));

    this.dom.className = `beakblock-embed beakblock-embed--${provider}`;
    if (id) this.dom.setAttribute('data-block-id', String(id));
    else this.dom.removeAttribute('data-block-id');
    this.dom.setAttribute('data-url', String(url));
    this.dom.setAttribute('data-provider', String(provider));
    this.dom.setAttribute('data-embed-id', String(embedId));
    this.dom.setAttribute('data-aspect-ratio', String(aspectRatio));
    if (width) this.dom.setAttribute('data-width', String(width));
    else this.dom.removeAttribute('data-width');
    if (height) this.dom.setAttribute('data-height', String(height));
    else this.dom.removeAttribute('data-height');

    const w = width ? (typeof width === 'number' ? `${width}px` : String(width)) : '';
    this.dom.style.maxWidth = w || '';

    this.dom.replaceChildren();

    const container = document.createElement('div');
    container.className = 'beakblock-embed-container';
    container.style.aspectRatio = String(aspectRatio).replace(':', '/');

    if (embedUrl) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('src', embedUrl);
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      );
      iframe.setAttribute('loading', 'lazy');
      container.appendChild(iframe);
    } else {
      const ph = document.createElement('div');
      ph.className = 'beakblock-embed-placeholder';
      const span = document.createElement('span');
      span.className = 'beakblock-embed-placeholder-text';
      span.textContent =
        prov === 'twitter'
          ? 'Twitter/X embeds need the block script in your app.'
          : 'Paste a URL to embed';
      ph.appendChild(span);
      ph.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.openMenu(0, 0, 'url', 'blockTopRight');
      });
      container.appendChild(ph);
    }

    this.dom.appendChild(container);

    if (caption) {
      const cap = document.createElement('figcaption');
      cap.className = 'beakblock-embed-caption';
      cap.textContent = String(caption);
      this.dom.appendChild(cap);
    }

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'beakblock-embed__menu-trigger';
    menuTrigger.setAttribute('aria-label', 'Embed options');
    menuTrigger.setAttribute('aria-haspopup', 'true');
    menuTrigger.title = 'Embed options';
    menuTrigger.textContent = '⋯';
    menuTrigger.addEventListener('mousedown', (ev) => ev.preventDefault());
    menuTrigger.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const r = menuTrigger.getBoundingClientRect();
      this.openMenu(r.left, r.bottom + 4, 'main', 'at');
    });
    this.dom.appendChild(menuTrigger);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'embed') return false;
    this.closeMenu();
    this.render(node);
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.closeMenu();
    this.dom.removeEventListener('contextmenu', this.contextMenuHandler);
  }
}
