/** Domain-specific build opener from user prompt — not generic boilerplate. */

export function buildDomainOpenerFromPrompt(prompt: string): string {
  const p = prompt.toLowerCase();

  if (/gym|fitness|workout|motivation|streak|personal record|\bpr\b|lifting/i.test(p)) {
    return "I'll design this as a fitness motivation product with a streak engine, personal record tracker, progress photo timeline, weekly achievement badges, workout history, goals, and profile insights. I'll build the shell first, then add the dashboard, tracking flows, gallery, and rewards system.";
  }
  if (/smart home|home automation|iot|device hub|lighting control/i.test(p)) {
    return "I'll design this as a smart home control product with device rooms, automation scenes, energy insights, and live device status. I'll build the shell and navigation first, then the dashboard, device pages, scenes, and settings.";
  }
  if (/crm|sales pipeline|lead|customer/i.test(p)) {
    return "I'll design this as a sales CRM with pipeline boards, contact profiles, activity timelines, and revenue dashboards. I'll build the shell first, then pipeline views, detail pages, and reporting.";
  }
  if (/restaurant|menu|reservation|booking/i.test(p)) {
    return "I'll design this as a hospitality product with menu browsing, table reservations, order tracking, and staff dashboards. I'll build the shell first, then guest flows and admin screens.";
  }
  if (/e-?commerce|store|catalog|checkout|inventory/i.test(p)) {
    return "I'll design this as a commerce product with product catalog, cart, checkout, and order management. I'll build the shell first, then catalog pages, cart flow, and admin dashboards.";
  }

  return "I'll turn this into a production app with these systems — shell, data, routes, components, then polish.";
}
