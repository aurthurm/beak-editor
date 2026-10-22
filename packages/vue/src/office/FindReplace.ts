import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  FIND_HIGHLIGHT_KEY,
  compileFindPattern,
  createFindHighlightPlugin,
  findMatches,
  replaceMatches,
  selectMatch,
  type FindMatch,
  type FindOptions,
} from './findEngine';

/**
 * Find and replace panel. Matches are highlighted in the document with decorations. Next and
 * previous move the selection between matches. Replace all runs as one transaction, so one undo
 * reverts it. Invalid regular expressions are reported inline and match nothing.
 */
export const FindReplace = defineComponent({
  name: 'BeakBlockOfficeFindReplace',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    /** Initial search text. */
    initialQuery: { type: String, default: '' },
    /** Initial options. */
    initialOptions: { type: Object as PropType<FindOptions>, default: () => ({}) },
  },
  emits: {
    close: () => true,
    'update:query': (query: string) => typeof query === 'string',
  },
  setup(props, { emit }) {
    const query = ref(props.initialQuery);
    const replacement = ref('');
    const matchCase = ref(props.initialOptions.matchCase ?? false);
    const wholeWord = ref(props.initialOptions.wholeWord ?? false);
    const regex = ref(props.initialOptions.regex ?? false);
    const matches = ref<FindMatch[]>([]);
    const current = ref(-1);
    const error = ref<string | null>(null);
    const status = ref('');
    const inputRef = ref<HTMLInputElement | null>(null);
    let installed = false;

    function options(): FindOptions {
      return { matchCase: matchCase.value, wholeWord: wholeWord.value, regex: regex.value };
    }

    function ensurePlugin(editor: BeakBlockEditor): void {
      if (installed) return;
      const exists = editor.pm.state.plugins.some((plugin) => plugin.spec.key === FIND_HIGHLIGHT_KEY);
      if (!exists) editor.pm.addPlugin(createFindHighlightPlugin());
      installed = true;
    }

    function pushHighlights(editor: BeakBlockEditor): void {
      const tr = editor.pm.state.tr.setMeta(FIND_HIGHLIGHT_KEY, { matches: matches.value, current: current.value });
      tr.setMeta('addToHistory', false);
      editor.pm.dispatch(tr);
    }

    /** Recompute matches from the document. Keeps the current index when possible. */
    function refresh(keepIndex = true): void {
      const editor = props.editor;
      if (!editor || editor.isDestroyed) return;
      ensurePlugin(editor);
      const compiled = compileFindPattern(query.value, options());
      error.value = compiled.error;
      if (compiled.error || !query.value) {
        matches.value = [];
        current.value = -1;
      } else {
        matches.value = findMatches(editor.pm.state.doc, query.value, options());
        if (!keepIndex || current.value >= matches.value.length) {
          current.value = matches.value.length ? 0 : -1;
        }
      }
      pushHighlights(editor);
    }

    function go(direction: 1 | -1): void {
      const editor = props.editor;
      if (!editor || matches.value.length === 0) return;
      const count = matches.value.length;
      const next = current.value < 0 ? (direction === 1 ? 0 : count - 1) : (current.value + direction + count) % count;
      current.value = next;
      const match = matches.value[next];
      if (match) {
        pushHighlights(editor);
        selectMatch(editor, match);
      }
    }

    function replaceCurrent(): void {
      const editor = props.editor;
      if (!editor || editor.isDestroyed) return;
      const index = current.value;
      const match = matches.value[index];
      if (!match) return;
      replaceMatches(editor, [match], replacement.value, options());
      refresh(true);
      status.value = matches.value.length ? '' : 'No more matches';
    }

    function replaceAll(): void {
      const editor = props.editor;
      if (!editor || editor.isDestroyed) return;
      const count = replaceMatches(editor, matches.value, replacement.value, options());
      refresh(false);
      status.value = count ? `Replaced ${count} ${count === 1 ? 'match' : 'matches'}` : 'No matches to replace';
    }

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        emit('close');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        go(event.shiftKey ? -1 : 1);
      }
    }

    let unsubscribeChange: (() => void) | null = null;

    function subscribe(editor: BeakBlockEditor | null): void {
      unsubscribeChange?.();
      unsubscribeChange = null;
      if (!editor || editor.isDestroyed) return;
      unsubscribeChange = editor.on('change', () => refresh(true));
    }

    watch(() => props.editor, (editor) => {
      subscribe(editor);
      refresh(false);
    });
    watch([query, matchCase, wholeWord, regex], () => {
      emit('update:query', query.value);
      refresh(false);
    });

    onMounted(() => {
      subscribe(props.editor);
      refresh(false);
      void nextTick(() => inputRef.value?.focus());
    });

    onBeforeUnmount(() => {
      unsubscribeChange?.();
      unsubscribeChange = null;
      const editor = props.editor;
      if (editor && !editor.isDestroyed && installed) {
        editor.pm.removePlugin(FIND_HIGHLIGHT_KEY);
      }
      installed = false;
    });

    return () => {
      const total = matches.value.length;
      const position = current.value >= 0 ? current.value + 1 : 0;
      const countText = error.value
        ? ''
        : query.value
          ? total
            ? `${position} of ${total}`
            : 'No results'
          : '';
      return h(
        'div',
        { class: 'bb-office-find', role: 'search', 'aria-label': 'Find and replace', 'data-beakblock-find': '' },
        [
          h('div', { class: 'bb-office-find-row' }, [
            h('input', {
              ref: inputRef,
              class: 'bb-office-find-input',
              type: 'text',
              placeholder: 'Find',
              'aria-label': 'Find',
              value: query.value,
              onInput: (event: Event) => {
                query.value = (event.target as HTMLInputElement).value;
              },
              onKeydown,
            }),
            h('span', { class: 'bb-office-find-count', 'aria-live': 'polite' }, countText),
            h('button', { type: 'button', class: 'bb-office-button', 'aria-label': 'Previous match', title: 'Previous match (Shift+Enter)', disabled: total === 0, onClick: () => go(-1) }, '↑'),
            h('button', { type: 'button', class: 'bb-office-button', 'aria-label': 'Next match', title: 'Next match (Enter)', disabled: total === 0, onClick: () => go(1) }, '↓'),
            h('label', { class: 'bb-office-find-option' }, [
              h('input', { type: 'checkbox', checked: matchCase.value, onChange: (e: Event) => (matchCase.value = (e.target as HTMLInputElement).checked) }),
              'Match case',
            ]),
            h('label', { class: 'bb-office-find-option' }, [
              h('input', { type: 'checkbox', checked: wholeWord.value, onChange: (e: Event) => (wholeWord.value = (e.target as HTMLInputElement).checked) }),
              'Whole word',
            ]),
            h('label', { class: 'bb-office-find-option' }, [
              h('input', { type: 'checkbox', checked: regex.value, onChange: (e: Event) => (regex.value = (e.target as HTMLInputElement).checked) }),
              'Regex',
            ]),
            h('button', { type: 'button', class: 'bb-office-button', 'aria-label': 'Close find', onClick: () => emit('close') }, '×'),
          ]),
          h('div', { class: 'bb-office-find-row' }, [
            h('input', {
              class: 'bb-office-find-input',
              type: 'text',
              placeholder: 'Replace with',
              'aria-label': 'Replace with',
              value: replacement.value,
              onInput: (event: Event) => {
                replacement.value = (event.target as HTMLInputElement).value;
              },
            }),
            h('button', { type: 'button', class: 'bb-office-button', disabled: current.value < 0, onClick: replaceCurrent }, 'Replace'),
            h('button', { type: 'button', class: 'bb-office-button', disabled: total === 0, onClick: replaceAll }, 'Replace all'),
            status.value ? h('span', { class: 'bb-office-find-count', role: 'status' }, status.value) : null,
          ]),
          error.value ? h('div', { class: 'bb-office-find-error', role: 'alert' }, `Invalid regular expression: ${error.value}`) : null,
        ]
      );
    };
  },
});
