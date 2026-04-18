import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type AIPreset,
  type AIContext,
  type AIEntryMode,
  buildAIContext,
  type BeakBlockEditor,
} from '@amusendame/beakblock-core';

type ChatMessage = { role: 'user' | 'assistant'; content: string; pending?: boolean };

type AIRequestPayload = {
  mode: AIEntryMode;
  preset: AIPreset | null;
  instruction: string;
  context: AIContext;
};

type AIStatus = 'idle' | 'working' | 'ready' | 'applying';

export interface AIModalProps {
  open: boolean;
  editor: BeakBlockEditor | null;
  mode: AIEntryMode;
  presets: AIPreset[];
  title?: string;
  subtitle?: string;
  /** When true, shows selection + document context (for debugging or power users). Hidden by default. */
  showContext?: boolean;
  onClose: () => void;
  onExecute?: (request: AIRequestPayload) => Promise<string | void> | string | void;
  onApply?: (request: AIRequestPayload & { output: string }) => Promise<void> | void;
}

function getPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.body;
}

function busyLabel(status: AIStatus): string {
  if (status === 'applying') return 'Applying to your document…';
  return 'Generating a response…';
}

export function AIModal({
  open,
  editor,
  mode,
  presets,
  title,
  subtitle,
  showContext = false,
  onClose,
  onExecute,
  onApply,
}: AIModalProps): React.ReactElement | null {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id ?? '');
  const [instruction, setInstruction] = useState(presets[0]?.prompt ?? '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [output, setOutput] = useState('');
  const [request, setRequest] = useState<AIRequestPayload | null>(null);
  const [applied, setApplied] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(false);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  useEffect(() => {
    if (!open) return;
    const firstPreset = presets[0] ?? null;
    setSelectedPresetId(firstPreset?.id ?? '');
    setInstruction(firstPreset?.prompt ?? '');
    setMessages([]);
    setStatus('idle');
    setOutput('');
    setRequest(null);
    setApplied(false);
    setPromptCollapsed(false);
  }, [open, mode, presets]);

  useEffect(() => {
    if (status === 'ready' && output) {
      setPromptCollapsed(true);
    }
  }, [status, output]);

  useEffect(() => {
    if (!selectedPreset) return;
    setInstruction((current) => current || selectedPreset.prompt);
  }, [selectedPreset]);

  if (!open) return null;
  const portalTarget = getPortalTarget();
  if (!portalTarget) return null;

  const context = editor ? buildAIContext(editor, mode, selectedPreset, instruction) : null;
  const isBusy = status === 'working' || status === 'applying';
  const hasChat = messages.length > 0;
  const resultsFocus = status === 'ready' && !!output && hasChat;
  const showBusyOverlay = status === 'working' || status === 'applying';
  const collapsedPromptPreview = request?.instruction ?? instruction;

  const pushWorkingMessage = (prompt: string) => {
    setMessages((current) => [
      ...current,
      { role: 'user', content: prompt },
      { role: 'assistant', content: 'BeakBlock AI is thinking…', pending: true },
    ]);
  };

  const replacePendingMessage = (content: string) => {
    setMessages((current) =>
      current.map((message, index) => {
        if (index !== current.length - 1 || !message.pending) return message;
        return { role: 'assistant', content };
      })
    );
  };

  const submit = async () => {
    if (!editor || !instruction.trim() || isBusy) return;
    const prompt = instruction.trim();
    const payload: AIRequestPayload = {
      mode,
      preset: selectedPreset,
      instruction: prompt,
      context: context ?? buildAIContext(editor, mode, selectedPreset, prompt),
    };

    setStatus('working');
    setOutput('');
    setRequest(payload);
    setApplied(false);
    pushWorkingMessage(prompt);

    try {
      const response = await onExecute?.(payload);
      const assistant =
        typeof response === 'string'
          ? response
          : `Connected to BeakBlock context: ${payload.context.selection?.text || payload.context.document.markdown.slice(0, 220) || 'document snapshot'}`;
      setOutput(assistant);
      replacePendingMessage(assistant);
      setStatus('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      setOutput(message);
      replacePendingMessage(`Error: ${message}`);
      setStatus('ready');
    }
  };

  const applyResult = async () => {
    if (!request || !output || !onApply || isBusy || applied) return;
    setStatus('applying');
    try {
      await onApply({ ...request, output });
      setApplied(true);
      setMessages((current) => [...current, { role: 'assistant', content: 'Output applied to the document.' }]);
    } finally {
      setStatus('ready');
    }
  };

  const bodyBlock = (
    <div className="beakblock-ai-modal__body">
      <section className="beakblock-ai-modal__presets">
        <div className="beakblock-modal-section-title">Quick prompts</div>
        <div className="beakblock-ai-modal__preset-grid">
          {presets.map((preset) => {
            const active = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                className={`beakblock-ai-modal__preset ${active ? 'beakblock-ai-modal__preset--active' : ''}`}
                disabled={isBusy}
                onClick={() => {
                  setSelectedPresetId(preset.id);
                  setInstruction(preset.prompt);
                  setStatus('idle');
                  setOutput('');
                  setRequest(null);
                  setApplied(false);
                  setPromptCollapsed(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
              >
                <span className="beakblock-ai-modal__preset-title">{preset.title}</span>
                <span className="beakblock-ai-modal__preset-description">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="beakblock-ai-modal__composer">
        <div className="beakblock-modal-section-title">Prompt</div>
        <textarea
          className="beakblock-ai-modal__textarea"
          value={instruction}
          disabled={isBusy}
          onChange={(event) => {
            setInstruction(event.target.value);
            if (status !== 'idle') {
              setStatus('idle');
              setOutput('');
              setRequest(null);
              setApplied(false);
              setPromptCollapsed(false);
            }
          }}
          placeholder={
            mode === 'bubble'
              ? 'Tell BeakBlock how to rewrite the selection...'
              : 'Ask BeakBlock to continue, summarize, or restructure the document...'
          }
        />

        {showContext ? (
          <div className="beakblock-ai-modal__context">
            <div className="beakblock-modal-section-title">Context</div>
            <div className="beakblock-ai-modal__context-card">
              <strong>Selected text</strong>
              <p>{context?.selection?.text || 'No selection captured.'}</p>
            </div>
            <details className="beakblock-ai-modal__details">
              <summary>Document snapshot</summary>
              <pre>{context?.document.markdown || ''}</pre>
            </details>
          </div>
        ) : null}
      </section>
    </div>
  );

  const promptCollapsedBar =
    promptCollapsed && resultsFocus ? (
      <div className="beakblock-ai-modal__prompt-collapsed">
        <div className="beakblock-ai-modal__prompt-collapsed-inner">
          <span className="beakblock-ai-modal__prompt-collapsed-label">Prompt used</span>
          <p className="beakblock-ai-modal__prompt-collapsed-text">{collapsedPromptPreview}</p>
        </div>
        <button
          type="button"
          className="beakblock-modal-secondary beakblock-ai-modal__prompt-collapsed-edit"
          onClick={() => setPromptCollapsed(false)}
        >
          Edit prompt
        </button>
      </div>
    ) : null;

  const chatSection = hasChat ? (
    <div className={`beakblock-ai-modal__chat ${resultsFocus ? 'beakblock-ai-modal__chat--prominent' : ''}`}>
      <div className="beakblock-ai-modal__chat-head">
        <div className="beakblock-modal-section-title">AI response</div>
        <p className="beakblock-ai-modal__chat-lede">What the model produced for your prompt.</p>
      </div>
      <div className="beakblock-ai-modal__messages">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`beakblock-ai-modal__message beakblock-ai-modal__message--${message.role} ${message.pending ? 'beakblock-ai-modal__message--pending' : ''}`}
          >
            <span className="beakblock-ai-modal__message-role">
              {message.role === 'user' ? 'Your prompt' : 'Assistant'}
            </span>
            <div className="beakblock-ai-modal__message-body">{message.content}</div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const busyOverlay = showBusyOverlay ? (
    <div className="beakblock-ai-modal__busy-overlay" aria-live="polite" aria-busy="true">
      <div className="beakblock-ai-modal__busy-spinner" aria-hidden="true" />
      <p className="beakblock-ai-modal__busy-label">{busyLabel(status)}</p>
    </div>
  ) : null;

  return createPortal(
    <div className="beakblock-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className={`beakblock-ai-modal${resultsFocus ? ' beakblock-ai-modal--results-focus' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-busy={status === 'working' || status === 'applying'}
        aria-label={title || (mode === 'bubble' ? 'AI writing assistant' : 'AI chat assistant')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="beakblock-modal-header">
          <div>
            <div className="beakblock-modal-kicker">{mode === 'bubble' ? 'Selection AI' : 'Document AI'}</div>
            <h2>{title || (mode === 'bubble' ? 'Edit with AI' : 'AI chat')}</h2>
            <p>
              {subtitle ||
                (mode === 'bubble'
                  ? 'Rewrite the selected text with a focused prompt.'
                  : 'Continue from the current document context with a guided prompt.')}
            </p>
          </div>
          <button type="button" className="beakblock-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="beakblock-ai-modal__main">
          {promptCollapsedBar ?? bodyBlock}
          {chatSection}
          {busyOverlay}
        </div>

        <div className="beakblock-modal-footer">
          <div className="beakblock-ai-modal__result-actions">
            {!showBusyOverlay && status === 'ready' && output ? (
              <span className="beakblock-ai-modal__result-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" strokeWidth="2" />
                </svg>
                Ready to apply
              </span>
            ) : null}
          </div>

          <button type="button" className="beakblock-modal-secondary" onClick={onClose}>
            {status === 'applying' ? 'Applying…' : status === 'ready' && applied ? 'Close' : 'Cancel'}
          </button>
          {status === 'ready' && output && onApply ? (
            <button type="button" className="beakblock-modal-primary" onClick={applyResult} disabled={isBusy || applied}>
              {applied ? 'Applied' : 'Apply result'}
            </button>
          ) : (
            <button type="button" className="beakblock-modal-primary" onClick={submit} disabled={isBusy || !instruction.trim()}>
              {status === 'working' ? 'Working…' : 'Run prompt'}
            </button>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
