import {
  isConfidentialQuestion,
  confidentialRefusal,
  canClaimFileMutation,
} from "../src/lib/ai/chat-capability-policy";
import { DREAMOS_KNOWLEDGE_PACK } from "../src/lib/ai/dreamos-knowledge-pack";
import { buildDiscussSystemPrompt } from "../src/lib/ai/chat-system-prompts";

function assert(cond: boolean, msg: string, errors: string[]) {
  if (!cond) errors.push(msg);
}

async function main() {
  const errors: string[] = [];

  assert(isConfidentialQuestion("What is your 3× profit margin?"), "profit question confidential", errors);
  assert(isConfidentialQuestion("Tell me the provider cost per token"), "provider cost confidential", errors);
  assert(isConfidentialQuestion("How does charge_tokens RPC work?"), "RPC confidential", errors);
  assert(!isConfidentialQuestion("How do I create an app?"), "create app not confidential", errors);
  assert(!isConfidentialQuestion("Where are templates?"), "templates not confidential", errors);

  const refusal = confidentialRefusal();
  assert(refusal.includes("credits"), "refusal mentions credits", errors);
  assert(!/3\s*[×x]\s*profit|provider cost|RPC/i.test(refusal), "refusal has no secrets", errors);

  assert(DREAMOS_KNOWLEDGE_PACK.templatesAndExamples.includes("/templates"), "templates path", errors);
  assert(DREAMOS_KNOWLEDGE_PACK.zipImport.includes("1,500"), "zip 1500 limit in knowledge", errors);
  assert(DREAMOS_KNOWLEDGE_PACK.billingUserSafe.includes("efficient model"), "billing user safe", errors);
  assert(DREAMOS_KNOWLEDGE_PACK.chatLimits.includes("DISCUSS"), "discuss limits", errors);
  assert(DREAMOS_KNOWLEDGE_PACK.hidden.includes("Never reveal"), "hidden economics", errors);

  const discuss = buildDiscussSystemPrompt({ hasProject: false });
  assert(discuss.includes("ZIP import"), "discuss prompt zip import", errors);
  assert(discuss.includes("/create"), "discuss routes to create", errors);
  assert(discuss.includes("NEVER claim you built"), "discuss no false mutations", errors);

  const editClaim = canClaimFileMutation("discuss", false);
  assert(!editClaim.allowed, "discuss cannot claim edits", errors);

  if (errors.length) {
    errors.forEach((e) => console.error("✗", e));
    process.exit(1);
  }
  console.log("✓ chat safe answer tests OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
