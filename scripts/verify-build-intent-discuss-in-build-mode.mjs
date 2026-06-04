#!/usr/bin/env node
import {
  classifyBuildIntent,
  shouldStartBuildPipeline,
  shouldStartBuildPipelineInProject,
} from "../src/lib/ai/build-intent-classifier.ts";

const projectId = "00000000-0000-4000-8000-000000000001";

function assertPipeline(prompt, mode, project, expected) {
  const intent = classifyBuildIntent(prompt);
  const starts = project
    ? shouldStartBuildPipelineInProject(mode, project, prompt)
    : shouldStartBuildPipeline(mode, intent);
  if (starts !== expected) {
    throw new Error(
      `pipeline=${starts} expected=${expected} prompt="${prompt}" intent=${intent.intent}`,
    );
  }
}

assertPipeline("what color should the header be?", "build", projectId, false);
assertPipeline("thanks!", "build", projectId, false);
assertPipeline("how does routing work in Next?", "build", projectId, false);
assertPipeline("make the header darker", "build", projectId, true);
assertPipeline("build a ticket checkout flow", "build", projectId, true);
assertPipeline("build a portfolio site for a photographer", "build", null, true);

console.log("verify:build-intent-discuss-in-build-mode OK");
