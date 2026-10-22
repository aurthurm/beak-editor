/**
 * Package-level OOXML parts: relationships, content types, styles, numbering,
 * settings, font table and document properties.
 *
 * @module
 */

import { bordersXml, paragraphPropsInner, pPr, rPr, runPropsInner, shadingXml } from './formatting';
import type { FontResolver } from './formatting';
import type {
  DocumentProperties,
  NumberingDefinitions,
  ParagraphStyle,
  StyleSheet,
  TableStyle,
} from './types';
import { element, escapeXml, valEl } from './xml';

/** Namespaces declared on every generated part root. */
export const WORD_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

/** The XML declaration used for every part. */
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Relationship type URIs. */
export const REL_TYPES = {
  officeDocument: `${REL_BASE}/officeDocument`,
  styles: `${REL_BASE}/styles`,
  numbering: `${REL_BASE}/numbering`,
  settings: `${REL_BASE}/settings`,
  fontTable: `${REL_BASE}/fontTable`,
  header: `${REL_BASE}/header`,
  footer: `${REL_BASE}/footer`,
  image: `${REL_BASE}/image`,
  hyperlink: `${REL_BASE}/hyperlink`,
  coreProperties: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extendedProperties: `${REL_BASE}/extended-properties`,
  customProperties: `${REL_BASE}/custom-properties`,
} as const;

/** Content types of the generated parts. */
export const CONTENT_TYPES = {
  document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  styles: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  numbering: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  settings: 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
  fontTable: 'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml',
  header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
  footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml',
  app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  custom: 'application/vnd.openxmlformats-officedocument.custom-properties+xml',
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
} as const;

/** A relationship part builder. Ids are sequential and repeated targets reuse their id. */
export class Rels {
  private readonly entries: Array<{ id: string; type: string; target: string; external: boolean }> = [];

  /** Adds a relationship and returns its id. */
  add(type: string, target: string, external = false): string {
    const existing = this.entries.find((entry) => entry.type === type && entry.target === target && entry.external === external);
    if (existing) return existing.id;
    const id = `rId${this.entries.length + 1}`;
    this.entries.push({ id, type, target, external });
    return id;
  }

  /** Serialises the `.rels` part. */
  toXml(): string {
    const items = this.entries
      .map((entry) =>
        element('Relationship', {
          Id: entry.id,
          Type: entry.type,
          Target: entry.target,
          TargetMode: entry.external ? 'External' : undefined,
        })
      )
      .join('');
    return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
  }
}

/** Numeric ids for abstract numbering and numbering instances (Word requires integers). */
export interface NumberingMaps {
  abstract: Map<string, number>;
  instance: Map<string, number>;
}

/** Assigns numeric ids in definition order. Keys are numeric strings in practice, so order is stable. */
export function numberingMaps(numbering: NumberingDefinitions): NumberingMaps {
  const abstract = new Map<string, number>();
  Object.keys(numbering.abstract).forEach((key, index) => abstract.set(key, index + 1));
  const instance = new Map<string, number>();
  Object.keys(numbering.instances).forEach((key, index) => instance.set(key, index + 1));
  return { abstract, instance };
}

const NUMBER_FORMATS: Readonly<Record<string, string>> = {
  decimal: 'decimal',
  lowerLetter: 'lowerLetter',
  upperLetter: 'upperLetter',
  lowerRoman: 'lowerRoman',
  upperRoman: 'upperRoman',
  bullet: 'bullet',
  none: 'none',
};

/** Built-in style names Word recognises case-sensitively (for example `heading 1`). */
function styleName(style: ParagraphStyle): string {
  const heading = /^Heading (\d)$/.exec(style.name);
  if (heading) return `heading ${heading[1]}`;
  const toc = /^TOC (\d)$/.exec(style.name);
  if (toc) return `toc ${toc[1]}`;
  if (style.id === 'Caption') return 'caption';
  return style.name;
}

function basedOnXml(basedOn: string | null | undefined): string {
  return basedOn ? valEl('w:basedOn', basedOn) : '';
}

function paragraphStyleXml(style: ParagraphStyle, fonts: FontResolver): string {
  const isDefault = style.id === 'Normal';
  const open = `<w:style w:type="paragraph"${isDefault ? ' w:default="1"' : ''} w:styleId="${escapeXml(style.id)}">`;
  const inner = [
    valEl('w:name', styleName(style)),
    basedOnXml(style.basedOn),
    style.next ? valEl('w:next', style.next) : '',
    '<w:qFormat/>',
    pPr(paragraphPropsInner(style.paraProps, { outlineLevel: style.outlineLevel })),
    rPr(runPropsInner(style.runProps, fonts)),
  ].join('');
  return `${open}${inner}</w:style>`;
}

function tableStyleXml(style: TableStyle, fonts: FontResolver): string {
  const cellPadding = style.cellPaddingPt
    ? `<w:tblCellMar>${[
        ['w:top', style.cellPaddingPt.top],
        ['w:left', style.cellPaddingPt.left],
        ['w:bottom', style.cellPaddingPt.bottom],
        ['w:right', style.cellPaddingPt.right],
      ]
        .filter((entry): entry is [string, number] => entry[1] !== undefined)
        .map(([name, pt]) => element(name, { 'w:w': Math.round(pt * 20), 'w:type': 'dxa' }))
        .join('')}</w:tblCellMar>`
    : '';
  const tblPr = [style.borders ? bordersXml('w:tblBorders', style.borders) : '', cellPadding].join('');
  const conditional = Object.entries(style.conditional ?? {})
    .map(([part, value]) => {
      if (!value) return '';
      const tcPr = value.shading ? `<w:tcPr>${shadingXml(value.shading)}</w:tcPr>` : '';
      return `<w:tblStylePr w:type="${escapeXml(part)}">${rPr(runPropsInner(value.runProps, fonts))}${tcPr}</w:tblStylePr>`;
    })
    .join('');
  return (
    `<w:style w:type="table" w:styleId="${escapeXml(style.id)}">` +
    valEl('w:name', style.name) +
    basedOnXml(style.basedOn) +
    '<w:uiPriority w:val="39"/>' +
    pPr(paragraphPropsInner(style.paraProps)) +
    rPr(runPropsInner(style.runProps, fonts)) +
    (tblPr ? `<w:tblPr>${tblPr}</w:tblPr>` : '') +
    conditional +
    '</w:style>'
  );
}

/** Builds `word/styles.xml` from the IR style sheet. */
export function stylesXml(styles: StyleSheet, fonts: FontResolver): string {
  const normal = styles.paragraph.Normal;
  const docDefaults =
    '<w:docDefaults>' +
    `<w:rPrDefault>${rPr(runPropsInner(normal?.runProps, fonts))}</w:rPrDefault>` +
    `<w:pPrDefault>${pPr(paragraphPropsInner(normal?.paraProps))}</w:pPrDefault>` +
    '</w:docDefaults>';
  const paragraphs = Object.values(styles.paragraph).map((style) => paragraphStyleXml(style, fonts));
  const paragraphNames = new Set(Object.values(styles.paragraph).map((style) => style.name));
  const characters = Object.values(styles.character).map((style) => {
    // Word keys style names; a character style may not share a paragraph style's name.
    const name = paragraphNames.has(style.name) ? `${style.name} Char` : style.name;
    return (
      `<w:style w:type="character" w:styleId="${escapeXml(style.id)}">` +
      valEl('w:name', name) +
      basedOnXml(style.basedOn) +
      rPr(runPropsInner(style.runProps, fonts)) +
      '</w:style>'
    );
  });
  const tables = Object.values(styles.table).map((style) => tableStyleXml(style, fonts));
  return (
    `${XML_DECL}<w:styles ${WORD_NS}>${docDefaults}` +
    paragraphs.join('') +
    characters.join('') +
    tables.join('') +
    '</w:styles>'
  );
}

/** Builds `word/numbering.xml`: one abstractNum per definition, one num per instance. */
export function numberingXml(numbering: NumberingDefinitions, maps: NumberingMaps, fonts: FontResolver): string {
  const abstracts = Object.values(numbering.abstract)
    .map((definition) => {
      const id = maps.abstract.get(definition.id) ?? 0;
      const levels = [...definition.levels]
        .sort((a, b) => a.level - b.level)
        .map((level) => {
          const indent = level.indent
            ? `<w:pPr>${element('w:ind', {
                'w:left': Math.round(level.indent.leftPt * 20),
                'w:hanging': level.indent.hangingPt !== undefined ? Math.round(level.indent.hangingPt * 20) : undefined,
              })}</w:pPr>`
            : '';
          return (
            `<w:lvl w:ilvl="${level.level}">` +
            valEl('w:start', level.start) +
            valEl('w:numFmt', NUMBER_FORMATS[level.format] ?? 'decimal') +
            (level.paraStyleId ? valEl('w:pStyle', level.paraStyleId) : '') +
            valEl('w:lvlText', level.text) +
            valEl('w:lvlJc', 'left') +
            indent +
            rPr(runPropsInner(level.runProps, fonts)) +
            '</w:lvl>'
          );
        })
        .join('');
      return (
        `<w:abstractNum w:abstractNumId="${id}">` +
        valEl('w:multiLevelType', definition.multiLevelType) +
        (definition.name ? valEl('w:name', definition.name) : '') +
        levels +
        '</w:abstractNum>'
      );
    })
    .join('');
  const nums = Object.entries(numbering.instances)
    .map(([key, instance]) => {
      const numId = maps.instance.get(key) ?? 0;
      const abstractId = maps.abstract.get(instance.abstractId) ?? 0;
      const overrides = Object.entries(instance.overrides ?? {})
        .map(
          ([level, override]) =>
            `<w:lvlOverride w:ilvl="${Number(level)}">${
              override.startOverride !== undefined ? valEl('w:startOverride', override.startOverride) : ''
            }</w:lvlOverride>`
        )
        .join('');
      return `<w:num w:numId="${numId}">${valEl('w:abstractNumId', abstractId)}${overrides}</w:num>`;
    })
    .join('');
  return `${XML_DECL}<w:numbering ${WORD_NS}>${abstracts}${nums}</w:numbering>`;
}

/** Builds `word/settings.xml`. Fields refresh on open and track changes is off. */
export function settingsXml(evenAndOddHeaders: boolean): string {
  return (
    `${XML_DECL}<w:settings ${WORD_NS}>` +
    element('w:zoom', { 'w:percent': 100 }) +
    valEl('w:trackRevisions', '0') +
    valEl('w:defaultTabStop', 720) +
    (evenAndOddHeaders ? '<w:evenAndOddHeaders/>' : '') +
    valEl('w:characterSpacingControl', 'doNotCompress') +
    '<w:updateFields w:val="true"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    '</w:settings>'
  );
}

const FONT_FAMILIES: Readonly<Record<string, string>> = {
  Calibri: 'swiss',
  Arial: 'swiss',
  Cambria: 'roman',
  'Times New Roman': 'roman',
  'Courier New': 'modern',
};

/** Builds `word/fontTable.xml` for the fonts written by the document. */
export function fontTableXml(fonts: Set<string>): string {
  const entries = [...fonts]
    .sort()
    .map(
      (name) =>
        `<w:font w:name="${escapeXml(name)}">${valEl('w:charset', '00')}${valEl('w:family', FONT_FAMILIES[name] ?? 'swiss')}${valEl('w:pitch', 'variable')}</w:font>`
    )
    .join('');
  return `${XML_DECL}<w:fonts ${WORD_NS}>${entries}</w:fonts>`;
}

/** Builds `[Content_Types].xml`. */
export function contentTypesXml(overrides: Array<[string, string]>): string {
  const defaults: Array<[string, string]> = [
    ['rels', CONTENT_TYPES.rels],
    ['xml', 'application/xml'],
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
  ];
  const d = defaults.map(([extension, type]) => element('Default', { Extension: extension, ContentType: type })).join('');
  const o = overrides
    .map(([partName, type]) => element('Override', { PartName: partName, ContentType: type }))
    .join('');
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${d}${o}</Types>`;
}

/** Builds `_rels/.rels`. */
export function rootRelsXml(): string {
  const rels = new Rels();
  rels.add(REL_TYPES.officeDocument, 'word/document.xml');
  rels.add(REL_TYPES.coreProperties, 'docProps/core.xml');
  rels.add(REL_TYPES.extendedProperties, 'docProps/app.xml');
  rels.add(REL_TYPES.customProperties, 'docProps/custom.xml');
  return rels.toXml();
}

/** Builds `docProps/core.xml`. */
export function corePropsXml(properties: DocumentProperties, timestamp: string): string {
  const title = properties.title ? `<dc:title>${escapeXml(properties.title)}</dc:title>` : '';
  const owner = properties.owner ? escapeXml(properties.owner) : '';
  return (
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    title +
    `<dc:creator>${owner}</dc:creator>` +
    `<cp:lastModifiedBy>${owner}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(timestamp)}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(timestamp)}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

/** Builds `docProps/app.xml`. */
export function appPropsXml(): string {
  return (
    `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>BeakBlock</Application><DocSecurity>0</DocSecurity>' +
    '</Properties>'
  );
}

/** Standard document properties exposed as custom properties for DOCPROPERTY fields. */
export const DOC_PROPERTY_NAMES = ['docNumber', 'revision', 'effectiveDate', 'owner', 'lab'] as const;

/** Builds `docProps/custom.xml`. The five standard names are always present, so DOCPROPERTY never errors. */
export function customPropsXml(properties: DocumentProperties): string {
  const values = new Map<string, string>();
  for (const name of DOC_PROPERTY_NAMES) values.set(name, properties[name] ?? '');
  for (const [name, value] of Object.entries(properties.custom ?? {})) {
    if (!values.has(name)) values.set(name, value);
  }
  const items = [...values.entries()]
    .map(
      ([name, value], index) =>
        `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${escapeXml(name)}">` +
        `<vt:lpwstr>${escapeXml(value)}</vt:lpwstr></property>`
    )
    .join('');
  return (
    `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${items}</Properties>`
  );
}
