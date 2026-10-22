# @amusendame/beakblock-commands

A single command registry that drives the ribbon, keyboard shortcuts, menus, AI tooling and the programmatic API.

## Usage

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  CommandRegistry,
  createBuiltInCommands,
  createDefaultRibbon,
  getContextualTabs,
} from '@amusendame/beakblock-commands';

const editor = new BeakBlockEditor({ element });
const registry = new CommandRegistry();
registry.register(createBuiltInCommands());
registry.bind(editor);
editor.pm.addPlugin(registry.createKeymapPlugin());

registry.execute('format.bold');
registry.execute('format.textColor', { color: '#c00000' });
registry.search('heading'); // ranked, with shortcut hints
registry.repeatLast();     // F4
```

## Policy checks

```typescript
registry.setPolicyCheck((cmd, ctx) => {
  if (cmd.operation === 'formatText' && locked) return 'document is locked';
  return true; // true allows; false or a string denies
});
registry.onDenied((e) => toast(e.reason));
registry.onExecute((e) => audit(e.id, e.result));
```

Every `execute()` runs the policy check first, then `isEnabled`, then `run`. `canExecute(id)` runs the same checks without running the command.

## API

| Member | Purpose |
|---|---|
| `register(def \| def[])` / `unregister(id)` | Add or replace commands; `register` with an existing id replaces it |
| `get(id)` / `list(group?)` | Lookup in registration order |
| `search(query)` | Every token must match label, id, description or group. Returns `{ command, score, shortcutHint }` sorted by score |
| `execute(id, args?)` / `canExecute(id, args?)` | Run with policy and enabled checks |
| `isActive(id)` | Toggle state for ribbon buttons |
| `repeatLast()` | Re-run the last successful `repeatable` command with its args (F4) |
| `setPolicyCheck(fn \| null)` | Install the policy hook |
| `onExecute(fn)` / `onDenied(fn)` | Subscribe. Both return an unsubscribe function |
| `getLastDenial()` | Last denial `{ id, reason }` |
| `bind(editor)` | Required before anything runs |
| `createKeymapPlugin()` | ProseMirror plugin built from every command's `shortcut` at key-press time. `F4` runs `repeatLast()` when no command binds it |

## Command definition

```typescript
interface CommandDefinition {
  id: string;                 // dotted, e.g. 'format.bold'
  label: string;
  description?: string;
  icon?: string;              // lucide-style name
  group?: string;
  shortcut?: string | string[]; // 'Mod-b' (Mod = Ctrl, or Cmd on Apple platforms)
  operation?: string;         // OperationKind from @amusendame/beakblock-permissions
  isEnabled?(ctx): boolean;
  isActive?(ctx): boolean;
  run(ctx): boolean;
  repeatable?: boolean;
}
```

## Built-in commands

`createBuiltInCommands()` returns commands that work against the current core API:

- **Font:** `format.bold`, `format.italic`, `format.underline`, `format.strikethrough`, `format.code`, `format.textColor` (args `{ color }`), `format.highlight` (optional `{ color }`, default yellow), `format.clearFormatting`
- **Styles:** `paragraph.style.normal`, `paragraph.style.heading1`..`heading6`, `paragraph.style.title` (heading 1 fallback), `paragraph.style.quote`
- **Paragraph:** `paragraph.align.left|center|right|justify`, `list.bullet`, `list.numbered`, `list.check`, `list.indent`, `list.outdent`
- **Insert:** `insert.table` (args `{ rows, cols }`), `insert.image` (args `{ src, alt? }`, disabled without `src`), `insert.divider`, `insert.callout` (`{ calloutType }`), `insert.codeBlock`, `insert.toc`, `insert.columns` (`{ count }`), `insert.pageBreak` (`Mod-Enter`, only when the schema has `pageBreak`), `insert.field.page`, `insert.field.numPages`, `insert.field.docProperty` (`{ name }`), only when the schema has `field`
- **Table:** `table.insertRowAbove`, `table.insertRowBelow`, `table.insertColumnLeft`, `table.insertColumnRight`, `table.deleteRow`, `table.deleteColumn`, `table.deleteTable`
- **History:** `history.undo`, `history.redo`
- **View:** `view.mode.block|office|controlled` (call `editor.setMode` when present)
- **Review:** `review.view.markup|final|original` (call `editor.setReviewView` when present)

Commands whose schema node or editor method is missing report `isEnabled() === false`. They never throw.

## Ribbon

`createDefaultRibbon()` returns a declarative layout: Home, Insert, Layout, References, Review, View and QMS, plus contextual Table, Picture, Chart and Controlled Section tabs. Items reference command ids only. Shells skip ids that are not registered, so `ai.*`, `qms.*` and `review.*` commands can be added later.

`getContextualTabs(editor)` returns the contextual tabs that apply to the selection: `table` (caret in a table), `picture` (image selected), `chart` (chart or embed selected) and `controlledSection` (caret inside one).

## Notes

- `Mod-e` is centre alignment (Word). The core keyboard plugin binds `Mod-e` to inline code, so the two conflict when both plugins are installed.
- Table merge and split are not included, because core does not export them yet.
