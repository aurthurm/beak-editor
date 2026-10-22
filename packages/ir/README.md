# @amusendame/beakblock-ir

BeakDoc IR: an OOXML-shaped intermediate representation of a BeakBlock document. Styles,
numbering, sections, fields, tables and content controls are explicit. Every exporter
(DOCX, PDF, layout) reads this IR rather than the editor's block JSON.

Part of BeakBlock 2.0 — see `beakblock-2.0-roadmap.md` and `docs/2.0/contracts.md` §6.
A Python twin lives in `python/`.

## Shape

- Lists are paragraphs with `props.numbering = { numId, level }`. `numId` `1` is bullets,
  `2` decimal, `4` checkboxes.
- Headings, quotes, callouts and code are paragraphs with a `props.styleId` (`Heading2`,
  `Quote`, `CalloutWarning`, `Code`, ...).
- Tables carry a `grid` in twips. A `vMerge: 'restart'` cell is followed by
  `vMerge: 'continue'` placeholders in the rows it spans.
- `controlledSection` blocks become `sdt` elements with `tag = sectionId`.
- Fields are inline `field` items with an OOXML `instr` and `cachedText`.
- Every IR block has a `source` that records the original block id, type and props.

## Usage

```ts
import { documentToIR, irToDocument, blocksToIR, validateIR } from '@amusendame/beakblock-ir';
import { migrateDocument, documentToBlocks } from '@amusendame/beakblock-schema';

const doc = migrateDocument(legacyBlocks);
const ir = documentToIR(doc);

validateIR(ir).filter((issue) => issue.severity === 'error'); // []

// Lossless: the same blocks come back.
documentToBlocks(irToDocument(ir));

// Convenience for flat block lists.
const ir2 = blocksToIR(legacyBlocks);
```

## Fields

```ts
import { fieldInstruction } from '@amusendame/beakblock-ir';

fieldInstruction('PAGE');                 // 'PAGE'
fieldInstruction('DOCPROPERTY', 'docNumber'); // 'DOCPROPERTY docNumber'
fieldInstruction('SEQ', 'Figure');        // 'SEQ Figure \\* ARABIC'
fieldInstruction('REF', 'h-purpose');     // 'REF h-purpose \\h'
```

The `TOC` field type is used for `tableOfContents` blocks.

## Unknown block types

Unknown types never throw. The converter tries the block registry first:

```ts
const ir = documentToIR(doc, {
  registry: { get: (type) => (type === 'hologram' ? { toIR: holoToIR } : undefined) },
});
```

If there is no serializer, or it throws, the block becomes a paragraph with its original
content kept in `source.raw`. `irToDocument` restores it exactly.

## Extensions beyond the contract

These are all optional, so contract consumers are unaffected:

- `IRSource.list` (list membership) and `IRSource.raw` (opaque block content).
- `IRDocument.id` and `irVersion`.
- `IRRun.link`, `IRField.format` and `IRField.fallback`, `IRRevision.authorId` and `aiGenerated`.
- An `icon` inline, `IRTableCell.source` and `IRTableRow.source`.
- `IRTable.props.widthMode` is optional here; a missing value means `'auto'` and round-trips.

## Scripts

```bash
pnpm --filter @amusendame/beakblock-schema build   # build schema first
pnpm --filter @amusendame/beakblock-ir build
pnpm --filter @amusendame/beakblock-ir test
```
