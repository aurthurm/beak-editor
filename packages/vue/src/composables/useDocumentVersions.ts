import { ref, watch, unref, type MaybeRef } from 'vue';
import type { BeakBlockEditor, DocumentVersion, VersioningAdapter } from '@amusendame/beakblock-core';

/**
 * Reactive version list + helpers. Pass the same {@link VersioningAdapter} you use in `EditorConfig.versioning.adapter`.
 */
export function useDocumentVersions(
  editor: MaybeRef<BeakBlockEditor | null>,
  adapter: VersioningAdapter
) {
  const versions = ref<DocumentVersion[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      versions.value = await adapter.listVersions();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => unref(editor),
    (ed, _prev, onCleanup) => {
      if (!ed) {
        versions.value = [];
        return;
      }
      const offSave = ed.on('versionSaved', () => void refresh());
      const offRestore = ed.on('versionRestored', () => void refresh());
      onCleanup(() => {
        offSave();
        offRestore();
      });
      void refresh();
    },
    { immediate: true }
  );

  return {
    versions,
    loading,
    error,
    refresh,
    saveVersion: (opts?: Parameters<BeakBlockEditor['saveVersion']>[0]) => {
      const ed = unref(editor);
      if (!ed) throw new Error('Editor not ready');
      return ed.saveVersion(opts);
    },
    restoreVersion: (id: string) => {
      const ed = unref(editor);
      if (!ed) throw new Error('Editor not ready');
      return ed.restoreVersion(id);
    },
  };
}
