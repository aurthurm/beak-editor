import type { AIPreset, AIEntryMode } from './types';

export const BUBBLE_AI_PRESETS: AIPreset[] = [
  {
    id: 'improve-writing',
    title: 'Improve writing',
    description: 'Tighten clarity, tone, and flow.',
    prompt: 'Improve the selected text while keeping the meaning intact.',
  },
  {
    id: 'fix-grammar',
    title: 'Fix grammar',
    description: 'Correct grammar and punctuation.',
    prompt: 'Fix grammar, punctuation, and syntax in the selected text.',
  },
  {
    id: 'spelling',
    title: 'Fix spelling',
    description: 'Correct spelling errors only.',
    prompt: 'Fix spelling mistakes only and leave the style unchanged.',
  },
  {
    id: 'simplify',
    title: 'Simplify',
    description: 'Use clearer, simpler language.',
    prompt: 'Rewrite the selected text in simpler language without losing meaning.',
  },
  {
    id: 'shorter',
    title: 'Make shorter',
    description: 'Reduce length without dropping facts.',
    prompt: 'Make the selected text shorter and more concise.',
  },
  {
    id: 'longer',
    title: 'Make longer',
    description: 'Expand with useful detail.',
    prompt: 'Make the selected text longer with a bit more detail and explanation.',
  },
];

export const SLASH_AI_PRESETS: AIPreset[] = [
  {
    id: 'continue-writing',
    title: 'Continue writing',
    description: 'Keep writing from here.',
    prompt: 'Continue the document from the current cursor position in the same tone and structure.',
  },
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Create a concise summary.',
    prompt: 'Summarize the visible document context concisely.',
  },
  {
    id: 'action-items',
    title: 'Add action items',
    description: 'Extract next steps and tasks.',
    prompt: 'Extract action items from the current document context as a clear checklist.',
  },
  {
    id: 'outline',
    title: 'Outline',
    description: 'Turn the content into an outline.',
    prompt: 'Turn the current document context into a structured outline.',
  },
  {
    id: 'rewrite',
    title: 'Rewrite',
    description: 'Rewrite with a better flow.',
    prompt: 'Rewrite the current document context to improve clarity and readability.',
  },
];

export function getAIPresets(mode: AIEntryMode): AIPreset[] {
  return mode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS;
}

