/**
 * NavigationPane - headings outline, controlled sections, comments, search and page thumbnails.
 *
 * Comments and pages come from props because the comment store and page layout live
 * outside the editor. Headings, sections and search read the live document.
 *
 * @module
 */

import React, { useId, useMemo, useState } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import { findMatches } from './findEngine';
import type { SearchMatch } from './findEngine';
import { getHeadings, selectRange, useEditorTick } from './editorUtils';
import { joinClass } from './shared';

/** Available navigation tabs. */
export type NavigationTabId = 'headings' | 'sections' | 'comments' | 'search' | 'pages';

/** A comment shown in the comments tab. */
export interface NavigationComment {
  id: string;
  author?: string;
  body: string;
  /** Quoted text the comment is anchored to. */
  quote?: string;
  status?: 'open' | 'resolved';
  /** Document position of the anchor. When set, selecting the comment moves the caret there. */
  pos?: number;
}

/** A page thumbnail in the pages tab. */
export interface NavigationPage {
  number: number;
  label?: string;
}

/** Props for {@link NavigationPane}. */
export interface NavigationPaneProps {
  editor: BeakBlockEditor | null;
  /** Tabs to show, in order. Default: all five. */
  tabs?: NavigationTabId[];
  /** Initially selected tab. Default: the first entry of `tabs`. */
  defaultTab?: NavigationTabId;
  comments?: NavigationComment[];
  pages?: NavigationPage[];
  /** Called when a comment without a document position is selected. */
  onCommentSelect?: (comment: NavigationComment) => void;
  /** Called when a page thumbnail is selected. */
  onPageSelect?: (page: NavigationPage) => void;
  /** Shows a close button when provided. */
  onClose?: () => void;
  className?: string;
}

const TAB_LABELS: Record<NavigationTabId, string> = {
  headings: 'Headings',
  sections: 'Sections',
  comments: 'Comments',
  search: 'Search',
  pages: 'Pages',
};

const DEFAULT_TABS: NavigationTabId[] = ['headings', 'sections', 'comments', 'search', 'pages'];

interface SectionItem {
  pos: number;
  title: string;
  owner: string;
  state: string;
}

/** Document navigation pane with tabs for each navigation view. */
export function NavigationPane({
  editor,
  tabs = DEFAULT_TABS,
  defaultTab,
  comments = [],
  pages = [],
  onCommentSelect,
  onPageSelect,
  onClose,
  className,
}: NavigationPaneProps): React.ReactElement {
  const tick = useEditorTick(editor);
  const baseId = useId();
  const visibleTabs = tabs.length > 0 ? tabs : DEFAULT_TABS;
  const [selected, setSelected] = useState<NavigationTabId>(defaultTab ?? visibleTabs[0] ?? 'headings');
  const current = visibleTabs.includes(selected) ? selected : visibleTabs[0] ?? 'headings';
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);

  const headings = useMemo(() => (editor && !editor.isDestroyed ? getHeadings(editor) : []), [editor, tick]);

  const sections = useMemo<SectionItem[]>(() => {
    if (!editor || editor.isDestroyed) return [];
    const items: SectionItem[] = [];
    editor.pm.state.doc.descendants((node, pos) => {
      if (node.type.name === 'controlledSection') {
        const attrs = node.attrs as Record<string, unknown>;
        items.push({
          pos,
          title: String(attrs.title || 'Untitled section'),
          owner: String(attrs.ownerName || 'No owner'),
          state: String(attrs.workflowState || 'draft'),
        });
      }
    });
    return items;
  }, [editor, tick]);

  const matches: SearchMatch[] = useMemo(() => {
    if (!editor || editor.isDestroyed || !query) return [];
    return findMatches(editor.pm.state.doc, query, { matchCase }).slice(0, 200);
  }, [editor, query, matchCase, tick]);

  const jump = (pos: number, to?: number) => {
    if (!editor || editor.isDestroyed) return;
    selectRange(editor, pos, to ?? pos, true);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = visibleTabs.indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = visibleTabs[(index + step + visibleTabs.length) % visibleTabs.length];
      if (next) {
        setSelected(next);
        document.getElementById(`${baseId}-tab-${next}`)?.focus();
      }
    }
  };

  return (
    <nav className={joinClass('bb-office-nav-pane', className)} aria-label="Navigation">
      <div className="bb-office-nav-header">
        <div className="bb-office-nav-tabs" role="tablist" aria-label="Navigation views">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab}`}
              aria-selected={tab === current}
              aria-controls={`${baseId}-panel-${tab}`}
              tabIndex={tab === current ? 0 : -1}
              className={joinClass('bb-office-nav-tab', tab === current && 'is-active')}
              onClick={() => setSelected(tab)}
              onKeyDown={onTabKeyDown}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        {onClose && (
          <button type="button" className="bb-office-nav-close" aria-label="Close navigation pane" onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <div className="bb-office-nav-panel" role="tabpanel" id={`${baseId}-panel-${current}`} aria-labelledby={`${baseId}-tab-${current}`}>
        {current === 'headings' && (
          <ul className="bb-office-nav-list">
            {headings.length === 0 && <li className="bb-office-nav-empty">No headings yet</li>}
            {headings.map((heading) => (
              <li key={heading.pos}>
                <button
                  type="button"
                  className="bb-office-nav-item"
                  style={{ paddingLeft: 8 + (heading.level - 1) * 12 }}
                  onClick={() => jump(heading.pos + 1)}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        )}

        {current === 'sections' && (
          <ul className="bb-office-nav-list">
            {sections.length === 0 && <li className="bb-office-nav-empty">No controlled sections</li>}
            {sections.map((section) => (
              <li key={section.pos}>
                <button type="button" className="bb-office-nav-item bb-office-nav-section" onClick={() => jump(section.pos + 1)}>
                  <span className="bb-office-nav-item-title">{section.title}</span>
                  <span className="bb-office-nav-item-meta">
                    {section.owner} &middot; {section.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {current === 'comments' && (
          <ul className="bb-office-nav-list">
            {comments.length === 0 && <li className="bb-office-nav-empty">No comments</li>}
            {comments.map((comment) => (
              <li key={comment.id}>
                <button
                  type="button"
                  className={joinClass('bb-office-nav-item', 'bb-office-nav-comment', comment.status === 'resolved' && 'is-resolved')}
                  onClick={() => {
                    if (comment.pos !== undefined) jump(comment.pos);
                    else onCommentSelect?.(comment);
                  }}
                >
                  <span className="bb-office-nav-item-meta">
                    {comment.author ?? 'Comment'}
                    {comment.status === 'resolved' ? ' (resolved)' : ''}
                  </span>
                  {comment.quote && <span className="bb-office-nav-quote">&ldquo;{comment.quote}&rdquo;</span>}
                  <span className="bb-office-nav-item-title">{comment.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {current === 'search' && (
          <div className="bb-office-nav-search">
            <input
              type="search"
              className="bb-office-nav-search-input"
              aria-label="Search document"
              placeholder="Search document"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="bb-office-nav-search-option">
              <input type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} />
              Match case
            </label>
            <div className="bb-office-nav-item-meta" aria-live="polite">
              {query ? `${matches.length} result${matches.length === 1 ? '' : 's'}` : 'Type to search'}
            </div>
            <ul className="bb-office-nav-list">
              {matches.map((match, index) => (
                <li key={`${match.from}-${index}`}>
                  <button type="button" className="bb-office-nav-item" onClick={() => jump(match.from, match.to)}>
                    <span className="bb-office-nav-item-title">{snippetAround(editor, match)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {current === 'pages' && (
          <div className="bb-office-nav-pages">
            {pages.length === 0 && <div className="bb-office-nav-empty">No pages</div>}
            {pages.map((page) => (
              <button
                key={page.number}
                type="button"
                className="bb-office-nav-thumb"
                aria-label={`Page ${page.number}${page.label ? `, ${page.label}` : ''}`}
                onClick={() => onPageSelect?.(page)}
              >
                <span className="bb-office-nav-thumb-page">{page.number}</span>
                {page.label && <span className="bb-office-nav-thumb-label">{page.label}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function snippetAround(editor: BeakBlockEditor | null, match: SearchMatch): string {
  if (!editor || editor.isDestroyed) return match.text;
  const doc = editor.pm.state.doc;
  const start = Math.max(0, match.from - 24);
  const end = Math.min(doc.content.size, match.to + 24);
  return doc.textBetween(start, end, ' ', ' ').trim();
}
