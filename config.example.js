// HavenCraft chatbot config — TEMPLATE.
// Copy this file to `config.js` and put your key there.
// config.js is local-only: never push it to the repo, and this project's pushes never include it.
// If config.js is missing, the chat shows a generic error instead of crashing.

// Key for the chat API. This option is not shown in the chat UI.
const API_KEY = "";

// Model chain, in try order. Switching is invisible in the chat — no model names are ever shown.
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen3.8-27b"];
