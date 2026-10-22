/**
 * Interactive node views for form controls.
 *
 * Inputs write their value back into the node's attrs through a transaction. Read-only
 * fields and an editor that is not editable both disable the control. Keyboard and
 * mouse events inside a control stay with the control.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';

/** Formats a calculated value using the node's `decimals` attr. */
export function formatCalculated(value: unknown, decimals: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value !== 'number') return String(value);
  const places = typeof decimals === 'number' ? decimals : Number(decimals);
  return Number.isFinite(places) ? value.toFixed(Math.max(0, Math.min(10, Math.trunc(places)))) : String(value);
}

/**
 * Node view for one form field. Renders a labelled control appropriate to the
 * field type; `formCalculated` renders a read-only value.
 */
export class FormControlView implements NodeView {
  dom: HTMLElement;
  private readonly controls: HTMLElement[] = [];
  private readonly labelEl: HTMLElement;
  private valueEl: HTMLElement | null = null;
  private node: PMNode;

  constructor(
    node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined
  ) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = `beakblock-form-field beakblock-form-${node.type.name}`;
    this.dom.setAttribute('data-form-field', node.type.name);
    this.dom.setAttribute('contenteditable', 'false');

    const wrapper = document.createElement('label');
    wrapper.className = 'beakblock-form-control';
    this.labelEl = document.createElement('span');
    this.labelEl.className = 'beakblock-form-label';
    wrapper.appendChild(this.labelEl);

    if (node.type.name === 'formCalculated') {
      this.valueEl = document.createElement('span');
      this.valueEl.className = 'beakblock-form-calculated-value';
      wrapper.appendChild(this.valueEl);
    } else {
      this.buildControls(wrapper);
    }
    this.dom.appendChild(wrapper);
    this.sync();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync();
    return true;
  }

  /** Keep all events inside the control away from the editor. */
  stopEvent(): boolean {
    return true;
  }

  /** Form controls own their DOM; mutations inside them are not document changes. */
  ignoreMutation(): boolean {
    return true;
  }

  private buildControls(wrapper: HTMLElement): void {
    const type = this.node.type.name;
    if (type === 'formDropdown') {
      const select = document.createElement('select');
      select.addEventListener('change', () => this.commit(select.value === '' ? null : select.value));
      wrapper.appendChild(select);
      this.controls.push(select);
    } else if (type === 'formRadio') {
      // One input per option is created in sync(); the group is rebuilt when options change.
      const group = document.createElement('span');
      group.className = 'beakblock-form-radio-group';
      wrapper.appendChild(group);
      this.controls.push(group);
    } else if (type === 'formCheckbox') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => this.commit(input.checked));
      wrapper.appendChild(input);
      this.controls.push(input);
    } else {
      const input = document.createElement('input');
      input.type = type === 'formNumber' ? 'number' : type === 'formDate' ? 'date' : 'text';
      input.addEventListener('input', () => {
        if (type === 'formNumber') {
          const parsed = input.value === '' ? NaN : Number(input.value);
          this.commit(Number.isFinite(parsed) ? parsed : null);
        } else {
          this.commit(input.value === '' ? null : input.value);
        }
      });
      wrapper.appendChild(input);
      this.controls.push(input);
    }

    const unit = document.createElement('span');
    unit.className = 'beakblock-form-unit';
    wrapper.appendChild(unit);
    this.valueEl = unit;
  }

  private sync(): void {
    const attrs = this.node.attrs as Record<string, unknown>;
    const type = this.node.type.name;
    const required = attrs.required === true;
    const label = String(attrs.label || attrs.name || '');
    this.labelEl.textContent = required ? `${label} *` : label;
    this.dom.classList.toggle('beakblock-form-readonly', attrs.readOnly === true);
    this.dom.setAttribute('data-required', String(required));

    if (type === 'formCalculated') {
      if (this.valueEl) this.valueEl.textContent = formatCalculated(attrs.value, attrs.decimals);
      return;
    }

    const disabled = attrs.readOnly === true || !this.view.editable;
    for (const control of this.controls) {
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
        control.disabled = disabled;
      }
    }

    if (type === 'formDropdown') {
      const select = this.controls[0] as HTMLSelectElement;
      this.fillOptions(select, attrs.options, attrs.value, attrs.placeholder);
    } else if (type === 'formRadio') {
      const group = this.controls[0] as HTMLElement;
      this.fillRadios(group, attrs, disabled);
    } else if (type === 'formCheckbox') {
      const input = this.controls[0] as HTMLInputElement;
      input.checked = attrs.value === true;
    } else {
      const input = this.controls[0] as HTMLInputElement;
      if (input.ownerDocument.activeElement !== input) {
        const next = attrs.value === null || attrs.value === undefined ? '' : String(attrs.value);
        if (input.value !== next) input.value = next;
      }
      if (type === 'formNumber') {
        input.min = attrs.min === null || attrs.min === undefined ? '' : String(attrs.min);
        input.max = attrs.max === null || attrs.max === undefined ? '' : String(attrs.max);
        input.step = attrs.decimals === null || attrs.decimals === undefined ? 'any' : String(10 ** -Number(attrs.decimals));
        input.placeholder = String(attrs.placeholder ?? '');
      }
      if (type === 'formDate') {
        input.min = typeof attrs.min === 'string' ? attrs.min : '';
        input.max = typeof attrs.max === 'string' ? attrs.max : '';
      }
      if (type === 'formText') input.placeholder = String(attrs.placeholder ?? '');
      if (this.valueEl) {
        const unit = attrs.unit;
        this.valueEl.textContent = typeof unit === 'string' ? unit : '';
      }
    }
  }

  private fillOptions(select: HTMLSelectElement, options: unknown, value: unknown, placeholder: unknown): void {
    const list = Array.isArray(options) ? options.map(String) : [];
    const wanted = list.join('\u0001');
    if (select.dataset.options !== wanted) {
      select.dataset.options = wanted;
      select.textContent = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = String(placeholder || '-- select --');
      select.appendChild(empty);
      for (const option of list) {
        const el = document.createElement('option');
        el.value = option;
        el.textContent = option;
        select.appendChild(el);
      }
    }
    select.value = value === null || value === undefined ? '' : String(value);
  }

  private fillRadios(group: HTMLElement, attrs: Record<string, unknown>, disabled: boolean): void {
    const list = Array.isArray(attrs.options) ? attrs.options.map(String) : [];
    const groupName = `beakblock-radio-${String(attrs.id ?? attrs.name ?? 'field')}`;
    const wanted = `${groupName}|${list.join('\u0001')}`;
    if (group.dataset.options !== wanted) {
      group.dataset.options = wanted;
      group.textContent = '';
      for (const option of list) {
        const row = document.createElement('label');
        row.className = 'beakblock-form-radio';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = groupName;
        input.value = option;
        input.addEventListener('change', () => this.commit(option));
        const text = document.createElement('span');
        text.textContent = option;
        row.append(input, text);
        group.appendChild(row);
      }
    }
    const current = attrs.value === null || attrs.value === undefined ? null : String(attrs.value);
    group.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      input.checked = input.value === current;
      input.disabled = disabled;
    });
  }

  /** Writes a new value into the node's attrs. */
  private commit(value: unknown): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const node = this.view.state.doc.nodeAt(pos);
    if (!node || node.type !== this.node.type) return;
    if (node.attrs.readOnly === true || !this.view.editable) return;
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value }));
  }
}

/** Node view constructor for every form field type. */
export function createFormControlView(): NodeViewConstructor {
  return (node, view, getPos) => new FormControlView(node, view, getPos);
}
