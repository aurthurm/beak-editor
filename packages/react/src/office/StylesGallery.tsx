/**
 * StylesGallery (quick styles) and StylesPane (full list) for paragraph styles.
 *
 * A style runs its registry command when one is named, and sets the paragraph's
 * `styleId` attribute when it has one. Both can apply together, so `Heading 1` runs
 * the heading command and then records `styleId: 'Heading1'`.
 *
 * @module
 */

import React from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import { getParagraphContext, updateParagraphAttrs, useEditorTick } from './editorUtils';
import { joinClass } from './shared';

/** A paragraph style offered by the gallery and the styles pane. */
export interface OfficeStyleDefinition {
  /** Stable style id, stored in `styleId`. */
  id: string;
  label: string;
  /** Registry command that applies the style (for example `paragraph.style.heading1`). */
  command?: string;
  /** Value written to the paragraph's `styleId` attribute. Defaults to `id`. */
  styleId?: string;
  /** Preview font size in px in the gallery and pane. */
  previewSize?: number;
  /** Preview weight. */
  previewWeight?: number;
}

/** The built-in quick styles. */
export const DEFAULT_OFFICE_STYLES: OfficeStyleDefinition[] = [
  { id: 'Normal', label: 'Normal', command: 'paragraph.style.normal', previewSize: 13 },
  { id: 'Title', label: 'Title', command: 'paragraph.style.title', previewSize: 22, previewWeight: 300 },
  { id: 'Heading1', label: 'Heading 1', command: 'paragraph.style.heading1', previewSize: 18, previewWeight: 600 },
  { id: 'Heading2', label: 'Heading 2', command: 'paragraph.style.heading2', previewSize: 15, previewWeight: 600 },
  { id: 'Heading3', label: 'Heading 3', command: 'paragraph.style.heading3', previewSize: 13, previewWeight: 600 },
  { id: 'Quote', label: 'Quote', command: 'paragraph.style.quote', previewSize: 13 },
  { id: 'Caption', label: 'Caption', previewSize: 11 },
];

/** Props shared by {@link StylesGallery} and {@link StylesPane}. */
export interface StylesProps {
  editor: BeakBlockEditor | null;
  /** Registry used to run style commands. Without it, styles only set `styleId`. */
  registry?: CommandRegistry | null;
  /** Styles to show. Default {@link DEFAULT_OFFICE_STYLES}. */
  styles?: OfficeStyleDefinition[];
  className?: string;
}

/** Apply a style to the selection's paragraph. Returns true when something was applied. */
export function applyOfficeStyle(
  editor: BeakBlockEditor,
  style: OfficeStyleDefinition,
  registry?: CommandRegistry | null
): boolean {
  let applied = false;
  if (style.command && registry?.canExecute(style.command)) {
    applied = registry.execute(style.command);
  }
  // Record the style id when the style defines one, when it has no command, or after its command ran
  // so the gallery can highlight command-only styles too.
  if (style.styleId !== undefined || !style.command || applied) {
    const paragraph = getParagraphContext(editor);
    if (paragraph) {
      applied = updateParagraphAttrs(editor, paragraph.pos, { styleId: style.styleId ?? style.id }) || applied;
    }
  }
  if (applied) editor.pm.view.focus();
  return applied;
}

/** Whether a style is active at the selection. */
function isStyleActive(
  style: OfficeStyleDefinition,
  registry: CommandRegistry | null | undefined,
  currentStyleId: string | null
): boolean {
  if (currentStyleId !== null && currentStyleId === (style.styleId ?? style.id)) return true;
  return !!style.command && !!registry?.isActive(style.command);
}

/** The styleId of the paragraph at the selection, or null. */
function currentStyleIdOf(editor: BeakBlockEditor | null): string | null {
  if (!editor || editor.isDestroyed) return null;
  const paragraph = getParagraphContext(editor);
  const value = paragraph?.node.attrs.styleId;
  return typeof value === 'string' && value ? value : null;
}

function previewStyle(style: OfficeStyleDefinition): React.CSSProperties {
  return {
    fontSize: style.previewSize ?? 13,
    fontWeight: style.previewWeight ?? 400,
    fontStyle: style.id === 'Quote' ? 'italic' : undefined,
  };
}

/**
 * Horizontal gallery of quick styles, shown in the Home ribbon or a sidebar.
 *
 * @example
 * ```tsx
 * <StylesGallery registry={registry} editor={editor} />
 * ```
 */
export function StylesGallery({ editor, registry, styles = DEFAULT_OFFICE_STYLES, className }: StylesProps): React.ReactElement {
  useEditorTick(editor);
  const current = currentStyleIdOf(editor);
  return (
    <div className={joinClass('bb-office-styles-gallery', className)} role="toolbar" aria-label="Quick styles">
      {styles.map((style) => {
        const active = isStyleActive(style, registry, current);
        return (
          <button
            key={style.id}
            type="button"
            className={joinClass('bb-office-style-tile', active && 'is-active')}
            aria-pressed={active}
            disabled={!editor}
            title={style.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor && applyOfficeStyle(editor, style, registry)}
          >
            <span className="bb-office-style-tile-preview" style={previewStyle(style)}>
              {style.label === 'Title' ? 'Title' : 'Aa'}
            </span>
            <span className="bb-office-style-tile-label">{style.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Vertical list of all styles, with the paragraph's current style highlighted.
 */
export function StylesPane({ editor, registry, styles = DEFAULT_OFFICE_STYLES, className }: StylesProps): React.ReactElement {
  useEditorTick(editor);
  const current = currentStyleIdOf(editor);
  return (
    <div className={joinClass('bb-office-styles-pane', className)}>
      <h3 className="bb-office-pane-title">Styles</h3>
      <ul className="bb-office-styles-list" aria-label="Paragraph styles">
        {styles.map((style) => {
          const active = isStyleActive(style, registry, current);
          return (
            <li key={style.id}>
              <button
                type="button"
                className={joinClass('bb-office-style-item', active && 'is-active')}
                aria-current={active ? 'true' : undefined}
                disabled={!editor}
                onClick={() => editor && applyOfficeStyle(editor, style, registry)}
              >
                <span className="bb-office-style-item-preview" style={previewStyle(style)}>
                  {style.label}
                </span>
                <span className="bb-office-style-item-id">{style.styleId ?? style.id}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
