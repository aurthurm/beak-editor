# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Vue Package (`@aurthurm/beakblock-vue`)
- Vue 3 composables for editor lifecycle and state subscriptions
- `BeakBlockView` component for mounting the editor into Vue templates
- Package metadata and documentation updates for Vue installation
- Vue package test coverage for composables, custom block helpers, and editor mounting
- Vue/Vite and Nuxt/Vue example apps under `examples/`

## [1.0.0] - 2026-01-25

### Added

#### Core Editor (`@aurthurm/beakblock-core`)
- **Public ProseMirror API** - Full access to ProseMirror internals via `editor.pm.*`
- **Block-based JSON document format** - Notion-like structure with full TypeScript support
- **Schema System**
  - Block nodes: paragraph, heading (h1-h6), blockquote, callout, codeBlock, divider, bulletList, orderedList, listItem, checkList, checkListItem, columnList, column, table, tableRow, tableCell, tableHeader, image, embed
  - Mark types: bold, italic, underline, strikethrough, code, link, textColor, backgroundColor
- **Plugin System**
  - Slash menu plugin (`/` command palette)
  - Bubble menu plugin (floating toolbar)
  - Drag & drop plugin for block reordering
  - Table plugin with row/column manipulation
  - Media menu plugin for image/video controls
  - Keyboard shortcuts plugin
  - Input rules for auto-formatting (markdown shortcuts)
  - Block ID management plugin
  - Checklist plugin
  - Multi-block selection plugin
- **Table Commands** - addRowAfter, addRowBefore, deleteRow, addColumnAfter, addColumnBefore, deleteColumn, deleteTable, goToNextCell, goToPreviousCell
- **Document Operations** - getDocument, setDocument, getBlock, insertBlocks, updateBlock, removeBlocks
- **Text Formatting Commands** - toggleBold, toggleItalic, toggleUnderline, toggleStrikethrough, toggleCode, setTextColor, setBackgroundColor
- **History Support** - Undo/redo via ProseMirror history
- **CSS Auto-injection** - Automatic style injection with opt-out support

#### React Package (`@aurthurm/beakblock-react`)
- **Hooks**
  - `useBeakBlock` - Create and manage editor instances
  - `useEditorContent` - Subscribe to document changes
  - `useEditorSelection` - Track selection changes
  - `useEditorFocus` - Monitor focus state
  - `useCustomSlashMenuItems` - Generate menu items from custom blocks
- **Components**
  - `BeakBlockView` - Main editor view component
  - `SlashMenu` - Command palette UI
  - `BubbleMenu` - Floating formatting toolbar
  - `TableHandles` - Row/column manipulation handles
  - `TableMenu` - Table cell operations menu
  - `MediaMenu` - Image/video controls
  - `ColorPicker` - Color selection UI
  - `LinkPopover` - Link editing popover
- **Custom Blocks API** - `createReactBlockSpec` for creating React-based custom blocks
- **Custom Block Hooks** - `useBlockEditor` and `useUpdateBlock` for custom block implementations

### Documentation
- React integration guide
- Custom blocks guide
- Custom marks guide
- Plugins guide
- Styling and theming guide
- Comprehensive README with API reference

---

## [0.0.1] - 2026-01-17

### Added
- Initial project setup
- Basic editor functionality
- ProseMirror integration
- React bindings foundation
