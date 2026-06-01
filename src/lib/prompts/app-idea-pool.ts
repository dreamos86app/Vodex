import type { AppIdeaPrompt } from "@/lib/inspiration/app-idea-prompts";

/** Curated expansion — specific SaaS-style prompts across industries (pairs with core pool). */
export const EXPANDED_APP_IDEAS: AppIdeaPrompt[] = [
  {
    label: "Dental practice hub",
    desc: "Appointments, charts, and recalls",
    gradient: "from-cyan-500/15 to-blue-500/15",
    icon: "🦷",
    prompt:
      "Build a dental practice hub with online booking, patient charts, treatment plans, insurance estimates, and automated recall reminders.",
  },
  {
    label: "Property management suite",
    desc: "Units, leases, and maintenance",
    gradient: "from-slate-500/15 to-zinc-500/15",
    icon: "🏢",
    prompt:
      "Create a property management suite with unit listings, lease tracking, rent collection status, maintenance tickets, and tenant messaging.",
  },
  {
    label: "Creator sponsorship CRM",
    desc: "Deals, deliverables, and payouts",
    gradient: "from-pink-500/15 to-rose-500/15",
    icon: "📣",
    prompt:
      "Build a creator sponsorship CRM with brand deal pipeline, deliverable checklists, contract dates, and payout tracking per campaign.",
  },
  {
    label: "Warehouse pick-pack ship",
    desc: "Orders, bins, and scan workflow",
    gradient: "from-orange-500/15 to-amber-500/15",
    icon: "📦",
    prompt:
      "Create a warehouse operations app with order queues, bin locations, barcode scan pick lists, and packing confirmation photos.",
  },
  {
    label: "Therapist group practice",
    desc: "Intake, billing, and supervision",
    gradient: "from-teal-500/15 to-emerald-500/15",
    icon: "🧠",
    prompt:
      "Build a therapy group practice portal with secure intake forms, clinician schedules, superbill exports, and supervision note templates.",
  },
  {
    label: "Fleet rental dashboard",
    desc: "Vehicles, contracts, and damage",
    gradient: "from-gray-500/15 to-slate-500/15",
    icon: "🚗",
    prompt:
      "Create a fleet rental dashboard with vehicle availability, rental contracts, damage inspection checklists, and revenue per vehicle.",
  },
  {
    label: "University office hours",
    desc: "Queues, topics, and TA shifts",
    gradient: "from-indigo-500/15 to-violet-500/15",
    icon: "🎓",
    prompt:
      "Build a university office hours app with course queues, topic tags, TA shift scheduling, and student wait-time estimates.",
  },
  {
    label: "Boutique retail POS lite",
    desc: "Inventory, sales, and clients",
    gradient: "from-fuchsia-500/15 to-pink-500/15",
    icon: "👗",
    prompt:
      "Create a boutique retail POS with SKU inventory, quick checkout log, client purchase history, and low-stock reorder suggestions.",
  },
  {
    label: "Agency project tracker",
    desc: "Briefs, timelines, and approvals",
    gradient: "from-blue-500/15 to-indigo-500/15",
    icon: "📐",
    prompt:
      "Build an agency project tracker with client briefs, milestone timelines, asset approval flows, and billable hour summaries.",
  },
  {
    label: "Home services dispatch",
    desc: "Jobs, routes, and quotes",
    gradient: "from-sky-500/15 to-cyan-500/15",
    icon: "🔧",
    prompt:
      "Create a home services dispatch board with job tickets, technician routes, on-site photo proof, and instant quote templates.",
  },
];

const CATEGORY_EXPANSIONS: Array<{
  category: string;
  icon: string;
  gradient: string;
  ideas: Array<{ label: string; desc: string; prompt: string }>;
}> = [
  {
    category: "productivity",
    icon: "⚡",
    gradient: "from-blue-500/15 to-indigo-500/15",
    ideas: [
      {
        label: "Focus sprint planner",
        desc: "Deep work blocks and reviews",
        prompt:
          "Build a focus sprint planner with 90-minute deep work blocks, distraction logging, daily review prompts, and weekly output metrics.",
      },
      {
        label: "Meeting cost calculator",
        desc: "Attendees, duration, and ROI",
        prompt:
          "Create a meeting cost calculator that estimates attendee time cost, suggests agenda templates, and tracks follow-up action completion.",
      },
      {
        label: "OKR command center",
        desc: "Objectives, key results, check-ins",
        prompt:
          "Build an OKR command center with quarterly objectives, key result progress bars, weekly check-in forms, and team alignment views.",
      },
      {
        label: "Inbox zero coach",
        desc: "Triage rules and snooze",
        prompt:
          "Create an inbox zero coach with email triage rules, snooze presets, response templates, and daily processing streak tracking.",
      },
      {
        label: "Contractor timesheet hub",
        desc: "Projects, timers, and exports",
        prompt:
          "Build a contractor timesheet hub with per-project timers, client approval workflow, CSV payroll export, and utilization charts.",
      },
    ],
  },
  {
    category: "health",
    icon: "❤️",
    gradient: "from-rose-500/15 to-red-500/15",
    ideas: [
      {
        label: "Clinic intake wizard",
        desc: "Forms, triage, and scheduling",
        prompt:
          "Build a clinic intake wizard with dynamic health questionnaires, triage scoring, insurance capture, and same-day scheduling slots.",
      },
      {
        label: "Physical therapy home program",
        desc: "Exercises, pain log, reminders",
        prompt:
          "Create a physical therapy home program app with exercise videos, daily pain logging, adherence reminders, and therapist messaging.",
      },
      {
        label: "Nutrition coaching portal",
        desc: "Macros, meals, and check-ins",
        prompt:
          "Build a nutrition coaching portal with macro targets, meal photo logging, weekly coach check-ins, and grocery list suggestions.",
      },
      {
        label: "Sleep hygiene tracker",
        desc: "Bedtime, habits, and trends",
        prompt:
          "Create a sleep hygiene tracker with bedtime routines, caffeine cutoffs, morning energy ratings, and 14-day trend insights.",
      },
      {
        label: "Pharmacy refill assistant",
        desc: "Prescriptions, reminders, pickup",
        prompt:
          "Build a pharmacy refill assistant with prescription lists, refill reminders, pickup notifications, and interaction warning notes.",
      },
    ],
  },
  {
    category: "finance",
    icon: "💳",
    gradient: "from-emerald-500/15 to-green-500/15",
    ideas: [
      {
        label: "SaaS metrics cockpit",
        desc: "MRR, churn, and cohorts",
        prompt:
          "Create a SaaS metrics cockpit with MRR charts, logo churn, net revenue retention, and plan mix breakdown by segment.",
      },
      {
        label: "Invoice factoring tracker",
        desc: "AR aging and advances",
        prompt:
          "Build an invoice factoring tracker with AR aging buckets, advance requests, fee calculations, and client payment status.",
      },
      {
        label: "Cap table simulator",
        desc: "Rounds, dilution, scenarios",
        prompt:
          "Create a cap table simulator with funding round modeling, dilution scenarios, option pool grants, and founder ownership charts.",
      },
      {
        label: "Expense policy enforcer",
        desc: "Receipts, limits, approvals",
        prompt:
          "Build an expense policy enforcer with receipt OCR upload, per-category limits, manager approvals, and audit export.",
      },
      {
        label: "Rent roll analyzer",
        desc: "Units, NOI, and vacancies",
        prompt:
          "Create a rent roll analyzer with unit-level rent, vacancy days, operating expenses, and NOI projections for multifamily assets.",
      },
    ],
  },
  {
    category: "education",
    icon: "📚",
    gradient: "from-violet-500/15 to-purple-500/15",
    ideas: [
      {
        label: "Course cohort community",
        desc: "Lessons, forums, office hours",
        prompt:
          "Build a course cohort community with module lessons, discussion forums, live office hours scheduling, and completion certificates.",
      },
      {
        label: "Lab safety checklist",
        desc: "Protocols, sign-offs, incidents",
        prompt:
          "Create a lab safety checklist app with protocol libraries, daily sign-offs, incident reporting, and equipment inspection logs.",
      },
      {
        label: "Parent-teacher conference",
        desc: "Slots, notes, action items",
        prompt:
          "Build a parent-teacher conference scheduler with time slot booking, session notes, action item follow-ups, and translation support.",
      },
      {
        label: "Scholarship matcher",
        desc: "Eligibility, deadlines, essays",
        prompt:
          "Create a scholarship matcher with eligibility filters, deadline calendar, essay prompts, and application status tracking.",
      },
      {
        label: "Skills micro-credential wallet",
        desc: "Badges, evidence, sharing",
        prompt:
          "Build a skills micro-credential wallet with badge collections, evidence uploads, employer share links, and learning pathways.",
      },
    ],
  },
  {
    category: "commerce",
    icon: "🛒",
    gradient: "from-amber-500/15 to-orange-500/15",
    ideas: [
      {
        label: "Wholesale order portal",
        desc: "Catalog, MOQ, and reorders",
        prompt:
          "Create a wholesale order portal with tiered pricing catalogs, MOQ rules, quick reorder carts, and shipment tracking for retailers.",
      },
      {
        label: "Returns & RMA center",
        desc: "Tickets, labels, resolutions",
        prompt:
          "Build a returns and RMA center with return reasons, prepaid label generation, inspection notes, and refund/exchange resolution.",
      },
      {
        label: "Flash sale countdown store",
        desc: "Timers, inventory, urgency",
        prompt:
          "Create a flash sale storefront with countdown timers, limited inventory badges, waitlist capture, and post-purchase upsell offers.",
      },
      {
        label: "B2B quote builder",
        desc: "Line items, discounts, PDF",
        prompt:
          "Build a B2B quote builder with configurable line items, volume discounts, approval workflow, and branded PDF quote export.",
      },
      {
        label: "Loyalty tier manager",
        desc: "Points, perks, campaigns",
        prompt:
          "Create a loyalty tier manager with points earning rules, tier perks, targeted campaigns, and member activity analytics.",
      },
    ],
  },
  {
    category: "creator",
    icon: "🎬",
    gradient: "from-pink-500/15 to-fuchsia-500/15",
    ideas: [
      {
        label: "Content calendar studio",
        desc: "Channels, drafts, approvals",
        prompt:
          "Build a content calendar studio with multi-channel scheduling, draft approvals, asset library tags, and performance snapshots.",
      },
      {
        label: "UGC rights manager",
        desc: "Licenses, usage, payouts",
        prompt:
          "Create a UGC rights manager tracking creator licenses, usage windows, platform approvals, and royalty payout status.",
      },
      {
        label: "Newsletter growth lab",
        desc: "Referrals, A/B, segments",
        prompt:
          "Build a newsletter growth lab with referral programs, subject line A/B tests, segment analytics, and paid upgrade funnels.",
      },
      {
        label: "Podcast sponsor pipeline",
        desc: "Inbound, rates, contracts",
        prompt:
          "Create a podcast sponsor pipeline with inbound lead forms, rate cards, contract milestones, and episode ad read scripts.",
      },
      {
        label: "Digital product launch pad",
        desc: "Waitlist, checkout, affiliates",
        prompt:
          "Build a digital product launch pad with waitlist pages, early-bird checkout, affiliate tracking, and launch day analytics.",
      },
    ],
  },
  {
    category: "operations",
    icon: "⚙️",
    gradient: "from-slate-500/15 to-gray-500/15",
    ideas: [
      {
        label: "SOP runbook library",
        desc: "Steps, owners, audits",
        prompt:
          "Create an SOP runbook library with step-by-step procedures, owner assignments, version history, and quarterly audit checklists.",
      },
      {
        label: "Vendor scorecard",
        desc: "SLAs, incidents, renewals",
        prompt:
          "Build a vendor scorecard with SLA tracking, incident logs, contract renewal dates, and quarterly business review notes.",
      },
      {
        label: "Shift handoff log",
        desc: "Notes, tasks, escalations",
        prompt:
          "Create a shift handoff log for operations teams with open tasks, escalation flags, equipment status, and read receipts.",
      },
      {
        label: "Quality inspection app",
        desc: "Checklists, photos, CAPA",
        prompt:
          "Build a quality inspection app with digital checklists, photo evidence, nonconformance tags, and CAPA follow-up tasks.",
      },
      {
        label: "Capacity planning board",
        desc: "Teams, demand, forecasts",
        prompt:
          "Create a capacity planning board with team availability, demand forecasts, hiring triggers, and scenario sliders.",
      },
    ],
  },
  {
    category: "AI tools",
    icon: "🤖",
    gradient: "from-blue-500/15 to-violet-500/15",
    ideas: [
      {
        label: "Prompt experiment lab",
        desc: "Versions, evals, winners",
        prompt:
          "Build a prompt experiment lab with version history, side-by-side outputs, evaluation scores, and promoted winner templates.",
      },
      {
        label: "RAG knowledge assistant",
        desc: "Docs, citations, feedback",
        prompt:
          "Create a RAG knowledge assistant with document ingestion, cited answers, thumbs feedback, and admin gap reports.",
      },
      {
        label: "AI sales email coach",
        desc: "Sequences, tone, replies",
        prompt:
          "Build an AI sales email coach with sequence templates, tone adjustments, reply classification, and meeting booking CTAs.",
      },
      {
        label: "Support copilot inbox",
        desc: "Drafts, macros, sentiment",
        prompt:
          "Create a support copilot inbox with suggested replies, macro insertion, sentiment alerts, and resolution time tracking.",
      },
      {
        label: "Model routing dashboard",
        desc: "Latency, cost, fallbacks",
        prompt:
          "Build a model routing dashboard showing latency percentiles, cost per task, fallback triggers, and error rate by provider.",
      },
    ],
  },
  {
    category: "local business",
    icon: "📍",
    gradient: "from-lime-500/15 to-green-500/15",
    ideas: [
      {
        label: "Barbershop queue app",
        desc: "Walk-ins, stylists, SMS",
        prompt:
          "Create a barbershop queue app with walk-in waitlist, stylist selection, SMS when chair is ready, and tip tracking.",
      },
      {
        label: "Auto detail booking",
        desc: "Packages, bays, deposits",
        prompt:
          "Build an auto detailing booking app with service packages, bay scheduling, deposit payments, and before/after photo gallery.",
      },
      {
        label: "Bakery pre-order portal",
        desc: "Custom cakes, pickup slots",
        prompt:
          "Create a bakery pre-order portal with custom cake forms, pickup time slots, allergen notes, and order-ready notifications.",
      },
      {
        label: "Cleaning crew scheduler",
        desc: "Homes, teams, checklists",
        prompt:
          "Build a cleaning crew scheduler with recurring home visits, team assignments, room checklists, and supply restock alerts.",
      },
      {
        label: "Tattoo consult booking",
        desc: "Artists, deposits, designs",
        prompt:
          "Create a tattoo studio booking app with artist portfolios, consult scheduling, deposit collection, and design approval uploads.",
      },
    ],
  },
  {
    category: "fitness",
    icon: "🏋️",
    gradient: "from-orange-500/15 to-red-500/15",
    ideas: [
      {
        label: "CrossFit WOD logger",
        desc: "Scores, PRs, leaderboards",
        prompt:
          "Build a CrossFit WOD logger with daily workouts, score entry, PR tracking, and gym-wide leaderboards by division.",
      },
      {
        label: "Personal trainer CRM",
        desc: "Clients, programs, payments",
        prompt:
          "Create a personal trainer CRM with client profiles, workout program builder, session scheduling, and package payment tracking.",
      },
      {
        label: "Swim club meet manager",
        desc: "Events, heats, results",
        prompt:
          "Build a swim club meet manager with event scheduling, heat sheets, lane assignments, and live results publishing.",
      },
      {
        label: "Climbing gym pass tracker",
        desc: "Visits, grades, partners",
        prompt:
          "Create a climbing gym app with visit logging, route grade tracking, partner matching, and membership day-pass sales.",
      },
      {
        label: "Wellness retreat bookings",
        desc: "Packages, rooms, itineraries",
        prompt:
          "Build a wellness retreat booking site with package tiers, room selection, daily itinerary previews, and dietary preference forms.",
      },
    ],
  },
  {
    category: "real estate",
    icon: "🏠",
    gradient: "from-sky-500/15 to-blue-500/15",
    ideas: [
      {
        label: "Open house sign-in",
        desc: "Leads, follow-ups, MLS",
        prompt:
          "Create an open house sign-in app with visitor capture, instant follow-up emails, agent notes, and MLS listing embed.",
      },
      {
        label: "Tenant maintenance portal",
        desc: "Tickets, photos, status",
        prompt:
          "Build a tenant maintenance portal with issue tickets, photo uploads, priority levels, and landlord status updates.",
      },
      {
        label: "Commercial lease abstract",
        desc: "Clauses, dates, reminders",
        prompt:
          "Create a commercial lease abstract tool with key clause extraction, critical date reminders, and document version storage.",
      },
      {
        label: "Short-term rental ops",
        desc: "Turnovers, cleaners, reviews",
        prompt:
          "Build a short-term rental ops hub with turnover tasks, cleaner scheduling, guest messaging templates, and review monitoring.",
      },
      {
        label: "HOA violation tracker",
        desc: "Reports, fines, hearings",
        prompt:
          "Create an HOA violation tracker with resident reports, fine assessments, hearing schedules, and resolution documentation.",
      },
    ],
  },
  {
    category: "legal",
    icon: "⚖️",
    gradient: "from-stone-500/15 to-slate-500/15",
    ideas: [
      {
        label: "Contract review queue",
        desc: "Versions, redlines, approvals",
        prompt:
          "Build a contract review queue with version uploads, redline comments, approver assignments, and executed PDF archive.",
      },
      {
        label: "IP trademark docket",
        desc: "Filings, deadlines, classes",
        prompt:
          "Create an IP trademark docket with filing dates, class codes, renewal deadlines, and opposition watch alerts.",
      },
      {
        label: "Immigration case tracker",
        desc: "Forms, evidence, milestones",
        prompt:
          "Build an immigration case tracker with form checklists, evidence uploads, milestone timelines, and client status portal.",
      },
      {
        label: "Mediation session planner",
        desc: "Parties, agendas, agreements",
        prompt:
          "Create a mediation session planner with party profiles, agenda templates, private caucus notes, and agreement drafting.",
      },
      {
        label: "Legal hold manager",
        desc: "Custodians, sources, attestations",
        prompt:
          "Build a legal hold manager with custodian lists, data source mapping, acknowledgment tracking, and release workflows.",
      },
    ],
  },
  {
    category: "HR",
    icon: "👥",
    gradient: "from-indigo-500/15 to-blue-500/15",
    ideas: [
      {
        label: "Performance review cycle",
        desc: "Goals, 360s, calibrations",
        prompt:
          "Create a performance review cycle app with goal setting, 360 feedback forms, manager calibrations, and export summaries.",
      },
      {
        label: "PTO policy center",
        desc: "Balances, requests, coverage",
        prompt:
          "Build a PTO policy center with balance tracking, team coverage warnings, approval chains, and holiday calendars.",
      },
      {
        label: "Internal job board",
        desc: "Roles, referrals, pipelines",
        prompt:
          "Create an internal job board with open roles, employee referrals, hiring manager pipelines, and interview scorecards.",
      },
      {
        label: "Benefits enrollment guide",
        desc: "Plans, comparisons, elections",
        prompt:
          "Build a benefits enrollment guide with plan comparisons, dependent coverage, election confirmations, and FAQ chat.",
      },
      {
        label: "Desk hoteling app",
        desc: "Floors, bookings, amenities",
        prompt:
          "Create a desk hoteling app with floor maps, same-day desk booking, amenity filters, and team neighborhood zones.",
      },
    ],
  },
  {
    category: "travel",
    icon: "✈️",
    gradient: "from-cyan-500/15 to-teal-500/15",
    ideas: [
      {
        label: "Group trip planner",
        desc: "Polls, expenses, itinerary",
        prompt:
          "Build a group trip planner with date polls, shared itineraries, expense splitting, and packing list collaboration.",
      },
      {
        label: "Tour operator manifest",
        desc: "Guests, pickups, guides",
        prompt:
          "Create a tour operator manifest with guest lists, pickup points, guide assignments, and daily capacity limits.",
      },
      {
        label: "Visa requirement checker",
        desc: "Passports, stays, documents",
        prompt:
          "Build a visa requirement checker with passport nationality inputs, stay duration rules, document checklists, and embassy links.",
      },
      {
        label: "Loyalty miles optimizer",
        desc: "Programs, transfers, alerts",
        prompt:
          "Create a loyalty miles optimizer tracking programs, transfer bonuses, expiration alerts, and sweet-spot redemption ideas.",
      },
      {
        label: "RV campground finder",
        desc: "Sites, hookups, reviews",
        prompt:
          "Build an RV campground finder with hookup filters, site photos, availability calendar, and traveler reviews.",
      },
    ],
  },
  {
    category: "events",
    icon: "🎉",
    gradient: "from-fuchsia-500/15 to-purple-500/15",
    ideas: [
      {
        label: "Conference agenda app",
        desc: "Sessions, bookmarks, sponsors",
        prompt:
          "Create a conference agenda app with session bookmarks, speaker bios, sponsor showcases, and live announcement push.",
      },
      {
        label: "Wedding vendor hub",
        desc: "Contracts, payments, timeline",
        prompt:
          "Build a wedding vendor hub with vendor contracts, payment schedules, day-of timeline, and shared mood board links.",
      },
      {
        label: "Festival volunteer ops",
        desc: "Shifts, radios, check-in",
        prompt:
          "Create a festival volunteer operations app with shift signup, radio channel assignments, check-in QR, and incident reporting.",
      },
      {
        label: "Hackathon team matcher",
        desc: "Skills, ideas, formation",
        prompt:
          "Build a hackathon team matcher with skill tags, project idea boards, team formation chat, and mentor office hours.",
      },
      {
        label: "Gala seating designer",
        desc: "Tables, guests, dietary",
        prompt:
          "Create a gala seating designer with table layouts, guest dietary flags, drag-and-drop assignments, and print-ready charts.",
      },
    ],
  },
  {
    category: "analytics",
    icon: "📈",
    gradient: "from-emerald-500/15 to-teal-500/15",
    ideas: [
      {
        label: "Marketing attribution hub",
        desc: "UTMs, channels, ROAS",
        prompt:
          "Build a marketing attribution hub with UTM capture, channel performance, ROAS charts, and cohort conversion funnels.",
      },
      {
        label: "Product analytics sandbox",
        desc: "Events, funnels, retention",
        prompt:
          "Create a product analytics sandbox with event tracking setup, funnel exploration, retention curves, and feature flag notes.",
      },
      {
        label: "Inventory forecast studio",
        desc: "SKU demand, seasonality",
        prompt:
          "Build an inventory forecast studio with SKU demand curves, seasonality adjustments, safety stock recommendations, and PO suggestions.",
      },
      {
        label: "Support CSAT dashboard",
        desc: "Tickets, themes, agents",
        prompt:
          "Create a support CSAT dashboard with ticket volume, sentiment themes, agent scorecards, and SLA breach alerts.",
      },
      {
        label: "Website experiment tracker",
        desc: "Tests, variants, winners",
        prompt:
          "Build a website experiment tracker with A/B test registry, variant screenshots, statistical significance notes, and winner rollouts.",
      },
    ],
  },
];

function expandCategoryIdeas(): AppIdeaPrompt[] {
  const out: AppIdeaPrompt[] = [];
  for (const block of CATEGORY_EXPANSIONS) {
    for (const idea of block.ideas) {
      out.push({
        label: idea.label,
        desc: idea.desc,
        gradient: block.gradient,
        icon: block.icon,
        prompt: idea.prompt,
      });
    }
  }
  return out;
}

export const EXPANDED_CATEGORY_APP_IDEAS = expandCategoryIdeas();

/** Expanded prompts only — combine with core pool in app-idea-prompts. */
export const ALL_EXPANDED_APP_IDEAS: AppIdeaPrompt[] = [
  ...EXPANDED_APP_IDEAS,
  ...EXPANDED_CATEGORY_APP_IDEAS,
];
