/**
 * OOXML field instruction generation.
 *
 * @module
 */

import type { FieldType } from '@amusendame/beakblock-schema';

/**
 * Builds the OOXML instruction text (`w:instrText`) for a field.
 *
 * | Field | Instruction |
 * |---|---|
 * | PAGE | `PAGE` |
 * | NUMPAGES | `NUMPAGES` |
 * | DOCPROPERTY | `DOCPROPERTY <name>` |
 * | SEQ | `SEQ <name> \* <format or ARABIC>` |
 * | REF | `REF <target> \h` |
 * | LIMS | `LIMS <key>` (custom, not an OOXML field) |
 * | DATE | `DATE \@ "<format>"` |
 * | TOC | `TOC \o "1-3" \h \z \u` |
 *
 * A `format` adds `\* <format>` to PAGE, NUMPAGES, DOCPROPERTY and LIMS.
 *
 * @example
 * ```typescript
 * fieldInstruction('SEQ', 'Figure'); // 'SEQ Figure \\* ARABIC'
 * fieldInstruction('REF', 'h-purpose'); // 'REF h-purpose \\h'
 * ```
 */
export function fieldInstruction(
  fieldType: FieldType | 'TOC',
  name?: string | null,
  format?: string | null
): string {
  const formatSwitch = (value: string | null | undefined) => (value ? ` \\* ${value}` : '');
  switch (fieldType) {
    case 'PAGE':
      return `PAGE${formatSwitch(format)}`;
    case 'NUMPAGES':
      return `NUMPAGES${formatSwitch(format)}`;
    case 'DOCPROPERTY':
      return ['DOCPROPERTY', name ?? undefined].filter(Boolean).join(' ') + formatSwitch(format);
    case 'SEQ':
      return `SEQ ${name || 'Figure'} \\* ${format || 'ARABIC'}`;
    case 'REF':
      return ['REF', name ?? undefined, '\\h'].filter(Boolean).join(' ');
    case 'LIMS':
      return ['LIMS', name ?? undefined].filter(Boolean).join(' ') + formatSwitch(format);
    case 'DATE':
      return `DATE \\@ "${format || 'd MMMM yyyy'}"`;
    case 'TOC':
      return 'TOC \\o "1-3" \\h \\z \\u';
    default:
      return String(fieldType);
  }
}
