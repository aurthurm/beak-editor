<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { reviewExtension, InMemoryRevisionStore, InMemoryCommentThreadStore, acceptRevision, rejectRevision, acceptAll, rejectAll, compareRevisions, renderRedlineHTML, createCommentAnchorFromSelection, parseMentions, setTrackChangesEnabledTransaction, isTrackChangesEnabled, type RevisionRecord, type AnchoredComment } from '@amusendame/beakblock-review';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import type { ReviewView } from '@amusendame/beakblock-review';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { reviewBaselineBlocks, V2_SCENARIOS } from '~/utils/v2/demoData';

const scenario = V2_SCENARIOS[3]!;

const AUTHORS = [
  { id: 'ann', name: 'Ann Author' },
  { id: 'ben', name: 'Ben Reviewer' },
  { id: 'rita', name: 'Rita Approver' },
];

const author = ref(AUTHORS[0]!);
const trackOn = ref(true);
const view = ref<ReviewView>('markup');
const store = new InMemoryRevisionStore();
const threads = new InMemoryCommentThreadStore();
const revisions = shallowRef<RevisionRecord[]>([]);
const comments = shallowRef<AnchoredComment[]>([]);
const loadedBlocks = shallowRef<Block[]>(reviewBaselineBlocks());
const editorKey = ref(0);
const surface = ref<{ getEditor: () => BeakBlockEditor | null; getBlocks: () => Block[] } | null>(null);
const released = shallowRef<Block[] | null>(null);
const releasedLabel = ref('Calibration procedure v1.0 (released)');
const redline = ref<{ html: string; summary: { added: number; removed: number; modified: number; moved: number; sectionsChanged: string[] } } | null>(null);
const selectionQuote = ref('');
const selectionAnchor = ref<boolean>(false);
const commentBody = ref('');
const replyDrafts = ref<Record<string, string>>({});
const notice = ref('');

const extensions = computed(() => [reviewExtension({ enabled: trackOn.value, author: { id: author.value.id, name: author.value.name }, store })]);

function refreshRevisions() {
  revisions.value = store.list();
}
function refreshComments() {
  comments.value = threads.list();
}

const pending = computed(() => revisions.value.filter((r) => r.status === 'pending'));
const pendingCount = computed(() => pending.value.length);

function onReady(ed: BeakBlockEditor) {
  ed.setReviewView(view.value);
  ed.on('selectionChange', () => {
    const { $from, $to, empty } = ed.pm.state.selection;
    if (empty || !$from.sameParent($to)) {
      selectionAnchor.value = false;
      selectionQuote.value = '';
      return;
    }
    selectionAnchor.value = true;
    selectionQuote.value = $from.parent.textContent.slice($from.parentOffset, $to.parentOffset);
  });
  ed.on('change', () => refreshRevisions());
  refreshRevisions();
}

const unsub: Array<() => void> = [];
onMounted(() => {
  unsub.push(store.subscribe(refreshRevisions));
  unsub.push(threads.subscribe(refreshComments));
  refreshRevisions();
  refreshComments();
});
onBeforeUnmount(() => unsub.forEach((fn) => fn()));

function setView(next: ReviewView) {
  view.value = next;
  surface.value?.getEditor()?.setReviewView(next);
}

/** Reopens the same content with another author (the review plugin binds its author on creation). */
function switchAuthor(next: (typeof AUTHORS)[number]) {
  const ed = surface.value?.getEditor();
  if (ed) loadedBlocks.value = ed.getDocument();
  author.value = next;
  editorKey.value += 1;
  notice.value = `Now editing as ${next.name}. Revisions and comments are shared with every author.`;
}

function toggleTracking() {
  trackOn.value = !trackOn.value;
  const ed = surface.value?.getEditor();
  if (!ed) return;
  const tr = setTrackChangesEnabledTransaction(ed.pm.state.tr, trackOn.value);
  ed.pm.dispatch(tr);
  notice.value = trackOn.value ? 'Track changes is on: edits are recorded as revisions.' : 'Track changes is off: edits apply directly.';
}

function editorView(): unknown {
  return surface.value?.getEditor()?.pm.view;
}

function act(id: string, kind: 'accept' | 'reject') {
  const v = editorView() as never;
  if (!v) return;
  if (kind === 'accept') acceptRevision(v, id, author.value.id);
  else rejectRevision(v, id, author.value.id);
  refreshRevisions();
}

function actAll(kind: 'accept' | 'reject') {
  const v = editorView() as never;
  if (!v) return;
  if (kind === 'accept') acceptAll(v, author.value.id);
  else rejectAll(v, author.value.id);
  refreshRevisions();
}

function addComment() {
  const body = commentBody.value.trim();
  const ed = surface.value?.getEditor();
  if (!selectionAnchor.value || !body || !ed) {
    notice.value = 'Select some text in the document first, then write the comment.';
    return;
  }
  const anchorData = createCommentAnchorFromSelection(ed.getDocument(), ed.pm.state.selection);
  if (!anchorData) {
    notice.value = 'The selection must stay within one block (paragraph, heading or list item).';
    return;
  }
  threads.add({ anchor: anchorData, authorId: author.value.id, authorName: author.value.name, body, mentions: parseMentions(body) } as never);
  commentBody.value = '';
  refreshComments();
}

function reply(comment: AnchoredComment) {
  const body = replyDrafts.value[comment.id]?.trim();
  if (!body) return;
  threads.reply(comment.id, { authorId: author.value.id, authorName: author.value.name, body, mentions: parseMentions(body) } as never);
  replyDrafts.value[comment.id] = '';
  refreshComments();
}

function toggleResolved(comment: AnchoredComment) {
  if (comment.status === 'open') threads.resolve(comment.id, author.value.id);
  else threads.reopen(comment.id, author.value.id);
  refreshComments();
}

function markReleased() {
  const ed = surface.value?.getEditor();
  if (!ed) return;
  released.value = structuredClone(ed.getDocument());
  notice.value = 'Current content recorded as the released revision. Edit the document, then compare.';
  redline.value = null;
}

function compareWithReleased() {
  const ed = surface.value?.getEditor();
  if (!ed || !released.value) return;
  const result = compareRevisions(released.value, ed.getDocument());
  redline.value = { html: renderRedlineHTML(result), summary: result.summary };
}

const textOfBlock = (b: Block) => (b.content ?? []).map((c) => (c as { text?: string }).text ?? '').join('');
const anchorBlockText = (c: AnchoredComment) => c.anchor.quote || '';
const commentCount = computed(() => comments.value.filter((c) => c.status === 'open').length);
void textOfBlock;
void anchorBlockText;
void isTrackChangesEnabled;
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <div class="tc-author" role="group" aria-label="Author">
        <span class="tc-label">Author</span>
        <button v-for="a in AUTHORS" :key="a.id" type="button" class="tc-chip" :aria-pressed="author.id === a.id" @click="switchAuthor(a)">{{ a.name }}</button>
      </div>
    </V2ScenarioHeader>

    <div class="tc-toolbar" role="toolbar" aria-label="Review controls">
      <button type="button" class="tc-btn" :aria-pressed="trackOn" @click="toggleTracking">Track changes: {{ trackOn ? 'on' : 'off' }}</button>
      <div class="tc-seg" role="group" aria-label="View">
        <button v-for="v in (['markup', 'final', 'original'] as const)" :key="v" type="button" class="tc-seg__btn" :aria-pressed="view === v" @click="setView(v)">
          {{ v === 'markup' ? 'Markup' : v === 'final' ? 'Final' : 'Original' }}
        </button>
      </div>
      <button type="button" class="tc-btn" :disabled="!pendingCount" @click="actAll('accept')">Accept all ({{ pendingCount }})</button>
      <button type="button" class="tc-btn" :disabled="!pendingCount" @click="actAll('reject')">Reject all</button>
      <button type="button" class="tc-btn tc-btn--primary" @click="markReleased">Record as released</button>
      <button type="button" class="tc-btn tc-btn--primary" :disabled="!released" @click="compareWithReleased">Compare with released revision</button>
    </div>
    <p v-if="notice" class="tc-notice" role="status">{{ notice }}</p>

    <div class="tc-grid">
      <div class="tc-main">
        <V2OfficeSurface
          :key="editorKey"
          ref="surface"
          :blocks="loadedBlocks"
          mode="office"
          :extensions="extensions"
          :navigation="false"
          :show-rulers="false"
          label="Calibration procedure with review"
          @ready="onReady"
        />
      </div>

      <aside class="tc-side" aria-label="Revisions and comments">
        <section class="tc-card">
          <p class="tc-label">Revisions ({{ revisions.length }})</p>
          <ul class="tc-list">
            <li v-for="r in revisions" :key="r.id" class="tc-rev" :data-status="r.status">
              <div>
                <strong>{{ r.kind }}</strong> by {{ r.authorName ?? r.authorId }}
                <span v-if="r.aiGenerated" class="tc-ai">AI-generated</span>
                <span class="tc-status">{{ r.status }}</span>
              </div>
              <p class="tc-quote">{{ r.text ?? '' }}</p>
              <div v-if="r.status === 'pending'" class="tc-row">
                <button type="button" class="tc-btn tc-btn--small" @click="act(r.id, 'accept')">Accept</button>
                <button type="button" class="tc-btn tc-btn--small" @click="act(r.id, 'reject')">Reject</button>
              </div>
            </li>
            <li v-if="!revisions.length" class="tc-hint">Type with track changes on, or delete text, to create revisions.</li>
          </ul>
        </section>

        <section class="tc-card">
          <p class="tc-label">Comments ({{ commentCount }} open)</p>
          <p class="tc-hint">
            Anchor: <strong>{{ selectionQuote || 'select text in the document' }}</strong>
          </p>
          <textarea v-model="commentBody" class="tc-textarea" rows="2" placeholder="Write a comment. Mention a colleague with @Ben."></textarea>
          <button type="button" class="tc-btn tc-btn--small" :disabled="!commentBody.trim()" @click="addComment">Add comment</button>
          <ul class="tc-list">
            <li v-for="c in comments" :key="c.id" class="tc-thread" :data-status="c.status">
              <div class="tc-row tc-row--between">
                <strong>“{{ c.anchor.quote || 'anchor' }}”</strong>
                <span class="tc-status">{{ c.status }}</span>
              </div>
              <div v-for="(e, i) in c.thread" :key="i" class="tc-entry">
                <strong>{{ e.authorName ?? e.authorId }}</strong>: {{ e.body }}
                <span v-if="e.mentions?.length" class="tc-mention">@{{ e.mentions.join(', @') }}</span>
              </div>
              <div class="tc-row">
                <input v-model="replyDrafts[c.id]" class="tc-input" placeholder="Reply" @keydown.enter.prevent="reply(c)" />
                <button type="button" class="tc-btn tc-btn--small" @click="reply(c)">Reply</button>
                <button type="button" class="tc-btn tc-btn--small" @click="toggleResolved(c)">{{ c.status === 'open' ? 'Resolve' : 'Reopen' }}</button>
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <section v-if="redline" class="tc-card tc-compare">
      <p class="tc-label">Compare with “{{ releasedLabel }}”</p>
      <div class="tc-summary">
        <span>Added {{ redline.summary.added }}</span>
        <span>Removed {{ redline.summary.removed }}</span>
        <span>Modified {{ redline.summary.modified }}</span>
        <span>Moved {{ redline.summary.moved }}</span>
        <span>Sections changed: {{ redline.summary.sectionsChanged.join(', ') || 'none' }}</span>
      </div>
      <iframe class="tc-redline" title="Redline comparison" sandbox="" :srcdoc="redline.html" />
    </section>
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tc-author {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.tc-label {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5b5752;
  font-weight: 600;
}
.tc-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.tc-chip,
.tc-btn,
.tc-seg__btn {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tc-chip[aria-pressed='true'],
.tc-btn[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.tc-btn--primary {
  background: #eef4fc;
  border-color: #9fbbe3;
}
.tc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tc-btn--small {
  padding: 3px 8px;
}
.tc-seg {
  display: inline-flex;
  border: 1px solid #c9c4bb;
  border-radius: 6px;
  overflow: hidden;
}
.tc-seg__btn {
  border: 0;
  border-radius: 0;
}
.tc-seg__btn[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
}
.tc-notice {
  margin: 0;
  font-size: 13px;
  background: #eef5ff;
  padding: 8px 10px;
  border-radius: 6px;
}
.tc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 12px;
  align-items: start;
}
.tc-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tc-card {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.tc-rev,
.tc-thread {
  border-top: 1px solid #ece9e3;
  padding-top: 6px;
}
.tc-rev[data-status='accepted'],
.tc-rev[data-status='rejected'] {
  opacity: 0.6;
}
.tc-status {
  margin-left: 6px;
  font-size: 11px;
  color: #5b5752;
}
.tc-ai {
  margin-left: 6px;
  font-size: 11px;
  background: #f1e9ff;
  color: #5b2aa0;
  padding: 0 6px;
  border-radius: 4px;
}
.tc-quote {
  margin: 2px 0;
  color: #4a4642;
  font-size: 12px;
}
.tc-thread[data-status='resolved'] {
  opacity: 0.65;
}
.tc-entry {
  font-size: 12px;
  margin: 2px 0;
}
.tc-mention {
  color: #2b579a;
  font-size: 11px;
  margin-left: 4px;
}
.tc-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.tc-row--between {
  justify-content: space-between;
}
.tc-input,
.tc-textarea {
  font: inherit;
  font-size: 12px;
  border: 1px solid #c9c4bb;
  border-radius: 6px;
  padding: 4px 6px;
  flex: 1 1 auto;
}
.tc-hint {
  font-size: 12px;
  color: #5b5752;
  margin: 0;
}
.tc-summary {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
}
.tc-redline {
  width: 100%;
  height: 360px;
  border: 1px solid #ece9e3;
  border-radius: 6px;
  background: #fff;
}
@media (max-width: 1100px) {
  .tc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
