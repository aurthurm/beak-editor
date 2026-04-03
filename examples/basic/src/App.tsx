import { useBeakBlock, BeakBlockView, useEditorContent, SlashMenu, BubbleMenu, TableHandles, MediaMenu } from '@aurthurm/beakblock-react';
import { sampleDocument } from './data';
// CSS is now auto-injected by BeakBlockEditor (injectStyles: true by default)
import './styles.css';

export default function App() {
  const editor = useBeakBlock({
    initialContent: sampleDocument,
  });

  const blocks = useEditorContent(editor);

  return (
    <div className="app">
      <header className="header">
        <h1>BeakBlock Demo</h1>
        <p>A fully open-source editor with public ProseMirror API</p>
      </header>

      <div className="container">
        <div className="editor-section">
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
            <button onClick={() => editor && console.log(editor.getDocument())} title="Log document to console" disabled={!editor}>
              Log JSON
            </button>
            <button onClick={() => editor && console.log(editor.pm.state)} title="Log ProseMirror state" disabled={!editor}>
              Log PM State
            </button>
          </div>

          <div className="editor-wrapper">
            <BeakBlockView editor={editor} />
            <SlashMenu editor={editor} />
            <BubbleMenu editor={editor} />
            <TableHandles editor={editor} />
            <MediaMenu editor={editor} />
          </div>
        </div>

        <div className="json-section">
          <h3>Document JSON</h3>
          <pre>{JSON.stringify(blocks, null, 2)}</pre>
        </div>
      </div>

      <footer className="footer">
        <p>
          <code>editor.pm.view</code> → EditorView |{' '}
          <code>editor.pm.state</code> → EditorState |{' '}
          <code>editor.pm.dispatch(tr)</code> → dispatch
        </p>
      </footer>
    </div>
  );
}
