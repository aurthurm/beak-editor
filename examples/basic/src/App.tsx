import { useState } from 'react';
import {
  AIModal,
  BeakBlockView,
  BubbleMenu,
  CommentModal,
  CommentRail,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  createChartBlockSpec,
  createDefaultChartData,
  useBeakBlock,
  useCustomSlashMenuItems,
  useEditorContent,
} from '@amusendame/beakblock-react';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  InMemoryCommentStore,
  blocksToMarkdown,
  createCommentPlugin,
  type Block,
} from '@amusendame/beakblock-core';
import { sampleDocument } from './data';
import { downloadBlocksAsDocx, printDocumentAsPdf } from './exportOffice';
import { sendAIRequest } from '../../shared/ai';
import './styles.css';

const customBlocks = [createChartBlockSpec()];
const commentStore = new InMemoryCommentStore();
const chartBlock: Block = {
  id: 'chart-1',
  type: 'chart',
  props: {
    data: createDefaultChartData('bar'),
  },
};

export default function App() {
  const [commentOpen, setCommentOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'bubble' | 'slash'>('bubble');

  const editor = useBeakBlock({
    initialContent: [...sampleDocument, chartBlock],
    customBlocks,
    prosemirror: {
      plugins: [createCommentPlugin(commentStore)],
    },
  });

  const blocks = useEditorContent(editor);
  const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);

  const openAiModal = (mode: 'bubble' | 'slash') => {
    setAiMode(mode);
    setAiOpen(true);
  };

  const insertChartBlock = () => {
    if (!editor || editor.isDestroyed) return;
    const chartType = editor.pm.schema.nodes.chart;
    if (!chartType) return;
    const node = chartType.create({ data: createDefaultChartData('bar') });
    editor.pm.dispatch(editor.pm.state.tr.replaceSelectionWith(node).scrollIntoView());
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">React + Vite example</p>
          <h1>React should feel as complete as Vue.</h1>
          <p>
            This demo now uses the same comment thread model, rich block set, and custom chart block pattern as the Vue showcase, but through the React bindings.
          </p>
        </div>

        <aside className="hero-panel">
          <div className="hero-stat">
            <span className="hero-stat-label">Package</span>
            <span className="hero-stat-value">@amusendame/beakblock-react</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Blocks</span>
            <span className="hero-stat-value">Comments, tables, media, chart</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Surface</span>
            <span className="hero-stat-value">Menus and rail stay anchored</span>
          </div>
        </aside>
      </header>

      <main className="layout">
        <section className="editor-stage">
          <div className="toolbar">
            <button onClick={() => editor?.toggleBold()} title="Bold (Cmd+B)" disabled={!editor}>
              <strong>B</strong>
            </button>
            <button onClick={() => editor?.toggleItalic()} title="Italic (Cmd+I)" disabled={!editor}>
              <em>I</em>
            </button>
            <button onClick={() => editor?.toggleUnderline()} title="Underline (Cmd+U)" disabled={!editor}>
              <u>U</u>
            </button>
            <button onClick={() => editor?.toggleStrikethrough()} title="Strikethrough" disabled={!editor}>
              <s>S</s>
            </button>
            <button onClick={() => editor?.toggleCode()} title="Code" disabled={!editor}>
              {'</>'}
            </button>
            <span className="separator" />
            <button onClick={() => editor?.undo()} title="Undo (Cmd+Z)" disabled={!editor}>
              ↩
            </button>
            <button onClick={() => editor?.redo()} title="Redo (Cmd+Shift+Z)" disabled={!editor}>
              ↪
            </button>
            <span className="separator" />
            <button onClick={() => setCommentOpen(true)} title="Open comments" disabled={!editor}>
              Comments
            </button>
            <button onClick={() => openAiModal('bubble')} title="Open AI assistant for selection" disabled={!editor}>
              AI Bubble
            </button>
            <button onClick={() => openAiModal('slash')} title="Open AI assistant for document context" disabled={!editor}>
              AI Slash
            </button>
            <button onClick={insertChartBlock} title="Insert chart block" disabled={!editor}>
              Chart
            </button>
            <span className="separator" />
            <button onClick={() => editor && console.log(editor.getDocument())} title="Log document to console" disabled={!editor}>
              Log JSON
            </button>
            <button onClick={() => editor && console.log(editor.pm.state)} title="Log ProseMirror state" disabled={!editor}>
              Log PM State
            </button>
            <span className="separator" />
            <button
              onClick={() => editor && console.log(blocksToMarkdown(editor.getDocument()))}
              title="Log Markdown to console"
              disabled={!editor}
            >
              Log MD
            </button>
            <button
              onClick={() => editor && void downloadBlocksAsDocx(editor.getDocument())}
              title="Download Word document"
              disabled={!editor}
            >
              .docx
            </button>
            <button onClick={() => editor && void printDocumentAsPdf(editor.getDocument())} title="Print or save as PDF" disabled={!editor}>
              PDF
            </button>
          </div>

          <CommentRail editor={editor} store={commentStore} currentUserId="amusendame">
            <div className="editor-wrapper">
              <BeakBlockView editor={editor} />
              <SlashMenu editor={editor} customItems={customSlashItems} onAI={() => openAiModal('slash')} />
              <BubbleMenu editor={editor} onComment={() => setCommentOpen(true)} onAI={() => openAiModal('bubble')} />
              <TableMenu editor={editor} />
              <TableHandles editor={editor} />
              <MediaMenu editor={editor} />
            </div>
          </CommentRail>
        </section>

        <aside className="inspector">
          <p className="section-label">Document readout</p>
          <h2>Document JSON</h2>
          <p className="inspector__lede">The serialized blocks below reflect the live React editor state without affecting the main page composition.</p>
          <pre>{JSON.stringify(blocks, null, 2)}</pre>
        </aside>
      </main>

      <footer className="footer">
        <p>
          <code>editor.pm.view</code> → EditorView | <code>editor.pm.state</code> → EditorState |{' '}
          <code>editor.pm.dispatch(tr)</code> → dispatch
        </p>
      </footer>

      <AIModal
        open={aiOpen}
        editor={editor}
        mode={aiMode}
        presets={aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS}
        title="AI assistant"
        subtitle="Wire this modal to your own API endpoint."
        onClose={() => setAiOpen(false)}
        onExecute={(request) => sendAIRequest(request, '/api/ai')}
        onApply={({ request, output }) => {
          if (!editor) return;
          const selection = request.context.selection;
          const tr =
            selection && selection.from !== selection.to
              ? editor.pm.state.tr.insertText(output, selection.from, selection.to)
              : editor.pm.state.tr.insertText(output);
          editor.pm.dispatch(tr);
        }}
      />

      <CommentModal
        open={commentOpen}
        editor={editor}
        store={commentStore}
        currentUserId="amusendame"
        title="Comments"
        subtitle="Leave threads, replies, reactions, or mark notes resolved."
        onClose={() => setCommentOpen(false)}
      />
    </div>
  );
}
