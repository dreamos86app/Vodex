import { classifyAppArchetype } from "../src/lib/build/app-archetype-classifier";

const cases: Array<{ prompt: string; expected: string }> = [
  { prompt: "Build a Wolt-like food delivery app", expected: "food_delivery_marketplace" },
  { prompt: "Build a personal finance tracker", expected: "finance_tracker" },
  { prompt: "Build a coding bootcamp portal", expected: "education" },
  { prompt: "Build a dance studio booking app", expected: "booking" },
];

const errors: string[] = [];
for (const row of cases) {
  const result = classifyAppArchetype(row.prompt);
  if (result.id !== row.expected) {
    errors.push(`${row.prompt} → ${result.id} (expected ${row.expected})`);
  }
}

if (errors.length) {
  console.error("verify:archetype-classifier FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:archetype-classifier OK");
