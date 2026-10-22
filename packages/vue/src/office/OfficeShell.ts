import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNode } from 'vue';
import type { BeakBlockEditor, EditorMode, PageSetup } from '@amusendame/beakblock-core';
import type { CommandRegistry, RibbonDefinition } from '@amusendame/beakblock-commands';
import { CommandSearch } from './CommandSearch';
import { DEFAULT_QUICK_ACCESS_COMMANDS, QuickAccessToolbar } from './QuickAccessToolbar';
import { Ribbon } from './Ribbon';
import { NavigationPane, type NavigationComment, type NavigationPage, type NavigationTab } from './NavigationPane';
import { Ruler } from './Ruler';
import { StatusBar, type StatusPageInfo, type StatusPresence } from './StatusBar';
import { ZoomControl, clampZoom, type OfficeViewMode } from './ZoomControl';
import { DEFAULT_PAGE_SETUP, PX_PER_PT, pageGeometryPt } from './editorState';
import { injectOfficeShellStyles } from './officeStyles';

/** Convert twips to CSS pixels at a zoom level (1 twip = 1/20 pt, 1 pt = 96/72 px). */
function twipsToPx(twips: number, zoom: number): number {
  return (twips / 20) * zoom * PX_PER_PT;
}

/**
 * Office shell: ribbon on top, optional navigation pane on the left, rulers around a page-like
 * canvas, and a status bar at the bottom. The default slot is the editor surface, rendered
 * inside the page. The `printPreview` slot replaces the page in Print Preview mode.
 *
 * The shell sets the editor to `mode` (default `'office'`) when the editor is available.
 *
 * @example
 * ```typescript
 * h(OfficeShell, { editor: editor.value, registry: registry.value, pageSetup }, {
 *   default: () => h(BeakBlockView, { editor: editor.value }),
 * })
 * ```
 */
export const OfficeShell = defineComponent({
  name: 'BeakBlockOfficeShell',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    registry: { type: Object as PropType<CommandRegistry | null>, default: null },
    ribbon: { type: Object as PropType<RibbonDefinition>, default: undefined },
    /** Editor mode applied when the shell mounts or the editor becomes available. */
    mode: { type: String as PropType<EditorMode>, default: 'office' },
    /** Show the navigation pane. Collapsible from the top bar. */
    navigation: { type: Boolean, default: true },
    navigationTabs: { type: Array as PropType<NavigationTab[]>, default: undefined },
    comments: { type: Array as PropType<NavigationComment[]>, default: () => [] },
    pages: { type: Array as PropType<NavigationPage[]>, default: () => [] },
    showRulers: { type: Boolean, default: true },
    showStatusBar: { type: Boolean, default: true },
    pageSetup: { type: Object as PropType<PageSetup>, default: () => DEFAULT_PAGE_SETUP },
    zoom: { type: Number, default: 1 },
    viewMode: { type: String as PropType<OfficeViewMode>, default: 'print' },
    multiPage: { type: Boolean, default: true },
    focusMode: { type: Boolean, default: false },
    quickAccessCommands: { type: Array as PropType<string[]>, default: () => [...DEFAULT_QUICK_ACCESS_COMMANDS] },
    /** Extra commands are registered by the app on the registry; this flag only controls the search button. */
    commandSearch: { type: Boolean, default: true },
    pageInfo: { type: Object as PropType<StatusPageInfo>, default: undefined },
    language: { type: String, default: undefined },
    presence: { type: Array as PropType<StatusPresence[]>, default: () => [] },
    /** Inject the shell stylesheet into the document head. */
    injectStyles: { type: Boolean, default: true },
    label: { type: String, default: 'Office editor' },
  },
  emits: {
    'update:zoom': (zoom: number) => typeof zoom === 'number',
    'update:viewMode': (mode: OfficeViewMode) => typeof mode === 'string',
    'update:multiPage': (value: boolean) => typeof value === 'boolean',
    'update:focusMode': (value: boolean) => typeof value === 'boolean',
    'update:navigation': (value: boolean) => typeof value === 'boolean',
    'update:pageSetup': (setup: PageSetup) => typeof setup === 'object',
    command: (id: string) => typeof id === 'string',
  },
  setup(props, { emit, slots, expose }) {
    if (props.injectStyles) injectOfficeShellStyles();

    const navOpen = ref(props.navigation);
    const canvasRef = ref<HTMLElement | null>(null);
    const searchRef = ref<{ open: () => void } | null>(null);
    const canvasWidth = ref(0);
    let observer: ResizeObserver | null = null;

    watch(
      () => props.navigation,
      (value) => {
        navOpen.value = value;
      }
    );

    /** Apply the requested editor mode once an editor exists. */
    function applyMode(): void {
      const editor = props.editor;
      if (!editor || editor.isDestroyed) return;
      if (editor.getMode() !== props.mode) editor.setMode(props.mode);
    }
    watch(() => [props.editor, props.mode] as const, applyMode, { immediate: true });

    onMounted(() => {
      if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
        observer = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) canvasWidth.value = entry.contentRect.width;
        });
        observer.observe(canvasRef.value);
      }
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
    });

    const geometry = computed(() => pageGeometryPt(props.pageSetup));

    /** Zoom that fits the page width into the canvas. */
    const pageWidthZoom = computed(() => {
      const available = Math.max(0, canvasWidth.value - 32);
      if (!available) return props.zoom;
      return clampZoom(available / (geometry.value.widthPt * PX_PER_PT));
    });

    const pageStyle = computed(() => {
      const setup = props.pageSetup ?? DEFAULT_PAGE_SETUP;
      const zoom = props.zoom;
      if (props.viewMode === 'draft') {
        return { width: '100%', maxWidth: `${twipsToPx(setup.size.widthTwips, zoom)}px`, minHeight: '320px', padding: '24px' };
      }
      return {
        width: `${twipsToPx(setup.size.widthTwips, zoom)}px`,
        minHeight: `${twipsToPx(setup.size.heightTwips, zoom)}px`,
        padding: [
          twipsToPx(setup.margins.top, zoom),
          twipsToPx(setup.margins.right, zoom),
          twipsToPx(setup.margins.bottom, zoom),
          twipsToPx(setup.margins.left, zoom),
        ]
          .map((px) => `${px}px`)
          .join(' '),
      };
    });

    function toggleNavigation(): void {
      navOpen.value = !navOpen.value;
      emit('update:navigation', navOpen.value);
    }

    expose({
      openCommandSearch: () => searchRef.value?.open(),
    });

    return () => {
      const viewMode = props.viewMode;
      const isOutline = viewMode === 'outline';
      const isPreview = viewMode === 'preview';
      const showRulerChrome = props.showRulers && !isOutline && !props.focusMode;
      const showNav = props.navigation && navOpen.value && !props.focusMode;
      const classes = [
        'bb-office-shell',
        props.focusMode ? 'bb-office-shell--focus' : '',
        !navOpen.value ? 'bb-office-shell--nav-collapsed' : '',
        isPreview ? 'bb-office-shell--preview' : '',
        isOutline ? 'bb-office-shell--outline' : '',
      ].filter(Boolean);

      const topbar = h('div', { class: 'bb-office-topbar', role: 'toolbar', 'aria-label': 'Document toolbar' }, [
        h(QuickAccessToolbar, {
          registry: props.registry,
          editor: props.editor,
          commands: props.quickAccessCommands,
          onCommand: (id: string) => emit('command', id),
        }),
        props.navigation
          ? h('button', {
              type: 'button',
              class: 'bb-office-button',
              'aria-expanded': String(navOpen.value),
              'aria-label': navOpen.value ? 'Hide navigation pane' : 'Show navigation pane',
              title: 'Navigation pane',
              onClick: toggleNavigation,
            }, 'Navigation')
          : null,
        props.commandSearch
          ? h('button', {
              type: 'button',
              class: 'bb-office-button',
              'aria-label': 'Search commands',
              title: 'Search commands (Alt+Q)',
              onClick: () => searchRef.value?.open(),
            }, 'Tell me')
          : null,
        h('span', { class: 'bb-office-topbar-spacer' }),
        h(ZoomControl, {
          zoom: props.zoom,
          viewMode: props.viewMode,
          multiPage: props.multiPage,
          focusMode: props.focusMode,
          'onUpdate:zoom': (value: number) => emit('update:zoom', value),
          'onUpdate:viewMode': (value: OfficeViewMode) => emit('update:viewMode', value),
          'onUpdate:multiPage': (value: boolean) => emit('update:multiPage', value),
          'onUpdate:focusMode': (value: boolean) => emit('update:focusMode', value),
          onFitWidth: () => emit('update:zoom', pageWidthZoom.value),
        }),
      ]);

      const ribbon: VNode | null = props.focusMode
        ? null
        : h(Ribbon, {
            registry: props.registry,
            ribbon: props.ribbon,
            editor: props.editor,
            onCommand: (id: string) => emit('command', id),
          });

      const nav: VNode | null = showNav
        ? h(NavigationPane, {
            editor: props.editor,
            registry: props.registry,
            tabs: props.navigationTabs,
            comments: props.comments,
            pages: props.pages,
          })
        : null;

      const rulers: VNode[] = showRulerChrome
        ? [
            h('div', { class: 'bb-office-ruler-row' }, [
              h('div', { style: { width: '22px', flex: '0 0 22px', background: 'var(--bb-office-canvas, #e7e6e6)' } }),
              h(Ruler, {
                editor: props.editor,
                orientation: 'horizontal',
                pageSetup: props.pageSetup,
                zoom: props.zoom,
                'onUpdate:pageSetup': (setup: PageSetup) => emit('update:pageSetup', setup),
              }),
            ]),
          ]
        : [];

      const verticalRuler: VNode | null =
        showRulerChrome && !isPreview
          ? h(Ruler, {
              editor: props.editor,
              orientation: 'vertical',
              pageSetup: props.pageSetup,
              zoom: props.zoom,
              'onUpdate:pageSetup': (setup: PageSetup) => emit('update:pageSetup', setup),
            })
          : null;

      const surface: VNode = isPreview
        ? h('div', { class: 'bb-office-preview', role: 'region', 'aria-label': 'Print preview' }, slots.printPreview?.())
        : h('div', { class: 'bb-office-canvas-inner' }, [
            h(
              'div',
              {
                class: ['bb-office-page', viewMode === 'draft' ? 'bb-office-page--draft' : '', props.multiPage ? '' : 'bb-office-page--single']
                  .filter(Boolean)
                  .join(' '),
                style: pageStyle.value,
                'data-view-mode': viewMode,
                'data-page-size': `${props.pageSetup.size.widthTwips}x${props.pageSetup.size.heightTwips}`,
              },
              [h('div', { class: 'bb-office-page-body' }, slots.default?.())]
            ),
          ]);

      return h(
        'section',
        {
          class: classes.join(' '),
          'aria-label': props.label,
          'data-beakblock-office-shell': '',
          'data-view-mode': viewMode,
          style: { position: 'relative' },
        },
        [
          topbar,
          ribbon,
          h('div', { class: 'bb-office-workspace' }, [
            nav,
            h('div', { class: 'bb-office-main' }, [
              ...rulers,
              h('div', { class: 'bb-office-ruler-body' }, [
                verticalRuler,
                h(
                  'div',
                  {
                    class: 'bb-office-canvas',
                    ref: canvasRef,
                    role: 'region',
                    'aria-label': 'Document canvas',
                  },
                  [surface]
                ),
              ]),
            ]),
          ]),
          props.commandSearch && props.registry
            ? h(CommandSearch, {
                ref: searchRef,
                registry: props.registry,
                editor: props.editor,
                onExecute: (id: string, ok: boolean) => {
                  if (ok) emit('command', id);
                },
              })
            : null,
          props.showStatusBar && !props.focusMode
            ? h(StatusBar, {
                editor: props.editor,
                pageInfo: props.pageInfo,
                language: props.language,
                presence: props.presence,
              })
            : null,
        ]
      );
    };
  },
});
