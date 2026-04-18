# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-04-18

### Changed

- **Workspace** — all publishable and example `package.json` versions set to **0.1.1** to match git tag `v0.1.1`.
- **npm scope** — published packages use **`@amusendame/*`** instead of `@aurthurm/*` (install paths and imports updated across the workspace).

### Added

#### Core (`@amusendame/beakblock-core`)

- **Compliance lock** — Optional **`EditorConfig.complianceLock`** with **`createComplianceLockPlugin`**: headings can set **`attrs.locked`** (plus optional **`lockReason`**, **`lockId`**). Blocks are read-only for normal edits; reordering vs other locked blocks is gated by **`allowReorder`**. Trusted code may set transaction meta **`COMPLIANCE_LOCK_BYPASS_META`** to apply changes. Integrates with drag-and-drop (handle visibility), bubble menu hiding, multi-block delete, and markdown/HTML round-trip via `data-beakblock-*` attributes.
- **Lock UI** — Default CSS shows a **padlock** at the **start** of locked headings and a **`.ob-block-lock-badge`** in the **hover side menu** (tooltip from **`lockReason`** when present).

#### Documentation

- **[Compliance lock](docs/compliance-lock.md)** — Configuration, policy matrix, bypass, helpers, DOM/CSS hooks, and collaboration notes. Linked from [Plugins](docs/plugins.md), [Heading block](docs/blocks/heading.md), [Styling](docs/styling.md), [Compliance demo](docs/compliance-demo.md), and the root [README](README.md).

## [0.1.0] - 2026-04-18

### Changed

- **Workspace** — all publishable and example `package.json` versions set to **0.1.0** to match git tag `v0.1.0`.

### Added

#### Documentation

- **[Compliance workflow (Nuxt)](docs/compliance-demo.md)** — describes the `examples/nuxt-vue` compliance workspace: section approvals, append-only approval history, author read-only lock after sign-off, optional document-level dual attestation, IndexedDB stores, and export appendices. Cross-linked from [Versioning](docs/versioning.md), [Comments](docs/comments.md), the root [README](README.md), and [Vue package README](packages/vue/README.md).

## [1.0.0] - 2026-01-25

### Added

#### Core Editor (`@amusendame/beakblock-core`)
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

#### React Package (`@amusendame/beakblock-react`)
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
