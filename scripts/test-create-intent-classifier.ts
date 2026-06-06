import assert from "node:assert/strict";
import { classifyFirstCreatePrompt } from "../src/lib/intent/create-intent-classifier";

const mustNotCreate = [
  "What is a CRM?",
  "How does pricing work?",
  "Explain what Supabase is.",
  "What is the difference between app and website?",
  "Can you give me ideas for a fitness app?",
  "How do I publish an app?",
  "What should I build first?",
];

const mustCreate = [
  "Create a CRM app.",
  "Build me a CRM.",
  "Make a recipe app.",
  "Generate a dashboard for my startup.",
  "I want you to build a task manager.",
];

for (const prompt of mustNotCreate) {
  const r = classifyFirstCreatePrompt(prompt);
  assert.equal(
    r.shouldCreateProject,
    false,
    `expected no project for: ${prompt} (got ${r.intent})`,
  );
}

for (const prompt of mustCreate) {
  const r = classifyFirstCreatePrompt(prompt);
  assert.equal(r.shouldCreateProject, true, `expected project for: ${prompt}`);
}

console.log("test-create-intent-classifier: OK");
