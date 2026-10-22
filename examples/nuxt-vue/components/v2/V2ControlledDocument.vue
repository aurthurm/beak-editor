<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { officeBlocksExtension } from '@amusendame/beakblock-blocks-office';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import type { TemplateDefinition } from '@amusendame/beakblock-templates';
import { renderPrintToWindow } from '@amusendame/beakblock-layout';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { V2_SCENARIOS } from '~/utils/v2/demoData';
import {
  CONTROLLED_DOC_ID,
  DEMO_USERS,
  SECTION_ASSIGNMENTS,
  SECTION_TITLES,
  actorOf,
  apiPost,
  composeAndRelease,
  controlledCopyStamp,
  downloadDocx,
  fetchServerDocument,
  instantiateSop,
  policyContextFor,
  publishSopTemplate,
  registerPrint,
  type DemoUser,
  type ReleaseBundle,
  type ServerDocumentState,
} from '~/utils/v2/controlledFlow';

const scenario = V2_SCENARIOS[2]!;

const user = ref<DemoUser>(DEMO_USERS[0]!);
const actor = computed(() => actorOf(user.value));
const template = shallowRef<TemplateDefinition | null>(null);
const server = shallowRef<ServerDocumentState | null>(null);
const loadedBlocks = shallowRef<Block[]>([]);
const editorKey = ref(0);
const surface = ref<{ getEditor: () => BeakBlockEditor | null; getBlocks: () => Block[] } | null>(null);
const dirty = ref(false);
const lastSavedJson = ref('');
const busy = ref(false);
const message = ref<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);
const denials = ref<string[]>([]);
const comments = ref<Record<string, string>>({});
const bundle = shallowRef<ReleaseBundle | null>(null);
const registerLog = ref<Array<{ id: string; copyNumber: number; issuedTo: string; printedBy: string; documentHash: string; printedAt: string }>>([]);
const panel = ref<'audit' | 'security' | 'comments' | 'release'>('audit');
const releaseError = ref('');

const serverBlocks = computed<Block[]>(() => server.value?.blocks ?? []);
const sections = computed(() => serverBlocks.value.filter((b) => b.type === 'controlledSection'));
const allApproved = computed(() => sections.value.length > 0 && sections.value.every((s) => s.props.workflowState === 'approved'));
const grants = computed(() => policyContextFor(serverBlocks.value, user.value).sectionGrants);
const editableSectionIds = computed(() =>
  Object.entries(grants.value)
    .filter(([, caps]) => caps.includes('section.editText'))
    .map(([id]) => id)
);
const editableTitles = computed(() =>
  sections.value
    .filter((s) => editableSectionIds.value.includes(String(s.props.sectionId)))
    .map((s) => SECTION_TITLES[String(s.props.templateSectionId)] ?? String(s.props.title))
);

const extensions = [
  officeBlocksExtension({}),
  qmsExtension({
    getPolicyContext: () => policyContextFor(serverBlocks.value, user.value),
    onDenied: (decisions) => {
      const reason = decisions[0]?.reason ?? 'Section is read-only for this user';
      denials.value = [`${new Date().toLocaleTimeString()} · ${reason}`, ...denials.value].slice(0, 6);
    },
  }),
];

function say(tone: 'ok' | 'err' | 'info', text: string) {
  message.value = { tone, text };
}

async function reloadFromServer(rekey: boolean) {
  const state = await fetchServerDocument(CONTROLLED_DOC_ID);
  if (!state.exists) return;
  server.value = state;
  if (rekey) {
    loadedBlocks.value = structuredClone(state.blocks);
    dirty.value = false;
    editorKey.value += 1;
    await nextTick();
  }
}

function sectionOf(blocks: Block[], sectionId: string): Block | undefined {
  return blocks.find((b) => b.type === 'controlledSection' && b.props.sectionId === sectionId);
}

// Switching identity does not change the document, so nudge ProseMirror to recompute the
// section decorations (editable vs. read-only) for the new user.
watch(user, () => {
  const ed = surface.value?.getEditor();
  if (ed) ed.pm.view.dispatch(ed.pm.state.tr);
});

function onEditorReady(ed: BeakBlockEditor) {
  lastSavedJson.value = JSON.stringify(ed.getDocument());
  // Dev-only verification hook (stripped from production builds by import.meta.dev).
  if (import.meta.dev) (window as unknown as { __bbV2?: unknown }).__bbV2 = { editor: ed };
  ed.on('change', () => {
    dirty.value = JSON.stringify(ed.getDocument()) !== lastSavedJson.value;
  });
}

/* ------------------------------ Quality manager ------------------------------ */

async function publishTemplate() {
  busy.value = true;
  try {
    template.value = await publishSopTemplate();
    say('ok', `Template ${template.value.id} published as version ${template.value.version} (${template.value.sections.length} sections).`);
  } catch (error) {
    say('err', error instanceof Error ? error.message : 'Publish failed');
  } finally {
    busy.value = false;
  }
}

async function instantiate() {
  if (!template.value) return;
  busy.value = true;
  try {
    const blocks = await instantiateSop(template.value);
    const res = await apiPost({
      action: 'create',
      actor: actor.value,
      documentId: CONTROLLED_DOC_ID,
      title: 'Gram stain procedure',
      docNumber: 'SOP-0042',
      revision: '1',
      blocks,
      assignments: SECTION_ASSIGNMENTS,
    });
    if (!res.ok) throw new Error(res.data.error ?? 'Server refused to create the document');
    await reloadFromServer(true);
    say('ok', 'Document instantiated with four controlled sections and stored on the server (version 1).');
  } catch (error) {
    say('err', error instanceof Error ? error.message : 'Instantiate failed');
  } finally {
    busy.value = false;
  }
}

async function resetDemo() {
  await apiPost({ action: 'reset', actor: actor.value, documentId: CONTROLLED_DOC_ID });
  server.value = null;
  bundle.value = null;
  loadedBlocks.value = [];
  denials.value = [];
  registerLog.value = [];
  editorKey.value += 1;
  say('info', 'Demo reset. Publish the template again to start over.');
}

/* ------------------------------ Authors ------------------------------ */

async function saveDraft() {
  const edited = surface.value?.getBlocks();
  if (!server.value || !edited) return;
  // The editor round-trip is not byte-identical (e.g. placeholder flags and default textAlign), so sections
  // this user cannot edit are sent back exactly as stored. Only the user's own sections carry editor output.
  const allowed = new Set(editableSectionIds.value);
  const blocks = edited.map((b) => {
    if (b.type !== 'controlledSection' || allowed.has(String(b.props.sectionId))) return b;
    return sectionOf(server.value!.blocks, String(b.props.sectionId)) ?? b;
  });
  busy.value = true;
  try {
    const res = await apiPost({
      action: 'save',
      actor: actor.value,
      documentId: CONTROLLED_DOC_ID,
      baseVersion: server.value.version,
      blocks,
    });
    if (res.ok) {
      await reloadFromServer(false);
      lastSavedJson.value = JSON.stringify(surface.value?.getBlocks() ?? []);
      dirty.value = false;
      say('ok', `Saved as version ${res.data.version as number}. Verified by the server against the stored document.`);
    } else {
      const first = res.data.violations?.[0];
      say('err', first ? `Server refused the save (${res.status}): ${first.reason}` : `Server refused the save (${res.status}): ${res.data.error ?? 'error'}`);
      await reloadFromServer(false);
    }
  } finally {
    busy.value = false;
  }
}

/* ------------------------------ Lifecycle ------------------------------ */

function canDo(sectionId: string, event: 'submit' | 'review' | 'requestChanges' | 'approve' | 'reopen'): boolean {
  const s = sectionOf(serverBlocks.value, sectionId);
  if (!s) return false;
  const state = String(s.props.workflowState);
  const owner = server.value?.assignments[String(s.props.templateSectionId)]?.ownerId;
  switch (event) {
    case 'submit':
      return owner === user.value.id && (state === 'draft' || state === 'reopened');
    case 'review':
      return user.value.roles.includes('reviewer') && state === 'submitted';
    case 'requestChanges':
      return user.value.roles.includes('reviewer') && state === 'reviewed';
    case 'approve':
      return user.value.roles.includes('approver') && state === 'reviewed';
    case 'reopen':
      return user.value.roles.includes('approver') && state === 'approved';
  }
}

async function transition(sectionId: string, event: 'submit' | 'review' | 'requestChanges' | 'approve' | 'reopen') {
  if (dirty.value) {
    say('err', 'Save your changes before changing a section state.');
    return;
  }
  const note = comments.value[sectionId]?.trim() ?? '';
  if (event === 'requestChanges' && !note) {
    say('err', 'Write the requested change in the comment box for this section first.');
    return;
  }
  busy.value = true;
  try {
    const res = await apiPost({ action: 'transition', actor: actor.value, documentId: CONTROLLED_DOC_ID, sectionId, event, comment: note || undefined });
    if (!res.ok) {
      say('err', `${SECTION_TITLES[String(sectionOf(serverBlocks.value, sectionId)?.props.templateSectionId)] ?? 'Section'}: ${res.data.error ?? 'rejected'}`);
      return;
    }
    if (event === 'requestChanges' || event === 'review' || event === 'approve' || event === 'submit' || event === 'reopen') {
      comments.value[sectionId] = '';
    }
    await reloadFromServer(true);
    say('ok', `Section ${event === 'requestChanges' ? 'sent back with requested changes' : `moved by "${event}"`}.`);
  } finally {
    busy.value = false;
  }
}

async function addComment(sectionId: string) {
  const body = comments.value[sectionId]?.trim();
  if (!body) return;
  const res = await apiPost({ action: 'comment', actor: actor.value, documentId: CONTROLLED_DOC_ID, sectionId, body });
  if (!res.ok) {
    say('err', res.data.error ?? 'Comment rejected');
    return;
  }
  comments.value[sectionId] = '';
  await reloadFromServer(false);
  say('ok', 'Comment added to the section thread.');
}

/* ------------------------------ Malicious client ------------------------------ */

function tamperedCopy(kind: 'foreign' | 'approved' | 'stale') {
  const base = structuredClone(serverBlocks.value);
  const target = base.find((s) => {
    if (s.type !== 'controlledSection') return false;
    if (kind === 'approved') return s.props.workflowState === 'approved';
    const owner = server.value?.assignments[String(s.props.templateSectionId)]?.ownerId;
    return owner !== user.value.id;
  });
  if (!target) return null;
  const para = target.children?.find((c) => c.type === 'paragraph');
  if (para) {
    para.content = [{ type: 'text', text: 'Everything is compliant. Sign here.', styles: {} }];
  } else {
    target.children = [
      { id: `forged-${Date.now().toString(36)}`, type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Forged content', styles: {} }] },
    ];
  }
  return { blocks: base, sectionId: String(target.props.sectionId), title: SECTION_TITLES[String(target.props.templateSectionId)] ?? '' };
}

async function maliciousClient(kind: 'foreign' | 'approved' | 'stale') {
  if (!server.value) return;
  const tampered = tamperedCopy(kind);
  if (!tampered) {
    say('info', kind === 'approved' ? 'No approved section yet. Approve a section first, then try again.' : 'No foreign section to tamper with for this user.');
    return;
  }
  const baseVersion = kind === 'stale' ? server.value.version - 1 : server.value.version;
  // Bypasses the editor entirely: a direct POST with arbitrary blocks, the same as any hostile client.
  const res = await apiPost({
    action: 'save',
    actor: actor.value,
    documentId: CONTROLLED_DOC_ID,
    baseVersion,
    blocks: tampered.blocks,
  });
  if (res.ok) {
    say('err', 'UNEXPECTED: the server accepted the tampered change. This is a security defect.');
  } else {
    const first = res.data.violations?.[0];
    say(
      'ok',
      `Server rejected the malicious request (HTTP ${res.status}): ${first ? `${first.kind} on "${tampered.title}": ${first.reason}` : res.data.error}`
    );
  }
  await reloadFromServer(false);
}

/* ------------------------------ Release ------------------------------ */

async function releaseDocument() {
  if (!server.value || !allApproved.value) return;
  busy.value = true;
  releaseError.value = '';
  try {
    // A reload after release must still compose the bundle, so the server release is only requested once.
    if (!server.value.release) {
      const res = await apiPost({ action: 'release', actor: actor.value, documentId: CONTROLLED_DOC_ID });
      if (!res.ok) {
        releaseError.value = res.data.error ?? 'Release refused';
        return;
      }
      await reloadFromServer(false);
    }
    if (!template.value) template.value = await publishSopTemplate();
    if (!server.value) return;
    bundle.value = await composeAndRelease({
      template: template.value,
      serverDoc: server.value,
      approver: actor.value,
      documentRevision: '1',
    });
    panel.value = 'release';
    say('ok', `Released. Server and client manifests reference the same section hashes; rendition verified: ${bundle.value.verification.ok}.`);
  } catch (error) {
    releaseError.value = error instanceof Error ? error.message : 'Composition failed';
  } finally {
    busy.value = false;
  }
}

function printControlledCopy() {
  if (!bundle.value) return;
  const copyNumber = registerLog.value.length + 1;
  const stamp = controlledCopyStamp(copyNumber, 'Microbiology bench', 'CONTROLLED');
  const entry = registerPrint(bundle.value.released, stamp, actor.value.userId);
  registerLog.value = [
    { id: entry.id, copyNumber: entry.copyNumber, issuedTo: entry.issuedTo, printedBy: entry.printedBy, documentHash: entry.documentHash, printedAt: entry.printedAt },
    ...registerLog.value,
  ];
  renderPrintToWindow(bundle.value.printHtml);
}

async function exportDocxFile() {
  if (!bundle.value) return;
  await downloadDocx(bundle.value.composed, 'SOP-0042-rev1-controlled.docx');
}

const stateLabel: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  approved: 'Approved',
  reopened: 'Changes requested',
};

onMounted(async () => {
  await reloadFromServer(true);
  // The template is client state; republish the identical pure definition so composition works after a reload.
  if (server.value?.exists && !template.value) template.value = await publishSopTemplate();
});
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <button type="button" class="v2-btn v2-btn--ghost" @click="resetDemo">Reset demo</button>
    </V2ScenarioHeader>

    <div class="cd">
      <aside class="cd__side" aria-label="Controlled document controls">
        <section class="cd__card">
          <p class="cd__label">Acting as</p>
          <div class="cd__users" role="radiogroup" aria-label="Demo identity">
            <button
              v-for="u in DEMO_USERS"
              :key="u.id"
              type="button"
              class="cd__user"
              role="radio"
              :aria-checked="user.id === u.id"
              :class="{ 'cd__user--on': user.id === u.id }"
              @click="user = u"
            >
              {{ u.name }}
            </button>
          </div>
          <p class="cd__hint">{{ user.hint }}</p>
          <p class="cd__hint">
            Can edit: <strong>{{ editableTitles.length ? editableTitles.join(', ') : 'nothing (read-only)' }}</strong>
          </p>
        </section>

        <section class="cd__card">
          <p class="cd__label">1 · Template and instance</p>
          <p class="cd__hint">
            Template: <strong>{{ template ? `${template.id} v${template.version} (${template.status})` : 'not published' }}</strong>
          </p>
          <div class="cd__row">
            <button type="button" class="v2-btn" :disabled="busy || user.id !== 'qm' || !!template" @click="publishTemplate">Publish template</button>
            <button type="button" class="v2-btn" :disabled="busy || user.id !== 'qm' || !template || !!server?.exists" @click="instantiate">
              Instantiate document
            </button>
          </div>
          <p v-if="server?.exists" class="cd__hint">
            Server document <code>{{ server.docNumber }}</code> · version {{ server.version }} · hash {{ server.documentHash.slice(0, 12) }}…
          </p>
        </section>

        <section class="cd__card">
          <p class="cd__label">2 · Sections and lifecycle</p>
          <ul v-if="sections.length" class="cd__sections">
            <li v-for="s in sections" :key="String(s.props.sectionId)" class="cd__section">
              <div class="cd__section-head">
                <strong>{{ SECTION_TITLES[String(s.props.templateSectionId)] }}</strong>
                <span class="cd__badge" :data-state="String(s.props.workflowState)">{{ stateLabel[String(s.props.workflowState)] ?? 'Draft' }}</span>
              </div>
              <p class="cd__hint">
                Owner {{ server?.assignments[String(s.props.templateSectionId)]?.ownerName }}
                <span v-if="s.props.locked"> · locked (approved)</span>
              </p>
              <div class="cd__row cd__row--wrap">
                <button v-if="canDo(String(s.props.sectionId), 'submit')" type="button" class="v2-btn v2-btn--small" :disabled="busy" @click="transition(String(s.props.sectionId), 'submit')">Submit</button>
                <button v-if="canDo(String(s.props.sectionId), 'review')" type="button" class="v2-btn v2-btn--small" :disabled="busy" @click="transition(String(s.props.sectionId), 'review')">Start review</button>
                <button v-if="canDo(String(s.props.sectionId), 'requestChanges')" type="button" class="v2-btn v2-btn--small v2-btn--warn" :disabled="busy" @click="transition(String(s.props.sectionId), 'requestChanges')">Request changes</button>
                <button v-if="canDo(String(s.props.sectionId), 'approve')" type="button" class="v2-btn v2-btn--small v2-btn--ok" :disabled="busy" @click="transition(String(s.props.sectionId), 'approve')">Approve</button>
                <button v-if="canDo(String(s.props.sectionId), 'reopen')" type="button" class="v2-btn v2-btn--small" :disabled="busy" @click="transition(String(s.props.sectionId), 'reopen')">Reopen</button>
              </div>
              <div v-if="user.roles.includes('reviewer') || user.roles.includes('approver')" class="cd__comment">
                <label class="cd__hint" :for="`cm-${s.props.sectionId}`">Comment or requested change</label>
                <textarea :id="`cm-${s.props.sectionId}`" v-model="comments[String(s.props.sectionId)]" rows="2" class="cd__textarea" />
                <button type="button" class="v2-btn v2-btn--small" :disabled="busy || !comments[String(s.props.sectionId)]?.trim()" @click="addComment(String(s.props.sectionId))">Add comment</button>
              </div>
            </li>
          </ul>
          <p v-else class="cd__hint">Sections appear after instantiation.</p>
        </section>

        <section class="cd__card cd__card--warn">
          <p class="cd__label">Malicious client test</p>
          <p class="cd__hint">These buttons skip the editor and POST crafted blocks straight to the server.</p>
          <div class="cd__row cd__row--wrap">
            <button type="button" class="v2-btn v2-btn--small v2-btn--danger" :disabled="busy || !server?.exists" @click="maliciousClient('foreign')">Edit another author's section</button>
            <button type="button" class="v2-btn v2-btn--small v2-btn--danger" :disabled="busy || !server?.exists" @click="maliciousClient('approved')">Edit an approved section</button>
            <button type="button" class="v2-btn v2-btn--small v2-btn--danger" :disabled="busy || !server?.exists" @click="maliciousClient('stale')">Replay a stale update</button>
          </div>
        </section>
      </aside>

      <section class="cd__main">
        <div v-if="server?.exists" class="cd__savebar">
          <span :class="['cd__dirty', dirty ? 'cd__dirty--on' : '']">{{ dirty ? 'Unsaved changes' : 'All changes saved' }}</span>
          <button type="button" class="v2-btn v2-btn--primary" :disabled="busy || !dirty" @click="saveDraft">Save to server</button>
          <span class="cd__hint">The server verifies every save against the stored document and the policy.</span>
        </div>
        <p v-if="message" class="cd__msg" :data-tone="message.tone" role="status">{{ message.text }}</p>
        <div v-if="denials.length" class="cd__denials" aria-live="polite">
          <p class="cd__label">Editor guard (UX layer)</p>
          <p v-for="d in denials" :key="d" class="cd__hint">{{ d }}</p>
        </div>

        <div v-if="server?.exists" class="cd__editor">
          <V2OfficeSurface
            :key="editorKey"
            ref="surface"
            :blocks="loadedBlocks"
            mode="controlled"
            :extensions="extensions"
            :navigation="false"
            :show-rulers="true"
            label="Controlled SOP"
            @ready="onEditorReady"
          />
        </div>
        <div v-else class="cd__empty">
          <p>Publish the template and instantiate the document to begin.</p>
          <p class="cd__hint">Start as the Quality Manager (first identity).</p>
        </div>

        <section v-if="server?.exists" class="cd__panel">
          <nav class="cd__tabs" role="tablist" aria-label="Document records">
            <button v-for="t in (['audit', 'security', 'comments', 'release'] as const)" :key="t" type="button" role="tab" class="cd__tab" :aria-selected="panel === t" @click="panel = t">
              {{ t === 'audit' ? 'Audit trail' : t === 'security' ? 'Server security log' : t === 'comments' ? 'Comments' : 'Composition and release' }}
            </button>
          </nav>

          <ol v-if="panel === 'audit'" class="cd__list">
            <li v-for="(a, i) in server.audit" :key="i">
              <code>{{ a.at.slice(11, 19) }}</code> {{ a.actor.displayName ?? a.actor.userId }} · {{ SECTION_TITLES[String(sections.find((s) => s.props.sectionId === a.sectionId)?.props.templateSectionId)] ?? a.sectionId }} · <strong>{{ a.event }}</strong> {{ a.from }} to {{ a.to }}
              <span v-if="a.comment">· “{{ a.comment }}”</span>
            </li>
            <li v-if="!server.audit.length" class="cd__hint">No transitions yet.</li>
          </ol>

          <ol v-else-if="panel === 'security'" class="cd__list">
            <li v-for="(e, i) in server.security" :key="i">
              <span class="cd__outcome" :data-outcome="e.outcome">{{ e.outcome }}</span>
              <code>{{ e.at.slice(11, 19) }}</code> {{ e.actorId }} · {{ e.action }} · {{ e.reason }}
            </li>
          </ol>

          <ul v-else-if="panel === 'comments'" class="cd__list">
            <li v-for="c in server.comments" :key="c.id">
              <strong>{{ c.authorName }}</strong> on {{ SECTION_TITLES[String(sections.find((s) => s.props.sectionId === c.sectionId)?.props.templateSectionId)] ?? c.sectionId }}: {{ c.body }}
            </li>
            <li v-if="!server.comments.length" class="cd__hint">No comments yet. Reviewers and approvers can comment on a section.</li>
          </ul>

          <div v-else class="cd__release">
            <div class="cd__row">
              <button type="button" class="v2-btn v2-btn--primary" :disabled="busy || !allApproved || (!!server.release && !!bundle) || user.id !== 'ap'" @click="releaseDocument">
                Compose and release
              </button>
              <span class="cd__hint">
                {{ !allApproved ? 'Every section must be approved first.' : user.id !== 'ap' ? 'Only the final approver can release.' : server.release && !bundle ? 'Released on the server; compose the controlled copy.' : server.release ? 'Released (immutable).' : 'Ready for release.' }}
              </span>
            </div>
            <p v-if="releaseError" class="cd__msg" data-tone="err">{{ releaseError }}</p>
            <template v-if="bundle">
              <div class="cd__row cd__row--wrap">
                <button type="button" class="v2-btn" @click="printControlledCopy">Print / PDF (controlled copy)</button>
                <button type="button" class="v2-btn" @click="exportDocxFile">Download DOCX</button>
                <span class="cd__hint">Rendition verified: <strong>{{ bundle.verification.ok ? 'yes' : 'no' }}</strong></span>
              </div>
              <p class="cd__label">Release manifest (sha256)</p>
              <pre class="cd__pre">{{ JSON.stringify({ documentHash: bundle.released.documentHash, renditionHash: bundle.released.renditionHash, sections: bundle.released.sections.map((s) => ({ sectionId: s.sectionId, templateSectionId: s.templateSectionId, contentHash: s.contentHash, revision: s.revision })), signatures: bundle.released.signatures }, null, 2) }}</pre>
              <p class="cd__label">Print register</p>
              <ul class="cd__list">
                <li v-for="r in registerLog" :key="r.id">Copy {{ r.copyNumber }} issued to {{ r.issuedTo }} by {{ r.printedBy }} · hash {{ r.documentHash.slice(0, 12) }}…</li>
                <li v-if="!registerLog.length" class="cd__hint">No controlled copies printed yet.</li>
              </ul>
            </template>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cd {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.cd__side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cd__card {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
}
.cd__card--warn {
  border-color: #e7b9b4;
  background: #fff8f7;
}
.cd__label {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5b5752;
  font-weight: 600;
}
.cd__hint {
  margin: 4px 0;
  font-size: 12px;
  color: #5b5752;
  line-height: 1.45;
}
.cd__users {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cd__user {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cd__user--on {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.cd__row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
.cd__row--wrap {
  flex-wrap: wrap;
}
.cd__sections {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cd__section {
  border-top: 1px solid #ece9e3;
  padding-top: 8px;
}
.cd__section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.cd__badge {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
  background: #eef0f3;
  color: #3b3935;
}
.cd__badge[data-state='submitted'] {
  background: #fff4d6;
}
.cd__badge[data-state='reviewed'] {
  background: #e4edff;
}
.cd__badge[data-state='approved'] {
  background: #dff3e4;
  color: #1e5f2d;
}
.cd__badge[data-state='reopened'] {
  background: #fde3df;
  color: #8a2a1e;
}
.cd__comment {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.cd__textarea {
  font: inherit;
  font-size: 12px;
  border: 1px solid #c9c4bb;
  border-radius: 6px;
  padding: 4px 6px;
  resize: vertical;
}
.cd__main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.cd__savebar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.cd__dirty {
  font-size: 12px;
  color: #1e7b34;
}
.cd__dirty--on {
  color: #8a5a00;
  font-weight: 600;
}
.cd__msg {
  margin: 0;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #eef5ff;
}
.cd__msg[data-tone='ok'] {
  background: #e9f7ee;
  color: #155b2a;
}
.cd__msg[data-tone='err'] {
  background: #fdecea;
  color: #8a2a1e;
}
.cd__denials {
  border: 1px dashed #c9c4bb;
  border-radius: 6px;
  padding: 6px 10px;
  background: #fafaf8;
}
.cd__editor {
  min-width: 0;
}
.cd__empty {
  border: 1px dashed #c9c4bb;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  color: #4a4642;
}
.cd__panel {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}
.cd__tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid #ece9e3;
  margin-bottom: 8px;
}
.cd__tab {
  border: 0;
  background: transparent;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.cd__tab[aria-selected='true'] {
  border-bottom-color: #2b579a;
  color: #2b579a;
  font-weight: 600;
}
.cd__list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
}
.cd__outcome {
  display: inline-block;
  min-width: 56px;
  font-size: 11px;
  border-radius: 4px;
  padding: 0 6px;
  margin-right: 6px;
  text-align: center;
  background: #eef0f3;
}
.cd__outcome[data-outcome='allowed'] {
  background: #dff3e4;
}
.cd__outcome[data-outcome='denied'] {
  background: #fdecea;
  color: #8a2a1e;
}
.cd__outcome[data-outcome='stale'] {
  background: #fff4d6;
}
.cd__release {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cd__pre {
  font-size: 11px;
  background: #f6f5f2;
  border-radius: 6px;
  padding: 8px;
  overflow: auto;
  max-height: 260px;
  margin: 0;
}
.v2-btn {
  border: 1px solid #b9b3a9;
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.v2-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.v2-btn--small {
  padding: 3px 8px;
  font-size: 12px;
}
.v2-btn--primary {
  background: #2b579a;
  border-color: #2b579a;
  color: #fff;
}
.v2-btn--ok {
  background: #e9f7ee;
  border-color: #8cc79b;
}
.v2-btn--warn {
  background: #fff4d6;
  border-color: #e0c270;
}
.v2-btn--danger {
  background: #fdecea;
  border-color: #e7a79f;
  color: #8a2a1e;
}
.v2-btn--ghost {
  background: transparent;
}
@media (max-width: 1100px) {
  .cd {
    grid-template-columns: 1fr;
  }
}
</style>
