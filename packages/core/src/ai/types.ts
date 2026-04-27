import type { Block } from '../blocks';

export type AIEntryMode = 'bubble' | 'slash';

export type AIPreset = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export type AISelectionContext = {
  from: number;
  to: number;
  text: string;
  blocks: Block[];
  markdown: string;
};

export type AICursorContext = {
  from: number;
  to: number;
  blockStart: number;
  blockEnd: number;
  blockId: string | null;
  blockType: string;
  block: Block | null;
  markdown: string;
};

export type AIDocumentContext = {
  blocks: Block[];
  markdown: string;
};

export type AISchemaNodeSummary = {
  name: string;
  group: string | null;
  content: string | null;
  attrs: string[];
  atom: boolean;
  inline: boolean;
};

export type AISchemaContext = {
  blockNodes: AISchemaNodeSummary[];
  inlineNodes: AISchemaNodeSummary[];
};

export type AIContext = {
  mode: AIEntryMode;
  preset?: AIPreset | null;
  instruction: string;
  selection?: AISelectionContext | null;
  cursor: AICursorContext;
  document: AIDocumentContext;
  schema: AISchemaContext;
};

export type AIRequest = {
  mode: AIEntryMode;
  preset: AIPreset | null;
  instruction: string;
  context: AIContext;
};
