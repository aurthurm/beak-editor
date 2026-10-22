/**
 * Template authoring: create, edit (immutably), publish and derive templates.
 *
 * Edits return new objects. Only drafts can be edited. `publishTemplate` returns a frozen,
 * versioned copy with a content hash.
 *
 * @module
 */

import type { BeakDocument, NumberingDefinitions, PageSetup, StyleSheet } from '@amusendame/beakblock-schema';
import { createDefaultNumbering, createDefaultPageSetup, createDefaultStyleSheet } from '@amusendame/beakblock-schema';
import type { Block } from '@amusendame/beakblock-core';

import { contentHash } from './hash';
import { cloneDeep, deepFreeze } from './blocks';
import type { FieldRules, PageMasters, TemplateDefinition, TemplateSectionDefinition } from './types';

/** Thrown for template operations that the template's status does not allow, or for invalid input. */
export class TemplateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
  }
}

/** Default property rules: generated SOP-style number, required title, effective date from workflow. */
export function defaultFieldRules(): FieldRules {
  return {
    docNumber: { generated: true, readOnly: true, required: true },
    title: { required: true, maxLength: 200 },
    revision: { required: true, readOnly: true },
    effectiveDate: { source: 'workflow', readOnly: true },
  };
}

/** Input for {@link createTemplate}. */
export interface CreateTemplateInput {
  id: string;
  title: string;
  documentType: string;
  pageMasters?: PageMasters;
  styles?: StyleSheet;
  numbering?: NumberingDefinitions;
  properties?: FieldRules;
  header?: Block[];
  footer?: Block[];
  watermark?: string;
}

function assertDraft(template: TemplateDefinition): void {
  if (template.status !== 'draft') {
    throw new TemplateError('not-draft', `Template "${template.id}" is ${template.status}; create a draft to change it`);
  }
}

/** Creates a draft template with A4 page masters, the default styles and default property rules. */
export function createTemplate(input: CreateTemplateInput): TemplateDefinition {
  if (!input.id || !input.title) throw new TemplateError('invalid-input', 'Template needs an id and a title');
  const pageSetup: PageSetup = createDefaultPageSetup();
  return {
    id: input.id,
    version: 0,
    status: 'draft',
    title: input.title,
    documentType: input.documentType,
    styles: input.styles ?? createDefaultStyleSheet(),
    numbering: input.numbering ?? createDefaultNumbering(),
    pageMasters: input.pageMasters ?? { default: pageSetup },
    header: input.header,
    footer: input.footer,
    properties: input.properties ?? defaultFieldRules(),
    sections: [],
    watermark: input.watermark,
  };
}

/** Adds a section to the end of a draft. Its `templateSectionId` must be unique. */
export function addSection(
  template: TemplateDefinition,
  section: Omit<TemplateSectionDefinition, 'defaultRoles'> & { defaultRoles?: TemplateSectionDefinition['defaultRoles'] }
): TemplateDefinition {
  assertDraft(template);
  if (template.sections.some((s) => s.templateSectionId === section.templateSectionId)) {
    throw new TemplateError('duplicate-section', `Section "${section.templateSectionId}" already exists`);
  }
  const next: TemplateSectionDefinition = { ...cloneDeep(section), defaultRoles: section.defaultRoles ?? {} };
  return { ...template, sections: [...template.sections, next] };
}

/** Patches one section of a draft. `templateSectionId` cannot change. */
export function updateSection(
  template: TemplateDefinition,
  templateSectionId: string,
  patch: Partial<Omit<TemplateSectionDefinition, 'templateSectionId'>>
): TemplateDefinition {
  assertDraft(template);
  const index = template.sections.findIndex((s) => s.templateSectionId === templateSectionId);
  if (index < 0) throw new TemplateError('unknown-section', `No section "${templateSectionId}"`);
  const sections = template.sections.map((s, i) => (i === index ? { ...cloneDeep(s), ...cloneDeep(patch) } : s));
  return { ...template, sections };
}

/** Moves a section to a new index in a draft. */
export function moveSection(template: TemplateDefinition, templateSectionId: string, toIndex: number): TemplateDefinition {
  assertDraft(template);
  const from = template.sections.findIndex((s) => s.templateSectionId === templateSectionId);
  if (from < 0) throw new TemplateError('unknown-section', `No section "${templateSectionId}"`);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= template.sections.length) {
    throw new TemplateError('invalid-index', `Index ${toIndex} is out of range`);
  }
  const sections = [...template.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(toIndex, 0, moved!);
  return { ...template, sections };
}

/** Removes a section from a draft. */
export function removeSection(template: TemplateDefinition, templateSectionId: string): TemplateDefinition {
  assertDraft(template);
  if (!template.sections.some((s) => s.templateSectionId === templateSectionId)) {
    throw new TemplateError('unknown-section', `No section "${templateSectionId}"`);
  }
  return { ...template, sections: template.sections.filter((s) => s.templateSectionId !== templateSectionId) };
}

/**
 * Publishes a draft: version bump, `published` status, deep-frozen copy and content hash.
 *
 * @throws {TemplateError} when the template is not a draft, has no sections, or repeats a section id
 */
export async function publishTemplate(template: TemplateDefinition, now: Date = new Date()): Promise<TemplateDefinition> {
  assertDraft(template);
  if (template.sections.length === 0) throw new TemplateError('no-sections', 'A template needs at least one section');
  const ids = template.sections.map((s) => s.templateSectionId);
  if (new Set(ids).size !== ids.length) throw new TemplateError('duplicate-section', 'Duplicate templateSectionId');
  const body: TemplateDefinition = {
    ...cloneDeep(template),
    status: 'published',
    version: template.version + 1,
    publishedAt: now.toISOString(),
  };
  const hash = await contentHash(body);
  return deepFreeze({ ...body, contentHash: hash });
}

/** Starts a new draft from a published template (for the next version). The copy is not frozen. */
export function createDraftFromPublished(template: TemplateDefinition): TemplateDefinition {
  if (template.status !== 'published') throw new TemplateError('not-published', 'Only a published template can be revised');
  const { contentHash: _hash, publishedAt: _at, ...rest } = cloneDeep(template);
  return { ...rest, status: 'draft' };
}

/**
 * Derives a draft template from an existing controlled document.
 *
 * Each top-level `controlledSection` becomes a template section. Children marked
 * `props.lockedBy === 'template'` become locked boilerplate. Everything else is dropped.
 */
export function templateFromDocument(
  doc: BeakDocument,
  options: { id: string; title: string; documentType: string }
): TemplateDefinition {
  const sections: TemplateSectionDefinition[] = [];
  const seen = new Set<string>();
  for (const section of doc.sections) {
    for (const block of section.blocks) {
      if (block.type !== 'controlledSection') continue;
      const props = block.props as Record<string, unknown>;
      let templateSectionId = typeof props.templateSectionId === 'string' && props.templateSectionId ? props.templateSectionId : `ts-${sections.length + 1}`;
      if (seen.has(templateSectionId)) templateSectionId = `${templateSectionId}-${sections.length + 1}`;
      seen.add(templateSectionId);
      const boilerplate = (block.children ?? []).filter((c) => (c.props as Record<string, unknown>)?.lockedBy === 'template');
      sections.push({
        templateSectionId,
        title: String(props.title ?? templateSectionId),
        required: props.required === true,
        allowedBlocks: Array.isArray(props.allowedBlocks) ? (props.allowedBlocks as string[]) : null,
        lockedBoilerplate: cloneDeep(boilerplate),
        placeholder: [],
        defaultRoles: props.ownerName ? { author: String(props.ownerName) } : {},
      });
    }
  }
  const first = doc.sections[0];
  const pageSetup = first ? cloneDeep(first.pageSetup) : createDefaultPageSetup();
  return {
    id: options.id,
    version: 0,
    status: 'draft',
    title: options.title,
    documentType: options.documentType,
    styles: cloneDeep(doc.styles),
    numbering: cloneDeep(doc.numbering),
    pageMasters: { default: pageSetup },
    header: first?.headers?.default ? cloneDeep(first.headers.default) : undefined,
    footer: first?.footers?.default ? cloneDeep(first.footers.default) : undefined,
    properties: defaultFieldRules(),
    sections,
  };
}

/** Blocks of a document flattened across its sections, in order. */
export function flattenBlocks(doc: BeakDocument): Block[] {
  return doc.sections.flatMap((s) => s.blocks);
}

/** Top-level controlled section blocks of a document, in order. */
export function controlledSectionsOf(doc: BeakDocument): Block[] {
  return flattenBlocks(doc).filter((b) => b.type === 'controlledSection');
}
