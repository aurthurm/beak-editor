/**
 * Interactive TOC: click entries to scroll to headings; options menu to refresh outline.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';

import type { TocHeadingItem } from '../schema/nodes/tableOfContents';
import { refreshAllTableOfContents } from '../plugins/tableOfContentsPlugin';

export class TableOfContentsNodeView implements NodeView {
  dom: HTMLElement;
  private readonly view: EditorView;
  private clickHandler: (e: MouseEvent) => void;
  private contextMenuHandler: (e: MouseEvent) => void;
  private outsidePointerHandler: (e: MouseEvent) => void;
  private menuEl: HTMLElement | null = null;

  constructor(node: PMNode, view: EditorView, _getPos: () => number | undefined) {
    this.view = view;
    this.dom = document.createElement('nav');
    this.dom.className = 'beakblock-toc';
    this.dom.setAttribute('data-beakblock-toc', 'true');
    this.dom.setAttribute('aria-label', 'Table of contents');
    if (node.attrs.id) {
      this.dom.setAttribute('data-block-id', String(node.attrs.id));
    }

    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.beakblock-toc__dropdown')) return;
      const btn = target?.closest?.('button[data-toc-target-id]') as HTMLButtonElement | null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const hid = btn.getAttribute('data-toc-target-id');
      if (hid) this.scrollToHeading(hid);
    };
    this.dom.addEventListener('click', this.clickHandler);

    this.contextMenuHandler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('.beakblock-toc__dropdown')) return;
      e.preventDefault();
      this.openMenu(e.clientX, e.clientY);
    };
    this.dom.addEventListener('contextmenu', this.contextMenuHandler);

    this.outsidePointerHandler = (e: MouseEvent) => {
      if (!this.menuEl) return;
      if (this.menuEl.contains(e.target as Node)) return;
      this.closeMenu();
    };

    this.render(node);
  }

  private openMenu(atX: number, atY: number): void {
    this.closeMenu();
    const menu = document.createElement('div');
    menu.className = 'beakblock-toc__dropdown';
    menu.setAttribute('role', 'menu');

    const header = document.createElement('div');
    header.className = 'beakblock-toc__dropdown-header';
    header.textContent = 'Outline options';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'beakblock-toc__dropdown-item';
    refreshBtn.setAttribute('role', 'menuitem');
    refreshBtn.textContent = 'Refresh outline';
    refreshBtn.title = 'Re-scan headings now (usually automatic when you edit)';
    refreshBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      refreshAllTableOfContents(this.view);
      this.closeMenu();
    });

    const hint = document.createElement('p');
    hint.className = 'beakblock-toc__dropdown-hint';
    hint.textContent = 'The outline updates automatically when headings change.';

    menu.appendChild(header);
    menu.appendChild(refreshBtn);
    menu.appendChild(hint);

    document.body.appendChild(menu);
    const rect = this.dom.getBoundingClientRect();
    let x = atX;
    let y = atY;
    if (x === 0 && y === 0) {
      x = rect.right - 8;
      y = rect.bottom + 4;
    }
    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(x, window.innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - 8)}px`;
    menu.style.zIndex = '10000';

    this.menuEl = menu;
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', this.outsidePointerHandler, true);
    });
  }

  private closeMenu(): void {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    document.removeEventListener('mousedown', this.outsidePointerHandler, true);
  }

  private scrollToHeading(headingId: string): void {
    const { state, dispatch } = this.view;
    const { doc } = state;
    let foundPos: number | null = null;
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && String(node.attrs.id) === headingId) {
        foundPos = pos;
        return false;
      }
    });
    if (foundPos === null) return;

    const pos = foundPos;
    const $pos = doc.resolve(pos + 1);
    const sel = TextSelection.near($pos);
    dispatch(state.tr.setSelection(sel).scrollIntoView());
    this.view.focus();

    const nodeDom = this.view.nodeDOM(pos);
    if (nodeDom instanceof HTMLElement) {
      nodeDom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private render(node: PMNode): void {
    let items: TocHeadingItem[] = [];
    try {
      items = JSON.parse(String(node.attrs.itemsJson ?? '[]')) as TocHeadingItem[];
    } catch {
      items = [];
    }

    this.dom.replaceChildren();

    const header = document.createElement('div');
    header.className = 'beakblock-toc__header';

    const label = document.createElement('div');
    label.className = 'beakblock-toc__label';
    label.textContent = 'Table of contents';

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'beakblock-toc__menu-trigger';
    menuTrigger.setAttribute('aria-label', 'Outline options');
    menuTrigger.setAttribute('aria-haspopup', 'true');
    menuTrigger.title = 'Outline options';
    menuTrigger.textContent = '⋯';
    menuTrigger.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const r = menuTrigger.getBoundingClientRect();
      this.openMenu(r.left, r.bottom + 4);
    });

    header.appendChild(label);
    this.dom.appendChild(header);
    this.dom.appendChild(menuTrigger);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'beakblock-toc__empty';
      empty.textContent = 'Add headings to populate this outline.';
      this.dom.appendChild(empty);
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'beakblock-toc__list';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'beakblock-toc__item';
      li.style.setProperty('--beakblock-toc-level', String(item.level));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'beakblock-toc__link';
      btn.textContent = item.text;
      btn.setAttribute('data-toc-target-id', item.id);
      btn.title = `Go to: ${item.text}`;
      li.appendChild(btn);
      ul.appendChild(li);
    }
    this.dom.appendChild(ul);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'tableOfContents') return false;
    if (node.attrs.id) {
      this.dom.setAttribute('data-block-id', String(node.attrs.id));
    }
    this.render(node);
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.closeMenu();
    this.dom.removeEventListener('click', this.clickHandler);
    this.dom.removeEventListener('contextmenu', this.contextMenuHandler);
  }
}
