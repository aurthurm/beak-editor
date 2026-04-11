import { useCallback, useEffect, useState } from 'react';
import type { BeakBlockEditor, DocumentVersion, VersioningAdapter } from '@aurthurm/beakblock-core';

/**
 * Version list + helpers. Pass the same {@link VersioningAdapter} you use in `EditorConfig.versioning.adapter`.
 */
export function useDocumentVersions(editor: BeakBlockEditor | null, adapter: VersioningAdapter) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVersions(await adapter.listVersions());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    if (!editor) {
      setVersions([]);
      return;
    }
    void refresh();
    const offSave = editor.on('versionSaved', () => void refresh());
    const offRestore = editor.on('versionRestored', () => void refresh());
    return () => {
      offSave();
      offRestore();
    };
  }, [editor, refresh]);

  const saveVersion = useCallback(
    (opts?: Parameters<BeakBlockEditor['saveVersion']>[0]) => {
      if (!editor) throw new Error('Editor not ready');
      return editor.saveVersion(opts);
    },
    [editor]
  );

  const restoreVersion = useCallback(
    (id: string) => {
      if (!editor) throw new Error('Editor not ready');
      return editor.restoreVersion(id);
    },
    [editor]
  );

  return { versions, loading, error, refresh, saveVersion, restoreVersion };
}
