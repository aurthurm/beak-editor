import { computed, defineComponent, h, ref, type PropType } from 'vue';
import type { BeakBlockEditor, Node as PMNode } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import { findMatches, selectMatch, type FindMatch } from './findEngine';
import { moveCaretTo, useEditorTick } from './editorState';

/** Navigation pane tab ids. */
export type NavigationTab = 'headings' | 'sections' | 'comments' | 'results' | 'pages';

/** All navigation tabs, in display order. */
export const NAVIGATION_TABS: readonly NavigationTab[] = ['headings', 'sections', 'comments', 'results', 'pages'];

const NAVIGATION_TAB_LABELS: Record<NavigationTab, string> = {
  headings: 'Headings',
  sections: 'Sections',
  comments: 'Comments',
  results: 'Results',
  pages: 'Pages',
};

/** A heading in the document outline. */
export interface NavigationHeading {
  pos: number;
  level: number;
  text: string;
}

/** A controlled section in the document. */
export interface NavigationSection {
  pos: number;
  sectionId: string | null;
  title: string;
  owner: string | null;
  workflowState: string | null;
}

/** A comment supplied by the application. */
export interface NavigationComment {
  id: string;
  author?: string;
  text: string;
  /** Quoted text the comment is anchored to. */
  quote?: string;
  /** Document position to jump to, when known. */
  from?: number;
  resolved?: boolean;
}

/** A page entry with an optional thumbnail, supplied by the layout engine. */
export interface NavigationPage {
  number: number;
  /** Thumbnail image URL or data URI. */
  thumbnail?: string;
  /** Document position of the first content on the page. */
  from?: number;
}

/** Collect headings in document order. */
export function collectHeadings(doc: PMNode): NavigationHeading[] {
  const headings: NavigationHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ pos, level: Number(node.attrs.level ?? 1), text: node.textContent });
    }
    return true;
  });
  return headings;
}

/** Collect controlled sections in document order. */
export function collectSections(doc: PMNode): NavigationSection[] {
  const sections: NavigationSection[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'controlledSection') {
      sections.push({
        pos,
        sectionId: (node.attrs.sectionId as string | null) ?? null,
        title: String(node.attrs.title ?? '') || 'Untitled section',
        owner: (node.attrs.ownerName as string | null) ?? null,
        workflowState: (node.attrs.workflowState as string | null) ?? null,
      });
    }
    return true;
  });
  return sections;
}

function snippetAround(doc: PMNode, match: FindMatch): string {
  const from = Math.max(0, match.from - 30);
  const to = Math.min(doc.content.size, match.to + 30);
  return doc.textBetween(from, to, ' ', ' ').trim();
}

/**
 * Navigation pane with headings outline, controlled sections, comments, search results and
 * page thumbnails. Clicking an entry moves the caret to it.
 */
export const NavigationPane = defineComponent({
  name: 'BeakBlockOfficeNavigationPane',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    /** Reserved for command-driven actions in the pane. */
    registry: { type: Object as PropType<CommandRegistry | null>, default: null },
    /** Tabs to show. Default: all. */
    tabs: { type: Array as PropType<NavigationTab[]>, default: () => [...NAVIGATION_TABS] },
    /** Selected tab. When omitted the pane keeps its own selection. */
    activeTab: { type: String as PropType<NavigationTab>, default: undefined },
    comments: { type: Array as PropType<NavigationComment[]>, default: () => [] },
    pages: { type: Array as PropType<NavigationPage[]>, default: () => [] },
    label: { type: String, default: 'Navigation' },
  },
  emits: {
    'update:activeTab': (tab: string) => typeof tab === 'string',
    'select-comment': (comment: NavigationComment) => typeof comment.id === 'string',
    'select-page': (page: NavigationPage) => typeof page.number === 'number',
  },
  setup(props, { emit }) {
    const tick = useEditorTick(() => props.editor);
    const internalTab = ref<NavigationTab>('headings');
    const query = ref('');

    const visibleTabs = computed(() => NAVIGATION_TABS.filter((t) => props.tabs.includes(t)));
    const currentTab = computed<NavigationTab>(() => {
      const wanted = props.activeTab ?? internalTab.value;
      return visibleTabs.value.includes(wanted) ? wanted : (visibleTabs.value[0] ?? 'headings');
    });

    const headings = computed(() => {
      void tick.value;
      return props.editor && !props.editor.isDestroyed ? collectHeadings(props.editor.pm.state.doc) : [];
    });
    const sections = computed(() => {
      void tick.value;
      return props.editor && !props.editor.isDestroyed ? collectSections(props.editor.pm.state.doc) : [];
    });
    const results = computed(() => {
      void tick.value;
      if (!props.editor || props.editor.isDestroyed || !query.value.trim()) return [];
      const doc = props.editor.pm.state.doc;
      return findMatches(doc, query.value.trim()).slice(0, 200).map((match) => ({
        match,
        snippet: snippetAround(doc, match),
      }));
    });

    function selectTab(tab: NavigationTab): void {
      internalTab.value = tab;
      emit('update:activeTab', tab);
    }

    function jumpToHeading(heading: NavigationHeading): void {
      if (props.editor) moveCaretTo(props.editor, heading.pos + 1);
    }

    function jumpToSection(section: NavigationSection): void {
      if (props.editor) moveCaretTo(props.editor, section.pos + 1);
    }

    function jumpToResult(match: FindMatch): void {
      if (props.editor) selectMatch(props.editor, match);
    }

    function jumpToComment(comment: NavigationComment): void {
      emit('select-comment', comment);
      if (props.editor && typeof comment.from === 'number') moveCaretTo(props.editor, comment.from);
    }

    function jumpToPage(page: NavigationPage): void {
      emit('select-page', page);
      if (props.editor && typeof page.from === 'number') moveCaretTo(props.editor, page.from);
    }

    function tabPanel(tab: NavigationTab): ReturnType<typeof h> {
      switch (tab) {
        case 'headings': {
          const items = headings.value;
          return h(
            'ul',
            { class: 'bb-office-nav-list', 'aria-label': 'Headings' },
            items.length === 0
              ? [h('li', { class: 'bb-office-nav-empty' }, 'Headings you add to the document will appear here.')]
              : items.map((heading) =>
                  h('li', [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: `bb-office-nav-item bb-office-nav-item--level-${heading.level}`,
                        'data-pos': heading.pos,
                        onClick: () => jumpToHeading(heading),
                      },
                      heading.text || '(empty heading)'
                    ),
                  ])
                )
          );
        }
        case 'sections': {
          const items = sections.value;
          return h(
            'ul',
            { class: 'bb-office-nav-list', 'aria-label': 'Controlled sections' },
            items.length === 0
              ? [h('li', { class: 'bb-office-nav-empty' }, 'No controlled sections in this document.')]
              : items.map((section) =>
                  h('li', [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'bb-office-nav-item',
                        'data-section-id': section.sectionId ?? undefined,
                        onClick: () => jumpToSection(section),
                      },
                      [
                        h('span', section.title),
                        h(
                          'span',
                          { class: 'bb-office-nav-meta' },
                          [section.owner ? `Owner: ${section.owner}` : 'No owner', section.workflowState ? ` · ${section.workflowState}` : '']
                            .filter(Boolean)
                            .join('')
                        ),
                      ]
                    ),
                  ])
                )
          );
        }
        case 'comments': {
          const items = props.comments;
          return h(
            'ul',
            { class: 'bb-office-nav-list', 'aria-label': 'Comments' },
            items.length === 0
              ? [h('li', { class: 'bb-office-nav-empty' }, 'No comments.')]
              : items.map((comment) =>
                  h('li', [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'bb-office-nav-item',
                        'data-comment-id': comment.id,
                        onClick: () => jumpToComment(comment),
                      },
                      [
                        h('span', `${comment.author ?? 'Comment'}${comment.resolved ? ' (resolved)' : ''}`),
                        comment.quote ? h('span', { class: 'bb-office-nav-meta' }, `“${comment.quote}”`) : null,
                        h('span', { class: 'bb-office-nav-meta' }, comment.text),
                      ]
                    ),
                  ])
                )
          );
        }
        case 'results': {
          const items = results.value;
          return h('div', [
            h('input', {
              type: 'search',
              class: 'bb-office-nav-search',
              'aria-label': 'Search the document',
              placeholder: 'Search the document',
              value: query.value,
              onInput: (event: Event) => {
                query.value = (event.target as HTMLInputElement).value;
              },
            }),
            h(
              'ul',
              { class: 'bb-office-nav-list', 'aria-label': 'Search results' },
              !query.value.trim()
                ? [h('li', { class: 'bb-office-nav-empty' }, 'Type to search the document.')]
                : items.length === 0
                  ? [h('li', { class: 'bb-office-nav-empty' }, 'No results.')]
                  : items.map(({ match, snippet }) =>
                      h('li', [
                        h(
                          'button',
                          { type: 'button', class: 'bb-office-nav-item', 'data-pos': match.from, onClick: () => jumpToResult(match) },
                          [h('span', snippet), h('span', { class: 'bb-office-nav-meta' }, `Position ${match.from}`)]
                        ),
                      ])
                    )
            ),
          ]);
        }
        case 'pages': {
          const items = props.pages;
          return h(
            'div',
            { class: 'bb-office-nav-thumbs', role: 'list', 'aria-label': 'Pages' },
            items.length === 0
              ? [h('div', { class: 'bb-office-nav-empty' }, 'Pages appear once the document is laid out.')]
              : items.map((page) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'listitem',
                      class: 'bb-office-nav-thumb',
                      'data-page': page.number,
                      'aria-label': `Page ${page.number}`,
                      onClick: () => jumpToPage(page),
                    },
                    [page.thumbnail ? h('img', { src: page.thumbnail, alt: '' }) : null, h('span', `Page ${page.number}`)]
                  )
                )
          );
        }
      }
    }

    return () => {
      const tab = currentTab.value;
      return h('aside', { class: 'bb-office-nav', 'aria-label': props.label, 'data-beakblock-nav': '' }, [
        h('div', { class: 'bb-office-nav-tabs', role: 'tablist', 'aria-label': 'Navigation sections' },
          visibleTabs.value.map((t) =>
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                class: 'bb-office-nav-tab',
                'aria-selected': String(t === tab),
                'data-tab': t,
                onClick: () => selectTab(t),
              },
              NAVIGATION_TAB_LABELS[t]
            )
          )
        ),
        h('div', { class: 'bb-office-nav-body', role: 'tabpanel' }, [tabPanel(tab)]),
      ]);
    };
  },
});
