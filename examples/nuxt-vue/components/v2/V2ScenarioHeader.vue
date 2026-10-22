<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; capability: string }>();
</script>

<template>
  <header class="v2-head">
    <div class="v2-head__copy">
      <p class="v2-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="v2-head__title">{{ title }}</h2>
      <p class="v2-head__cap"><span class="v2-head__tag">Roadmap</span> {{ capability }}</p>
    </div>
    <div class="v2-head__actions">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.v2-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 14px 16px;
  border: 1px solid #d6d3cd;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff, #f7f6f3);
}
.v2-head__copy {
  min-width: 0;
  flex: 1 1 360px;
}
.v2-head__eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2b579a;
  font-weight: 600;
}
.v2-head__title {
  margin: 2px 0 6px;
  font-size: 20px;
  line-height: 1.2;
}
.v2-head__cap {
  margin: 0;
  font-size: 13px;
  color: #4a4642;
  line-height: 1.5;
}
.v2-head__tag {
  display: inline-block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: #e8eef8;
  color: #2b579a;
  border-radius: 4px;
  padding: 1px 6px;
  margin-right: 4px;
  font-weight: 600;
}
.v2-head__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
