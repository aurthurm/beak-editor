/**
 * Triage of the clinical validation panel on the Nuxt demo document.
 *
 * The fixture is the demo's `clinicalDemoBlocks()` output (examples/nuxt-vue/utils/v2/demoData.ts),
 * with the LIMS records it uses. Each expected issue is classified:
 *
 * - intentional: the demo shows a failure on purpose (inactive instrument, empty required field)
 * - bad demo data: a sample row has fewer values than the table has columns, so Expiry is "—"
 * - validator bug, fixed: `validateClinicalDocument` used to report `unregistered-block-type` for
 *   caption, conditional and equation blocks owned by blocks-office
 *
 * The panel reports the expiry and operator errors twice, once from the block registry and once from
 * the clinical or forms rules, because `validateClinicalDocument` also runs the block validators.
 */

import { describe, expect, it } from 'vitest';
import type { Block, ValidationIssue } from '@amusendame/beakblock-core';
import { clinicalExtension } from './clinical/extension';
import { formsExtension } from './forms/extension';
import { validateClinicalDocument } from './document';
import { validateEquipmentReferences, type EquipmentProvider } from './clinical/equipment';
import { validateForm } from './forms/validation';
import { createEditor } from './testHelpers';
import fixture from './fixtures/nuxtClinicalDemo.json';

interface LimsRecord {
  id: string;
  code: string;
  name: string;
  status: string;
}

const records = fixture.records as LimsRecord[];
const lims: EquipmentProvider = {
  async search(query: string) {
    return records.filter((r) => !query || r.name.includes(query) || r.code.includes(query));
  },
  async get(id: string) {
    return records.find((r) => r.id === id) ?? null;
  },
} as unknown as EquipmentProvider;

describe('nuxt clinical demo: validation panel triage', () => {
  it('reports only the expected issues, each traced to its source', async () => {
    const editor = createEditor([clinicalExtension({ equipmentProvider: lims }), formsExtension({})], fixture.blocks as Block[]);
    const blocks = editor.getDocument();

    const registry = editor.blockRegistry.validate(blocks);
    const clinical = validateClinicalDocument(blocks, { equipmentProvider: lims });
    const forms = validateForm(blocks);
    const equipment = await validateEquipmentReferences(editor.pm.state.doc, lims);

    const summary = (issues: ValidationIssue[]) => issues.map((i) => `${i.severity}:${i.code}:${i.blockId ?? ''}`);

    // Bad demo data (the sample rows have four values for five columns, so Expiry is "—").
    expect(summary(registry).filter((s) => s.includes('invalid-expiry-date'))).toEqual([
      'error:invalid-expiry-date:reagent-10',
      'error:invalid-expiry-date:reagent-10',
    ]);
    expect(summary(clinical).filter((s) => s.includes('invalid-expiry-date'))).toHaveLength(2);

    // Intentional: an empty required field in the run record.
    expect(summary(forms)).toEqual(['error:required-missing:f-operator']);
    expect(summary(registry)).toContain('error:required-missing:f-operator');
    expect(summary(clinical)).toContain('error:required-missing:f-operator');

    // Intentional: the centrifuge in the mock LIMS is inactive.
    expect(summary(equipment)).toEqual(['warning:equipment-inactive:']);

    // Fixed validator bug: the clinical rules no longer judge blocks from blocks-office.
    expect(clinical.map((i) => i.code)).not.toContain('unregistered-block-type');
  });
});
