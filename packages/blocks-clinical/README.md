# @amusendame/beakblock-blocks-clinical

Clinical and lab semantic blocks and form controls for BeakBlock 2.0. Semantics live in the
node type and its validation, not in the rendering: a `sopStep` renders as a plain numbered
step, a `safetyWarning` as a lightly boxed paragraph. Lab-specific rules live in this package,
never in core.

## Usage

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { clinicalExtension, formsExtension, validateClinicalDocument, EXAMPLE_PLACEHOLDER_RULES } from '@amusendame/beakblock-blocks-clinical';

const editor = new BeakBlockEditor({
  element,
  extensions: [
    clinicalExtension({ equipmentProvider: limsEquipment, allowedUnits: ['mg/mL', 'mmol/L'] }),
    formsExtension(),
  ],
});

const issues = validateClinicalDocument(editor.getDocument(), {
  procedureType: 'hazardous',
  safetyRequiredFor: ['hazardous'],
  placeholderRules: EXAMPLE_PLACEHOLDER_RULES,
});
```

Call `injectClinicalStyles()` once if you want the package CSS (`CLINICAL_STYLES`) in the page.

## Clinical and lab blocks (`clinicalExtension(options)`)

| Block | Shape | Validation |
| --- | --- | --- |
| `sopStep` | block content; `stepNumber` (numbered automatically), `critical`, `timeMinutes` | non-empty text (warning), positive step number, non-negative time |
| `safetyWarning` | block content; `level` `caution`/`warning`/`danger`, `hazardCodes`, `ppe` | non-empty text, known level, GHS codes `H2xx`/`H3xx`/`H4xx` |
| `reagentTable` | wrapper whose content is one `table` (core table renderer); `requiredColumns` | required header columns; `Unit` in `allowedUnits`; `Expiry` an ISO date |
| `testMethodSpec` | atom: `methodCode`, `version`, `analyte`, `principle` | `methodCode` required and matching `methodCodePattern` |
| `specimenRequirements` | atom: `specimenType`, `container`, `volumeMl`, `minVolumeMl`, `stability`, `rejectionCriteria` | numeric non-negative volumes, minimum not above volume |
| `qcCriteria` | atom: `analyte`, `level`, `target`, `sd`, `westgardRules` | analyte, numeric target, positive SD, known Westgard rules (`1_2s`, `1_3s`, `2_2s`, `R_4s`, `4_1s`, `10_x`) |
| `equipmentReference` | inline atom: `equipmentId`, `code`, `name`, `status` | resolved through the provider; inactive or unknown equipment warns |

Step numbers run 1, 2, 3 within each parent container; blocks between steps do not break the sequence. A step with no content is still counted and numbered; numbering never throws, and a failure is logged once.

### Equipment

```typescript
interface EquipmentProvider {
  search(query: string): Promise<EquipmentRecord[]>;
  get(id: string): Promise<EquipmentRecord | null>; // null = unknown or not authorised
}
```

The node view shows `code name` and marks inactive equipment. Inline references are not visible
to the block registry, so check them on the ProseMirror document:

```typescript
const issues = await validateEquipmentReferences(editor.pm.doc, provider);
```

## Forms (`formsExtension(options)`)

| Block | Notes |
| --- | --- |
| `formText`, `formNumber`, `formDate` | `name`, `label`, `required`, `value`, `readOnly`, `placeholder`; number adds `min`, `max`, `unit`, `allowedUnits`, `decimals`; date adds ISO `min`, `max` |
| `formDropdown`, `formRadio` | `options` |
| `formCheckbox` | `value` boolean |
| `formCalculated` | read-only `expression` over other field names; recalculated on every change |
| `formRepeatableRow` | container; rows sharing a `name` collect into an array |
| `validatedFormSection` | container; warns when empty |

Controls write their value back through a transaction. Read-only fields and a non-editable editor
disable the control.

### Calculated fields

Expressions support numbers, field names, `+ - * /`, unary signs and parentheses. There is no
`eval`, no function calls and no property access. Anything else raises a `FormulaError`:

```typescript
evaluateFormula('(dose * 2) / volume', { dose: 4, volume: 2 }); // 4
evaluateFormula('alert(1)', {}); // throws FormulaError
```

### Helpers

- `collectFormValues(blocks)`: field values keyed by name, with calculated results.
- `validateForm(blocks)`: required, number range, unit allowed, date range, option, and formula checks.

## Document validation

`validateClinicalDocument(blocks, options)` runs every clinical and form block validator, then:

- at least one `sopStep`;
- a `safetyWarning` when `procedureType` is in `safetyRequiredFor`;
- `placeholderRules` applied to form fields by `name`.

It does not judge blocks owned by other extensions (for example `conditional`, `caption` or `equation`
from blocks-office). Their `unregistered-block-type` warnings are not reported. To flag types that no
extension provides, pass every block type the document may contain as `knownBlockTypes`; any other
unregistered type is then reported as a warning with code `unregistered-block-type`.

```typescript
validateClinicalDocument(blocks, { knownBlockTypes: ['caption', 'conditional', 'equation'] });
```

`EXAMPLE_PLACEHOLDER_RULES` follows roadmap section 5F: `sopNumber` read-only and required,
`title` required with max length, `effectiveDate` read-only, `concentration` numeric with allowed units.

## Notes

- Form fields are block atoms, not inline atoms. Form validation and value collection walk block trees,
  so a field inside a paragraph would be invisible to them.
- Validation here is the editor-side feedback. The server remains authoritative.

## Tests

```sh
pnpm --filter @amusendame/beakblock-blocks-clinical test
```
