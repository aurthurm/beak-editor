/**
 * BeakBlockView - React component that renders the BeakBlock editor
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock({
 *     initialContent: [{ type: 'paragraph', content: [] }],
 *   });
 *
 *   return (
 *     <BeakBlockView
 *       editor={editor}
 *       className="my-editor"
 *     />
 *   );
 * }
 * ```
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { BeakBlockEditor } from '@aurthurm/beakblock-core';

/**
 * Props for BeakBlockView component
 */
export interface BeakBlockViewProps {
  /**
   * The BeakBlockEditor instance to render (can be null during initialization)
   */
  editor: BeakBlockEditor | null;

  /**
   * Additional class name(s) for the container
   */
  className?: string;

  /**
   * Inline styles for the container
   */
  style?: React.CSSProperties;

  /**
   * Children to render alongside the editor (e.g., menus, toolbars)
   */
  children?: React.ReactNode;
}

/**
 * Ref handle for BeakBlockView
 */
export interface BeakBlockViewRef {
  /**
   * The container DOM element
   */
  container: HTMLDivElement | null;

  /**
   * The BeakBlockEditor instance (can be null during initialization)
   */
  editor: BeakBlockEditor | null;
}

/**
 * React component that renders the BeakBlock editor
 *
 * This component handles mounting the ProseMirror EditorView to the DOM
 * and cleaning up when unmounted.
 */
export const BeakBlockView = forwardRef<BeakBlockViewRef, BeakBlockViewProps>(
  function BeakBlockView({ editor, className, style, children }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(false);

    // Expose ref handle
    useImperativeHandle(
      ref,
      () => ({
        container: containerRef.current,
        editor,
      }),
      [editor]
    );

    // Mount editor to container
    useEffect(() => {
      const container = containerRef.current;
      if (!container || !editor || editor.isDestroyed) {
        return;
      }

      // Mount the editor view to the container
      editor.mount(container);
      mountedRef.current = true;

      // No cleanup - editor lifecycle is managed by useBeakBlock
    }, [editor]);

    return (
      <div
        ref={containerRef}
        className={className ? `beakblock-container ${className}` : 'beakblock-container'}
        style={{
          position: 'relative',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
);

BeakBlockView.displayName = 'BeakBlockView';
