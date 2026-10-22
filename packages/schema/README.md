# @amusendame/beakblock-schema

Versioned canonical document schema for BeakBlock 2.0: the v2 `BeakDocument` (sections,
style sheet, numbering, page setup, document properties), the migration path from the
legacy `Block[]` format, and structural validation.

Part of BeakBlock 2.0 — see `beakblock-2.0-roadmap.md` and `docs/2.0/contracts.md` §2.

Units are points and twips internally (1pt = 20 twips, 1in = 1440 twips). Pixels appear
only at render time (1px = 15 twips).

## Migrating legacy documents

```ts
import { migrateDocument, documentToBlocks, blocksToDocument } from '@amusendame/beakblock-schema';

// Accepts Block[] (v1), { schemaVersion: 1, blocks }, or a v2 document.
const doc = migrateDocument(legacyBlocks);

// Lossless for a single-section document: the blocks come back deep-equal.
documentToBlocks(doc);

// Build a document directly. Each sectionBreak block starts a new section.
const v2 = blocksToDocument(blocks, { properties: { docNumber: 'SOP-001' } });
```

`sectionBreak` blocks split the document. The section that follows a break takes the
break's id and its `pageSetup`. `documentToBlocks` writes the break back before each
section after the first.

## Styles and numbering

```ts
import {
  createDefaultStyleSheet,
  createDefaultNumbering,
  resolveParagraphStyle,
  NUMBERING_IDS,
} from '@amusendame/beakblock-schema';

const styles = createDefaultStyleSheet(); // Normal, Heading1-6, Title, Caption, TOC1-3, ...
const heading = resolveParagraphStyle(styles, 'Heading2');
heading?.runProps.font;   // 'Carlito', inherited from Normal
heading?.chain;           // ['Heading2', 'Normal']

const numbering = createDefaultNumbering(); // numId '1' bullets, '2' decimal, '3' 1 / 1.1 / 1.1.1, '4' checkboxes
```

`resolveParagraphStyle` returns `null` for unknown ids. It stops at `basedOn` cycles and
dangling references, so bad style data cannot loop.

## Page setup and units

```ts
import { createPageSetup, PAGE_SIZES, ptToTwips, twipsToPx, mmToTwips } from '@amusendame/beakblock-schema';

createPageSetup({ size: 'A4', orientation: 'landscape' });
PAGE_SIZES.Letter;          // { widthTwips: 12240, heightTwips: 15840 }
ptToTwips(12);              // 240
twipsToPx(1440);            // 96
mmToTwips(25.4);            // 1440
```

Named sizes are A4, Letter, Legal and A3. Default margins are 1 inch, with 0.5 inch
header and footer.

## Migrations

```ts
import { MigrationRegistry } from '@amusendame/beakblock-schema';

const registry = new MigrationRegistry({ currentVersion: 3 })
  .register(2, (doc) => upgradeV2toV3(doc));
registry.migrate(v2Doc, 2); // applies 2 -> 3
```

`migrateDocument` uses `defaultMigrations`, which holds the built-in v1 -> v2 step.

## Validation

```ts
import { validateDocumentStructure } from '@amusendame/beakblock-schema';

const issues = validateDocumentStructure(doc);
// issues: { severity, code, message, sectionId?, blockId?, path? }
```

Codes: `missing-sections`, `duplicate-section-id`, `duplicate-block-id`, `missing-block-id`,
`unknown-style`, `unknown-table-style`, `unknown-numbering`, `unknown-numbering-abstract`,
`invalid-numbering-level`, `unknown-base-style`, `style-cycle`, `nested-section-break`,
`invalid-page-setup`.

## Fixtures

`fixtures.richSopBlocks` (and the `richSopBlocks` named export) is a rich single-section
SOP covering every core block type. `fixtures.richSopBlocksWithSections` is the same
document split by a landscape `sectionBreak`. Other packages can reuse them in tests.

```ts
import { fixtures } from '@amusendame/beakblock-schema';
```

## Scripts

```bash
pnpm --filter @amusendame/beakblock-schema build
pnpm --filter @amusendame/beakblock-schema test
```
