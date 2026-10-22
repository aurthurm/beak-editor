/** Tells the browser whether the server-side AI provider is configured (drives the mock badge). */
export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  const key = process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || String(config.openaiApiKey || '');
  return { configured: Boolean(key), model: config.beakblockAiModel || 'gpt-4.1-mini' };
});
