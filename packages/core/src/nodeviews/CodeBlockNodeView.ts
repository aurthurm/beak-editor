/**
 * Code block with a line-number gutter (non-editable).
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view';

function lineCountFromText(text: string): number {
  if (text.length === 0) return 1;
  return text.split(/\n/).length;
}

function gutterText(lineCount: number): string {
  return Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n');
}

export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly gutter: HTMLElement;

  constructor(node: PMNode, _view: EditorView, _getPos: () => number | undefined) {
    this.dom = document.createElement('pre');
    this.dom.className = 'beakblock-code-block';
    if (node.attrs.id) {
      this.dom.setAttribute('data-block-id', String(node.attrs.id));
    }

    this.gutter = document.createElement('span');
    this.gutter.className = 'beakblock-code-block__gutter';
    this.gutter.setAttribute('aria-hidden', 'true');

    this.contentDOM = document.createElement('code');
    this.applyLanguageAttrs(this.contentDOM, String(node.attrs.language || ''));

    this.dom.appendChild(this.gutter);
    this.dom.appendChild(this.contentDOM);

    this.refreshGutter(node);
  }

  private applyLanguageAttrs(codeEl: HTMLElement, language: string): void {
    if (language) {
      codeEl.setAttribute('data-language', language);
      codeEl.className = `language-${language}`;
    } else {
      codeEl.removeAttribute('data-language');
      codeEl.className = '';
    }
  }

  private refreshGutter(node: PMNode): void {
    const n = lineCountFromText(node.textContent);
    this.gutter.textContent = gutterText(n);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'codeBlock') return false;
    if (node.attrs.id) {
      this.dom.setAttribute('data-block-id', String(node.attrs.id));
    } else {
      this.dom.removeAttribute('data-block-id');
    }
    this.applyLanguageAttrs(this.contentDOM, String(node.attrs.language || ''));
    this.refreshGutter(node);
    return true;
  }

  ignoreMutation(record: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(record.target as Node);
  }
}
