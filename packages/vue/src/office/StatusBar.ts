import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import { documentWordCount, findControlledSection, useEditorTick } from './editorState';

/** Page position shown in the status bar. The layout engine supplies this. */
export interface StatusPageInfo {
  page: number;
  pages: number;
}

/** Controlled section summary shown in the status bar. */
export interface StatusSectionInfo {
  title?: string;
  owner?: string | null;
  workflowState?: string | null;
  /** True when the section is locked for the current user. */
  locked?: boolean;
}

/** A collaborator shown in the presence area. */
export interface StatusPresence {
  id: string;
  name: string;
  color?: string;
}

/**
 * Status bar: page position, word count, the controlled section at the caret (owner and
 * workflow state), language and presence. Section ownership changes are announced through a
 * polite live region.
 */
export const StatusBar = defineComponent({
  name: 'BeakBlockOfficeStatusBar',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    pageInfo: { type: Object as PropType<StatusPageInfo>, default: undefined },
    /** Overrides the section derived from the caret position. */
    sectionInfo: { type: Object as PropType<StatusSectionInfo>, default: undefined },
    language: { type: String, default: undefined },
    presence: { type: Array as PropType<StatusPresence[]>, default: () => [] },
    /** Overrides the computed word count. */
    wordCount: { type: Number, default: undefined },
  },
  setup(props) {
    const tick = useEditorTick(() => props.editor);

    const computedWords = computed(() => {
      void tick.value;
      return props.editor && !props.editor.isDestroyed ? documentWordCount(props.editor.pm.state) : 0;
    });

    const caretSection = computed<StatusSectionInfo | null>(() => {
      void tick.value;
      if (props.sectionInfo) return props.sectionInfo;
      if (!props.editor || props.editor.isDestroyed) return null;
      const found = findControlledSection(props.editor.pm.state);
      if (!found) return null;
      return {
        title: String(found.node.attrs.title ?? '') || 'Untitled section',
        owner: (found.node.attrs.ownerName as string | null) ?? null,
        workflowState: (found.node.attrs.workflowState as string | null) ?? null,
        locked: Boolean(found.node.attrs.locked),
      };
    });

    const announcement = ref('');
    const sectionKey = computed(() => {
      const section = caretSection.value;
      if (!section) return '';
      return [section.title, section.owner, section.workflowState].join('|');
    });

    watch(sectionKey, (key, previous) => {
      if (key === previous) return;
      const section = caretSection.value;
      if (!section || !key) {
        announcement.value = '';
        return;
      }
      announcement.value = `${section.title ?? 'Section'} is owned by ${section.owner ?? 'no one'}, status ${section.workflowState ?? 'unknown'}.`;
    });

    return () => {
      const words = props.wordCount ?? computedWords.value;
      const section = caretSection.value;
      return h('footer', { class: 'bb-office-status', role: 'contentinfo', 'aria-label': 'Status bar', 'data-beakblock-status': '' }, [
        props.pageInfo
          ? h('span', { class: 'bb-office-status-item', 'data-status': 'page' }, `Page ${props.pageInfo.page} of ${props.pageInfo.pages}`)
          : null,
        h('span', { class: 'bb-office-status-item', 'data-status': 'words' }, `${words} ${words === 1 ? 'word' : 'words'}`),
        section
          ? h(
              'span',
              {
                class: ['bb-office-status-item', 'bb-office-status-section', section.locked ? 'bb-office-status-section--locked' : '']
                  .filter(Boolean)
                  .join(' '),
                'data-status': 'section',
              },
              `${section.title ?? 'Section'} · ${section.owner ?? 'No owner'}${section.workflowState ? ` · ${section.workflowState}` : ''}`
            )
          : null,
        props.language ? h('span', { class: 'bb-office-status-item', 'data-status': 'language', lang: props.language }, props.language) : null,
        props.presence.length
          ? h(
              'span',
              { class: 'bb-office-presence', 'aria-label': `${props.presence.length} collaborators`, 'data-status': 'presence' },
              props.presence.map((person) =>
                h(
                  'span',
                  {
                    class: 'bb-office-presence-avatar',
                    title: person.name,
                    style: person.color ? { background: person.color } : undefined,
                  },
                  person.name.charAt(0).toUpperCase()
                )
              )
            )
          : null,
        h('span', { class: 'bb-office-visually-hidden', role: 'status', 'aria-live': 'polite', 'data-status': 'live' }, announcement.value),
      ]);
    };
  },
});
