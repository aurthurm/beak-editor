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

export type AIDocumentContext = {
  blocks: Block[];
  markdown: string;
};

export type AIContext = {
  mode: AIEntryMode;
  preset?: AIPreset | null;
  instruction: string;
  selection?: AISelectionContext | null;
  document: AIDocumentContext;
};

export type AIRequest = {
  mode: AIEntryMode;
  preset: AIPreset | null;
  instruction: string;
  context: AIContext;
};
