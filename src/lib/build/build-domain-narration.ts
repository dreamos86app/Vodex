/** Domain-specific build opener from user prompt — user-facing request recap. */

function summarizePrompt(prompt: string, max = 140): string {
  const one = prompt.trim().replace(/\s+/g, " ");
  if (!one) return "your app idea";
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

export function buildDomainOpenerFromPrompt(prompt: string): string {
  const p = prompt.toLowerCase();
  const summary = summarizePrompt(prompt);

  if (/roommate|expense|split|receipt|settle.?up|shared bill/i.test(p)) {
    return `You want a roommate expense splitter — shared bills, balance tracking, settle-up reminders, and receipt photos. I'll set up the app shell and navigation first, then build dashboards, expense flows, balances, and reminders.`;
  }
  if (/gym|fitness|workout|motivation|streak|personal record|\bpr\b|lifting/i.test(p)) {
    return `You want a fitness motivation app with streaks, personal records, progress photos, and workout history. I'll build the shell and navigation first, then the dashboard, tracking flows, gallery, and profile insights.`;
  }
  if (/smart home|home automation|iot|device hub|lighting control/i.test(p)) {
    return `You want a smart home control app with device rooms, automation scenes, and live device status. I'll build the shell first, then dashboards, device pages, scenes, and settings.`;
  }
  if (/crm|sales pipeline|lead|customer/i.test(p)) {
    return `You want a sales CRM with pipeline boards, contact profiles, and activity timelines. I'll build the shell first, then pipeline views, detail pages, and reporting.`;
  }
  if (/restaurant|menu|reservation|booking/i.test(p)) {
    return `You want a hospitality app with menu browsing, reservations, and order tracking. I'll build the shell first, then guest flows and admin screens.`;
  }
  if (/e-?commerce|store|catalog|checkout|inventory/i.test(p)) {
    return `You want a commerce app with catalog, cart, checkout, and order management. I'll build the shell first, then catalog pages, cart flow, and admin dashboards.`;
  }

  return `You asked to build: "${summary}". I'll map screens and navigation first, then generate core pages, shared components, and wire everything together.`;
}

/** Short line after a build phase completes. */
export function buildPhaseCompleteNarration(phaseLabel: string, nextPhaseLabel?: string): string {
  if (nextPhaseLabel) {
    return `Finished ${phaseLabel.toLowerCase()} — now I'll work on ${nextPhaseLabel.toLowerCase()}.`;
  }
  return `Finished ${phaseLabel.toLowerCase()} — moving to the next step.`;
}
