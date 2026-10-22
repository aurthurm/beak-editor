/**
 * StatusBar - page position, word count, controlled section owner and state, language and presence.
 *
 * Section ownership and state changes are announced through a polite live region (roadmap 5K).
 *
 * @module
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import { countWords, getSectionContext, useEditorTick } from './editorUtils';
import type { SectionContext } from './editorUtils';
import { joinClass } from './shared';

/** A collaborator currently in the document. */
export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

/** Section details shown in the status bar. */
export interface StatusSectionInfo {
  sectionId?: string | null;
  title?: string | null;
  owner?: string | null;
  workflowState?: string | null;
}

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  editor: BeakBlockEditor | null;
  /** Current page and total. Omit to hide the page indicator. */
  pageInfo?: { page: number; total: number };
  /** Section to show. Default: the controlled section containing the selection, if any. */
  sectionInfo?: StatusSectionInfo | null;
  /** Language label, for example `English (South Africa)`. */
  language?: string;
  presence?: PresenceUser[];
  /** Word count. Default: computed from the document. */
  wordCount?: number;
  className?: string;
}

/**
 * Bottom status bar for the Office shell.
 *
 * @example
 * ```tsx
 * <StatusBar editor={editor} pageInfo={{ page: 2, total: 7 }} presence={[{ id: 'u1', name: 'Ada', color: '#2563eb' }]} />
 * ```
 */
export function StatusBar({
  editor,
  pageInfo,
  sectionInfo,
  language,
  presence = [],
  wordCount,
  className,
}: StatusBarProps): React.ReactElement {
  const tick = useEditorTick(editor);

  const derivedWords = useMemo(() => (editor && !editor.isDestroyed ? countWords(editor) : 0), [editor, tick]);
  const derivedSection = useMemo<SectionContext | null>(
    () => (sectionInfo === undefined && editor && !editor.isDestroyed ? getSectionContext(editor) : null),
    [editor, sectionInfo, tick]
  );

  const section: StatusSectionInfo | null =
    sectionInfo !== undefined ? sectionInfo : derivedSection ? derivedSection : null;
  const sectionKey = section ? (section.sectionId ?? section.title ?? 'section') : null;
  const title = section?.title ?? 'Untitled section';
  const owner = section?.owner ?? 'No owner';
  const state = section?.workflowState ?? 'draft';

  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<{ key: string; owner: string; state: string } | null>(null);
  useEffect(() => {
    if (sectionKey === null) {
      previous.current = null;
      return;
    }
    const before = previous.current;
    if (!before || before.key !== sectionKey) {
      setAnnouncement(`Section ${title}. Owner ${owner}. State ${state}.`);
    } else if (before.owner !== owner || before.state !== state) {
      setAnnouncement(`Section ${title} now owned by ${owner}, state ${state}.`);
    }
    previous.current = { key: sectionKey, owner, state };
  }, [sectionKey, title, owner, state]);

  const words = wordCount ?? derivedWords;

  return (
    <div className={joinClass('bb-office-statusbar', className)} role="contentinfo" aria-label="Document status">
      {pageInfo && (
        <span className="bb-office-status-item bb-office-status-page">
          Page {pageInfo.page} of {pageInfo.total}
        </span>
      )}
      <span className="bb-office-status-item bb-office-status-words">
        {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
      </span>
      {section && (
        <span className="bb-office-status-item bb-office-status-section">
          <span className="bb-office-status-label">{title}</span>
          <span className="bb-office-status-separator" aria-hidden="true">&middot;</span>
          <span>Owner: {owner}</span>
          <span className="bb-office-status-separator" aria-hidden="true">&middot;</span>
          <span className="bb-office-status-state" data-state={state}>
            {state}
          </span>
        </span>
      )}
      {language && <span className="bb-office-status-item bb-office-status-language">{language}</span>}
      <span className="bb-office-status-spacer" />
      {presence.length > 0 && (
        <span className="bb-office-presence" role="group" aria-label={`Also here: ${presence.map((user) => user.name).join(', ')}`}>
          {presence.map((user) => (
            <span
              key={user.id}
              className="bb-office-presence-avatar"
              title={user.name}
              style={{ background: user.color }}
            >
              {initials(user.name)}
            </span>
          ))}
        </span>
      )}
      <span className="bb-office-sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
