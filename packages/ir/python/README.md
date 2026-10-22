# beakdoc_ir (Python twin of @amusendame/beakblock-ir)

Dataclasses that mirror the TypeScript BeakDoc IR and the schema types it uses, with
`from_dict` and `to_dict` for JSON interchange. Standard library only, Python 3.10+.

## Usage

```python
import json
from beakdoc_ir import ir_document_from_dict, to_dict

with open("document.ir.json", encoding="utf-8") as handle:
    ir = ir_document_from_dict(json.load(handle))

for section in ir.sections:
    print(section.id, section.page_setup.orientation, len(section.body))

data = to_dict(ir)  # camelCase keys, ready for json.dump
```

## Conventions

- Field names are snake_case. JSON keys are the camelCase TypeScript names
  (`grid_span` is `gridSpan`).
- For typed fields, `None` means absent in both directions. `to_dict` omits it, and an
  explicit `null` on a typed field reads as absent.
- Free-form dicts (`source.props`, `container_props`, `raw`, `styles`, `numbering`)
  keep their nulls.
- Style sheet and numbering definitions are plain dicts. The IR only looks them up.
- Unknown inline or block `type` values raise `ValueError`. Unknown keys are ignored.
- `ir_version` is `IR_VERSION` (1) for documents exported by this release.

## Tests

From `packages/ir/python`:

```bash
python3 -m unittest
```

`tests/data/rich_sop_ir.json` is exported from the TypeScript package. The test
suite checks that it parses and serialises back to the same JSON. To regenerate it after
changing the TypeScript IR, build the IR and schema packages, then run:

```bash
node packages/ir/python/tests/export_fixture.mjs
```
