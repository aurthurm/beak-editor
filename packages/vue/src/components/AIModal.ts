import {
  computed,
  defineComponent,
  h,
  ref,
  Teleport,
  watch,
  type PropType,
} from 'vue';
import {
  buildAIContext,
  parseAIBlockOutput,
  type AIPreset,
  type AIContext,
  type AIEntryMode,
  type BeakBlockEditor,
} from '@amusendame/beakblock-core';
import { BeakBlockView } from './BeakBlockView';
import { useBeakBlock } from '../composables';
import type { PropSchema, VueBlockSpec } from '../blocks';

type ChatMessage = { role: 'user' | 'assistant'; content: string; pending?: boolean };
type AIRequestPayload = {
  mode: AIEntryMode;
  preset: AIPreset | null;
  instruction: string;
  context: AIContext;
};
type AIStatus = 'idle' | 'working' | 'ready' | 'applying';

export interface AIModalProps {
  open: boolean;
  editor: BeakBlockEditor | null;
  mode: AIEntryMode;
  presets: AIPreset[];
  customBlocks?: VueBlockSpec<PropSchema>[];
  title?: string;
  subtitle?: string;
  /** When true, shows selection + document context (for debugging or power users). Hidden by default. */
  showContext?: boolean;
  contextSnapshot?: AIContext | null;
  /** When true, user must confirm before Apply (e.g. regulated content acknowledgment). */
  requireApplyAcknowledgment?: boolean;
  applyAcknowledgmentLabel?: string;
  onClose: () => void;
  onExecute?: (request: AIRequestPayload) => Promise<string | void> | string | void;
  onApply?: (request: AIRequestPayload & { output: string }) => Promise<void> | void;
}

function busyLabel(status: AIStatus): string {
  if (status === 'applying') return 'Applying to your document…';
  return 'Generating a response…';
}

const AIOutputPreview = defineComponent({
  name: 'AIOutputPreview',
  props: {
    blocks: { type: Array as PropType<NonNullable<ReturnType<typeof parseAIBlockOutput>>['blocks']>, required: true },
    customBlocks: { type: Array as PropType<VueBlockSpec<PropSchema>[]>, default: undefined },
  },
  setup(props) {
    const previewEditor = useBeakBlock({
      initialContent: props.blocks,
      editable: false,
      injectStyles: false,
      customBlocks: props.customBlocks,
    });

    return () => {
      const editor = previewEditor.value;
      if (!editor) return null;
      return h(BeakBlockView, { editor, className: 'beakblock-ai-modal__preview-editor' });
    };
  },
});

export const AIModal = defineComponent({
  name: 'AIModal',
  props: {
    open: { type: Boolean, default: false },
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    mode: { type: String as PropType<AIEntryMode>, required: true },
    presets: { type: Array as PropType<AIPreset[]>, default: () => [] },
    customBlocks: { type: Array as PropType<VueBlockSpec<PropSchema>[]>, default: undefined },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    showContext: { type: Boolean, default: false },
    contextSnapshot: { type: Object as PropType<AIContext | null>, default: null },
    requireApplyAcknowledgment: { type: Boolean, default: false },
    applyAcknowledgmentLabel: {
      type: String,
      default:
        'I acknowledge this section is AI-assisted and I have reviewed the output for accuracy before applying.',
    },
    onClose: { type: Function as PropType<() => void>, required: true },
    onExecute: { type: Function as PropType<AIModalProps['onExecute']>, default: undefined },
    onApply: { type: Function as PropType<AIModalProps['onApply']>, default: undefined },
  },
  setup(props) {
    const selectedPresetId = ref(props.presets[0]?.id ?? '');
    const instruction = ref(props.presets[0]?.prompt ?? '');
    const messages = ref<ChatMessage[]>([]);
    const status = ref<AIStatus>('idle');
    const output = ref('');
    const request = ref<AIRequestPayload | null>(null);
    const applied = ref(false);
    const applyAcknowledged = ref(false);
    const promptPanelCollapsed = ref(false);
    const previewParse = computed(() => parseAIBlockOutput(output.value));
    const previewBlocks = computed(() => previewParse.value?.blocks ?? []);
    const previewKey = computed(() => `${previewParse.value?.version ?? 'none'}:${output.value}`);
    const hasStructuredPreview = computed(() => previewBlocks.value.length > 0);

    watch(
      () => props.open,
      (open) => {
        if (!open) return;
        selectedPresetId.value = props.presets[0]?.id ?? '';
        instruction.value = props.presets[0]?.prompt ?? '';
        messages.value = [];
        status.value = 'idle';
        output.value = '';
        request.value = null;
        applied.value = false;
        applyAcknowledged.value = false;
        promptPanelCollapsed.value = false;
      },
      { immediate: true }
    );

    watch([status, output], () => {
      if (status.value === 'ready' && output.value) {
        promptPanelCollapsed.value = true;
      }
    });

    const selectedPreset = computed(() => props.presets.find((preset) => preset.id === selectedPresetId.value) ?? null);
    const isBusy = computed(() => status.value === 'working' || status.value === 'applying');
    const context = computed(() =>
      props.contextSnapshot ?? (props.editor ? buildAIContext(props.editor, props.mode, selectedPreset.value, instruction.value) : null)
    );
    const hasChat = computed(() => messages.value.length > 0);
    const resultsFocus = computed(() => status.value === 'ready' && !!output.value && hasChat.value);
    const showBusyOverlay = computed(() => status.value === 'working' || status.value === 'applying');
    const collapsedPromptPreview = computed(() => request.value?.instruction ?? instruction.value);

    const modalClass = computed(() =>
      ['beakblock-ai-modal', resultsFocus.value ? 'beakblock-ai-modal--results-focus' : ''].filter(Boolean).join(' ')
    );

    const submit = async () => {
      const editor = props.editor;
      if (!editor || !instruction.value.trim() || isBusy.value) return;
      const prompt = instruction.value.trim();
        const payload: AIRequestPayload = {
          mode: props.mode,
          preset: selectedPreset.value,
          instruction: prompt,
          context: context.value ?? buildAIContext(editor, props.mode, selectedPreset.value, prompt),
        };

      status.value = 'working';
      output.value = '';
      request.value = payload;
      applied.value = false;
      messages.value.push({ role: 'user', content: prompt });
      messages.value.push({ role: 'assistant', content: 'BeakBlock AI is thinking…', pending: true });

      try {
        const response = await props.onExecute?.(payload);
        const assistant =
          typeof response === 'string'
            ? response
            : `Connected to BeakBlock context: ${payload.context.selection?.text || payload.context.document.markdown.slice(0, 220) || 'document snapshot'}`;
        output.value = assistant;
        const pendingIndex = (() => {
          for (let index = messages.value.length - 1; index >= 0; index -= 1) {
            if (messages.value[index]?.pending) return index;
          }
          return -1;
        })();
        if (pendingIndex >= 0) {
          messages.value[pendingIndex] = { role: 'assistant', content: assistant };
        } else {
          messages.value.push({ role: 'assistant', content: assistant });
        }
        status.value = 'ready';
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI request failed.';
        output.value = message;
        const pendingIndex = (() => {
          for (let index = messages.value.length - 1; index >= 0; index -= 1) {
            if (messages.value[index]?.pending) return index;
          }
          return -1;
        })();
        if (pendingIndex >= 0) {
          messages.value[pendingIndex] = { role: 'assistant', content: `Error: ${message}` };
        } else {
          messages.value.push({ role: 'assistant', content: `Error: ${message}` });
        }
        status.value = 'ready';
      }
    };

    const applyBlockedByAck = computed(
      () => props.requireApplyAcknowledgment && status.value === 'ready' && !!output.value && !applyAcknowledged.value
    );

    const applyResult = async () => {
      if (!request.value || !output.value || !props.onApply || isBusy.value || applied.value) return;
      if (props.requireApplyAcknowledgment && !applyAcknowledged.value) return;
      status.value = 'applying';
      try {
        await props.onApply({ ...request.value, output: output.value });
        applied.value = true;
        messages.value.push({ role: 'assistant', content: 'Output applied to the document.' });
      } finally {
        status.value = 'ready';
      }
    };

    const handlePreset = (preset: AIPreset) => {
      selectedPresetId.value = preset.id;
      instruction.value = preset.prompt;
      status.value = 'idle';
      output.value = '';
      request.value = null;
      applied.value = false;
      applyAcknowledged.value = false;
      promptPanelCollapsed.value = false;
    };

    const onInput = (event: Event) => {
      instruction.value = (event.target as HTMLTextAreaElement).value;
      if (status.value !== 'idle') {
        status.value = 'idle';
        output.value = '';
        request.value = null;
        applied.value = false;
        applyAcknowledged.value = false;
        promptPanelCollapsed.value = false;
      }
    };

    const expandPromptPanel = () => {
      promptPanelCollapsed.value = false;
    };

    return () => {
      if (!props.open) return null;
      const target = typeof document !== 'undefined' ? document.body : null;
      if (!target) return null;

      const bodyBlock = h('div', { class: 'beakblock-ai-modal__body' }, [
        h('section', { class: 'beakblock-ai-modal__presets' }, [
          h('div', { class: 'beakblock-modal-section-title' }, 'Quick prompts'),
          h(
            'div',
            { class: 'beakblock-ai-modal__preset-grid' },
            props.presets.map((preset) =>
              h(
                'button',
                {
                  key: preset.id,
                  type: 'button',
                  class: ['beakblock-ai-modal__preset', preset.id === selectedPresetId.value ? 'beakblock-ai-modal__preset--active' : '']
                    .filter(Boolean)
                    .join(' '),
                  disabled: isBusy.value,
                  onClick: () => handlePreset(preset),
                  onMousedown: (event: MouseEvent) => event.preventDefault(),
                },
                [
                  h('span', { class: 'beakblock-ai-modal__preset-title' }, preset.title),
                  h('span', { class: 'beakblock-ai-modal__preset-description' }, preset.description),
                ]
              )
            )
          ),
        ]),
        h('section', { class: 'beakblock-ai-modal__composer' }, [
          h('div', { class: 'beakblock-modal-section-title' }, 'Prompt'),
          h('textarea', {
            class: 'beakblock-ai-modal__textarea',
            value: instruction.value,
            disabled: isBusy.value,
            placeholder:
              props.mode === 'bubble'
                ? 'Tell BeakBlock how to rewrite the selection...'
                : 'Ask BeakBlock to continue, summarize, or restructure the document...',
            onInput,
          }),
          props.showContext
            ? h('div', { class: 'beakblock-ai-modal__context' }, [
                h('div', { class: 'beakblock-modal-section-title' }, 'Context'),
                h('div', { class: 'beakblock-ai-modal__context-card' }, [
                  h('strong', 'Selected text'),
                  h('p', context.value?.selection?.text || 'No selection captured.'),
                ]),
                h('details', { class: 'beakblock-ai-modal__details' }, [
                  h('summary', 'Document snapshot'),
                  h('pre', context.value?.document.markdown || ''),
                ]),
              ])
            : null,
        ]),
      ]);

      const promptCollapsedBar =
        promptPanelCollapsed.value && resultsFocus.value
          ? h('div', { class: 'beakblock-ai-modal__prompt-collapsed' }, [
              h('div', { class: 'beakblock-ai-modal__prompt-collapsed-inner' }, [
                h('span', { class: 'beakblock-ai-modal__prompt-collapsed-label' }, 'Prompt used'),
                h('p', { class: 'beakblock-ai-modal__prompt-collapsed-text' }, collapsedPromptPreview.value),
              ]),
              h(
                'button',
                {
                  type: 'button',
                  class: 'beakblock-modal-secondary beakblock-ai-modal__prompt-collapsed-edit',
                  onClick: expandPromptPanel,
                },
                'Edit prompt'
              ),
            ])
          : null;

      const chatSection = hasChat.value
        ? h(
            'div',
            {
              class: ['beakblock-ai-modal__chat', resultsFocus.value ? 'beakblock-ai-modal__chat--prominent' : '']
                .filter(Boolean)
                .join(' '),
            },
            [
              h('div', { class: 'beakblock-ai-modal__chat-head' }, [
                h('div', { class: 'beakblock-modal-section-title' }, 'AI response'),
                h(
                  'p',
                  { class: 'beakblock-ai-modal__chat-lede' },
                  hasStructuredPreview.value
                    ? 'Rendered as BeakBlock blocks for review.'
                    : 'What the model produced for your prompt.'
                ),
              ]),
              h('div', { class: 'beakblock-ai-modal__messages' }, [
                ...messages.value.map((message, index) =>
                  h(
                    'div',
                    {
                      key: `${message.role}-${index}`,
                      class: [
                        'beakblock-ai-modal__message',
                        `beakblock-ai-modal__message--${message.role}`,
                        message.pending ? 'beakblock-ai-modal__message--pending' : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                    },
                    [
                      h(
                        'span',
                        { class: 'beakblock-ai-modal__message-role' },
                        message.role === 'user' ? 'Your prompt' : 'Assistant'
                      ),
                      h('div', { class: 'beakblock-ai-modal__message-body' }, [
                        message.role === 'assistant' && !message.pending && hasStructuredPreview.value && index === messages.value.length - 1
                          ? 'Structured output parsed for preview below.'
                          : message.content,
                      ]),
                    ]
                  )
                ),
              ]),
              status.value === 'ready' && output.value
                ? h('div', { class: 'beakblock-ai-modal__preview' }, [
                    h('div', { class: 'beakblock-modal-section-title' }, 'Structured preview'),
                    hasStructuredPreview.value
                      ? h(AIOutputPreview, {
                          key: previewKey.value,
                          blocks: previewBlocks.value,
                          customBlocks: props.customBlocks,
                        })
                      : h('pre', { class: 'beakblock-ai-modal__preview-raw' }, output.value),
                  ])
                : null,
            ]
          )
        : null;

      const busyOverlay = showBusyOverlay.value
        ? h('div', { class: 'beakblock-ai-modal__busy-overlay', 'aria-live': 'polite', 'aria-busy': 'true' }, [
            h('div', { class: 'beakblock-ai-modal__busy-spinner', 'aria-hidden': 'true' }),
            h('p', { class: 'beakblock-ai-modal__busy-label' }, busyLabel(status.value)),
          ])
        : null;

      return h(Teleport, { to: target }, [
        h('div', { class: 'beakblock-modal-overlay', role: 'presentation', onMousedown: props.onClose }, [
          h(
            'div',
            {
              class: modalClass.value,
              role: 'dialog',
              'aria-modal': 'true',
              'aria-busy': isBusy.value,
              'aria-label': props.title || (props.mode === 'bubble' ? 'AI writing assistant' : 'AI chat assistant'),
              onMousedown: (event: MouseEvent) => event.stopPropagation(),
            },
            [
              h('div', { class: 'beakblock-modal-header' }, [
                h('div', [
                  h('div', { class: 'beakblock-modal-kicker' }, props.mode === 'bubble' ? 'Selection AI' : 'Document AI'),
                  h('h2', props.title || (props.mode === 'bubble' ? 'Edit with AI' : 'AI chat')),
                  h(
                    'p',
                    props.subtitle ||
                      (props.mode === 'bubble'
                        ? 'Rewrite the selected text with a focused prompt.'
                        : 'Continue from the current document context with a guided prompt.')
                  ),
                ]),
                h('button', { type: 'button', class: 'beakblock-modal-close', onClick: props.onClose, 'aria-label': 'Close' }, '×'),
              ]),
              h('div', { class: 'beakblock-ai-modal__main' }, [
                promptCollapsedBar ?? bodyBlock,
                chatSection,
                busyOverlay,
              ]),
              h('div', { class: 'beakblock-modal-footer' }, [
                props.requireApplyAcknowledgment && status.value === 'ready' && output.value && !applied.value
                  ? h('label', { class: 'beakblock-ai-modal__ack' }, [
                      h('input', {
                        type: 'checkbox',
                        checked: applyAcknowledged.value,
                        onChange: (e: Event) => {
                          applyAcknowledged.value = (e.target as HTMLInputElement).checked;
                        },
                      }),
                      h('span', props.applyAcknowledgmentLabel),
                    ])
                  : null,
                h('div', { class: 'beakblock-ai-modal__result-actions' }, [
                  !showBusyOverlay.value && status.value === 'ready' && output.value
                    ? h('span', { class: 'beakblock-ai-modal__result-badge' }, [
                        h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'aria-hidden': 'true' }, [
                          h('path', { d: 'M20 6 9 17l-5-5', strokeWidth: '2' }),
                        ]),
                        'Ready to apply',
                      ])
                    : null,
                ]),
                h(
                  'button',
                  { type: 'button', class: 'beakblock-modal-secondary', onClick: props.onClose },
                  status.value === 'applying' ? 'Applying…' : status.value === 'ready' && applied.value ? 'Close' : 'Cancel'
                ),
                status.value === 'ready' && output.value && props.onApply
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'beakblock-modal-primary',
                        disabled: isBusy.value || applied.value || applyBlockedByAck.value,
                        onClick: applyResult,
                      },
                      applied.value ? 'Applied' : 'Apply result'
                    )
                  : h(
                      'button',
                      {
                        type: 'button',
                        class: 'beakblock-modal-primary',
                        disabled: isBusy.value || !instruction.value.trim(),
                        onClick: submit,
                      },
                      status.value === 'working' ? 'Working…' : 'Run prompt'
                    ),
              ]),
            ]
          ),
        ]),
      ]);
    };
  },
});
