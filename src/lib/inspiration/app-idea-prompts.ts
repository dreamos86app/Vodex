export type AppIdeaPrompt = {
  label: string;
  desc: string;
  gradient: string;
  icon: string;
  prompt: string;
};

import { ALL_EXPANDED_APP_IDEAS } from "@/lib/prompts/app-idea-pool";

const CORE_APP_IDEA_POOL: AppIdeaPrompt[] = [
  { label: "Personal finance tracker", desc: "Budgets, goals, and spending alerts", gradient: "from-emerald-500/15 to-green-500/15", icon: "💰", prompt: "Build a personal finance tracker with budget categories, monthly goals, spending trends, and automated overspend alerts." },
  { label: "Gym motivation app", desc: "Streaks, PRs, and progress photos", gradient: "from-violet-500/15 to-indigo-500/15", icon: "💪", prompt: "Create a gym motivation app with workout streaks, personal record tracking, progress photos, and weekly achievement badges." },
  { label: "Restaurant inventory OS", desc: "Stock, waste, and supplier alerts", gradient: "from-amber-500/15 to-orange-500/15", icon: "🍽️", prompt: "Build a restaurant inventory system with stock tracking, waste analytics, low-stock alerts, and supplier reorder workflows." },
  { label: "Social profile app", desc: "Posts, likes, comments, follows", gradient: "from-pink-500/15 to-rose-500/15", icon: "💬", prompt: "Create a social app with user profiles, a real-time feed, likes, comments, follow/unfollow, and push notifications." },
  { label: "Salon booking platform", desc: "Staff calendars and SMS reminders", gradient: "from-cyan-500/15 to-blue-500/15", icon: "💇", prompt: "Build a salon booking platform with staff calendars, real-time slots, client SMS reminders, and cancellation management." },
  { label: "AI chatbot platform", desc: "Models, history, and folders", gradient: "from-blue-500/15 to-violet-500/15", icon: "🤖", prompt: "Build an AI chatbot platform with multiple model support, conversation history, folder organization, and custom system prompts." },
  { label: "SaaS analytics dashboard", desc: "KPIs, charts, and team roles", gradient: "from-blue-500/20 to-violet-500/20", icon: "📊", prompt: "Build a premium SaaS analytics dashboard with KPI cards, interactive charts, team management, and role-based access control." },
  { label: "E-commerce storefront", desc: "Catalog, cart, and Stripe checkout", gradient: "from-emerald-500/20 to-cyan-500/20", icon: "🛍️", prompt: "Build a modern e-commerce storefront with product catalog, cart, Stripe checkout, order tracking, and admin inventory." },
  { label: "Developer portfolio", desc: "Animated hero and project showcase", gradient: "from-pink-500/20 to-rose-500/20", icon: "✨", prompt: "Build a stunning developer portfolio with animated hero, project showcase, skills section, testimonials, and contact form." },
  { label: "AI-powered CRM", desc: "Pipeline, contacts, and follow-ups", gradient: "from-cyan-500/20 to-blue-500/20", icon: "📋", prompt: "Create an AI-powered CRM with contact management, deal pipeline, activity tracking, and automated follow-up suggestions." },
  { label: "Habit tracker", desc: "Daily streaks and weekly reviews", gradient: "from-teal-500/15 to-emerald-500/15", icon: "✅", prompt: "Build a habit tracker with daily check-ins, streak counters, weekly review summaries, and gentle reminder notifications." },
  { label: "Recipe manager", desc: "Meal plans and grocery lists", gradient: "from-orange-500/15 to-amber-500/15", icon: "🥗", prompt: "Create a recipe manager with saved recipes, meal planning calendar, auto-generated grocery lists, and nutrition estimates." },
  { label: "Event ticketing app", desc: "QR tickets and check-in", gradient: "from-purple-500/15 to-fuchsia-500/15", icon: "🎟️", prompt: "Build an event ticketing app with event listings, Stripe payments, QR code tickets, and organizer check-in dashboard." },
  { label: "Freelancer invoicing", desc: "Clients, time tracking, payments", gradient: "from-slate-500/15 to-zinc-500/15", icon: "🧾", prompt: "Build a freelancer invoicing tool with client profiles, time tracking, PDF invoices, payment status, and expense logging." },
  { label: "Language flashcards", desc: "Spaced repetition and quizzes", gradient: "from-indigo-500/15 to-blue-500/15", icon: "🌍", prompt: "Create a language learning app with flashcard decks, spaced repetition scheduling, pronunciation audio, and progress stats." },
  { label: "Pet care diary", desc: "Vet visits, meds, and reminders", gradient: "from-amber-500/15 to-yellow-500/15", icon: "🐾", prompt: "Build a pet care diary with profiles per pet, vaccination records, medication reminders, and vet appointment history." },
  { label: "Real estate listings", desc: "Map search and saved homes", gradient: "from-sky-500/15 to-cyan-500/15", icon: "🏠", prompt: "Create a real estate listings app with map search, filters, saved favorites, agent contact forms, and open-house calendar." },
  { label: "Podcast studio hub", desc: "Episodes, guests, and analytics", gradient: "from-violet-500/15 to-purple-500/15", icon: "🎙️", prompt: "Build a podcast studio hub with episode planning, guest scheduling, show notes, and download analytics dashboard." },
  { label: "Study group planner", desc: "Shared notes and session timers", gradient: "from-blue-500/15 to-indigo-500/15", icon: "📚", prompt: "Create a study group planner with shared notes, Pomodoro session timers, assignment deadlines, and group chat." },
  { label: "Wedding planner", desc: "Guest list, budget, and timeline", gradient: "from-rose-500/15 to-pink-500/15", icon: "💒", prompt: "Build a wedding planner with guest list RSVP tracking, budget categories, vendor contacts, and day-of timeline checklist." },
  { label: "Car maintenance log", desc: "Service history and reminders", gradient: "from-gray-500/15 to-slate-500/15", icon: "🚗", prompt: "Create a car maintenance log with service history, mileage tracking, upcoming service reminders, and receipt uploads." },
  { label: "Plant watering app", desc: "Schedules and care tips", gradient: "from-green-500/15 to-lime-500/15", icon: "🌿", prompt: "Build a plant care app with watering schedules, sunlight requirements, care tips, and photo growth timeline per plant." },
  { label: "Job board", desc: "Listings, applications, and filters", gradient: "from-blue-500/15 to-teal-500/15", icon: "💼", prompt: "Create a job board with company listings, application tracking, saved jobs, email alerts, and admin moderation tools." },
  { label: "Nonprofit donor CRM", desc: "Campaigns and donation history", gradient: "from-emerald-500/15 to-teal-500/15", icon: "❤️", prompt: "Build a nonprofit donor CRM with campaign tracking, donation history, recurring gifts, and thank-you email automation." },
  { label: "Coaching client portal", desc: "Sessions, goals, and resources", gradient: "from-violet-500/15 to-indigo-500/15", icon: "🎯", prompt: "Create a coaching client portal with session scheduling, goal tracking, shared resources, and progress journal entries." },
  { label: "Inventory for retail", desc: "SKU scanning and low-stock alerts", gradient: "from-orange-500/15 to-red-500/15", icon: "📦", prompt: "Build a retail inventory app with SKU barcode scanning, stock levels per location, low-stock alerts, and sales velocity reports." },
  { label: "Music lesson scheduler", desc: "Students, rooms, and billing", gradient: "from-fuchsia-500/15 to-pink-500/15", icon: "🎵", prompt: "Create a music school scheduler with student profiles, teacher availability, room booking, and monthly billing summaries." },
  { label: "Travel itinerary builder", desc: "Trips, maps, and packing lists", gradient: "from-sky-500/15 to-blue-500/15", icon: "✈️", prompt: "Build a travel itinerary builder with day-by-day plans, map pins, shared packing lists, and expense splitting for groups." },
  { label: "Community forum", desc: "Threads, moderation, and badges", gradient: "from-indigo-500/15 to-violet-500/15", icon: "🗣️", prompt: "Create a community forum with categories, threaded discussions, moderation tools, user badges, and search." },
  { label: "Subscription box manager", desc: "Boxes, subscribers, and shipping", gradient: "from-amber-500/15 to-orange-500/15", icon: "📬", prompt: "Build a subscription box manager with subscriber lists, monthly box curation, shipping labels export, and churn analytics." },
  { label: "Home renovation tracker", desc: "Rooms, budgets, and contractors", gradient: "from-stone-500/15 to-amber-500/15", icon: "🔨", prompt: "Create a home renovation tracker with room-by-room budgets, contractor contacts, photo before/after gallery, and task checklist." },
  { label: "Meditation timer", desc: "Sessions, streaks, and ambient sounds", gradient: "from-purple-500/15 to-indigo-500/15", icon: "🧘", prompt: "Build a meditation app with customizable timers, guided session library, streak tracking, and ambient sound mixer." },
  { label: "Sports league manager", desc: "Teams, schedules, and standings", gradient: "from-green-500/15 to-emerald-500/15", icon: "⚽", prompt: "Create a sports league manager with team rosters, match schedules, live standings, and player stat tracking." },
  { label: "Legal client intake", desc: "Forms, documents, and status", gradient: "from-slate-500/15 to-gray-500/15", icon: "⚖️", prompt: "Build a legal client intake portal with dynamic forms, secure document upload, case status timeline, and appointment booking." },
  { label: "Coffee shop loyalty", desc: "Points, rewards, and mobile wallet", gradient: "from-amber-500/15 to-yellow-500/15", icon: "☕", prompt: "Create a coffee shop loyalty app with points per purchase, reward tiers, digital punch cards, and push offers." },
  { label: "Camp registration", desc: "Sessions, waivers, and payments", gradient: "from-lime-500/15 to-green-500/15", icon: "🏕️", prompt: "Build a summer camp registration system with session selection, digital waivers, Stripe payments, and parent dashboard." },
  { label: "Art commission gallery", desc: "Portfolio, orders, and milestones", gradient: "from-pink-500/15 to-fuchsia-500/15", icon: "🎨", prompt: "Create an art commission gallery with artist portfolio, commission request forms, milestone payments, and client approval flow." },
  { label: "Fleet dispatch board", desc: "Drivers, routes, and live map", gradient: "from-blue-500/15 to-cyan-500/15", icon: "🚚", prompt: "Build a fleet dispatch board with driver assignments, route optimization view, delivery status updates, and customer notifications." },
  { label: "Church community hub", desc: "Events, groups, and giving", gradient: "from-violet-500/15 to-purple-500/15", icon: "⛪", prompt: "Create a church community hub with event calendar, small group sign-ups, online giving, and volunteer scheduling." },
  { label: "Therapy practice notes", desc: "Clients, sessions, and billing", gradient: "from-teal-500/15 to-cyan-500/15", icon: "🩺", prompt: "Build a therapy practice app with encrypted session notes, client scheduling, invoice generation, and HIPAA-minded access controls." },
  { label: "Food truck locator", desc: "Live map and daily menus", gradient: "from-orange-500/15 to-red-500/15", icon: "🌮", prompt: "Create a food truck locator with live GPS map, daily menu updates, favorite trucks, and push alerts when nearby." },
  { label: "Board game library", desc: "Collection, ratings, and game nights", gradient: "from-indigo-500/15 to-blue-500/15", icon: "🎲", prompt: "Build a board game library app with personal collection tracking, ratings, wishlist, and game night RSVP planner." },
  { label: "Smart home dashboard", desc: "Devices, scenes, and energy", gradient: "from-cyan-500/15 to-sky-500/15", icon: "🏡", prompt: "Create a smart home dashboard with device tiles, automation scenes, energy usage charts, and room grouping." },
  { label: "Grant application tracker", desc: "Deadlines, docs, and status", gradient: "from-emerald-500/15 to-green-500/15", icon: "📝", prompt: "Build a grant application tracker with deadline calendar, required documents checklist, submission status, and award tracking." },
  { label: "Influencer media kit", desc: "Stats, rates, and brand deals", gradient: "from-pink-500/15 to-rose-500/15", icon: "📱", prompt: "Create an influencer media kit site with audience stats, rate card, past brand collaborations, and contact form." },
  { label: "Coworking desk booking", desc: "Desks, rooms, and member portal", gradient: "from-slate-500/15 to-zinc-500/15", icon: "🖥️", prompt: "Build a coworking space app with hot-desk booking, meeting room reservations, member directory, and access pass QR codes." },
  { label: "Farm crop planner", desc: "Fields, seasons, and yields", gradient: "from-lime-500/15 to-emerald-500/15", icon: "🌾", prompt: "Create a farm crop planner with field maps, planting schedules, yield logs, and weather-aware task reminders." },
  { label: "Escape room booking", desc: "Rooms, teams, and time slots", gradient: "from-purple-500/15 to-violet-500/15", icon: "🔐", prompt: "Build an escape room booking site with room themes, team size selection, time slot calendar, and waiver capture." },
  { label: "Online course platform", desc: "Lessons, quizzes, and certificates", gradient: "from-blue-500/15 to-indigo-500/15", icon: "🎓", prompt: "Create an online course platform with video lessons, progress tracking, quizzes, discussion forums, and completion certificates." },
  { label: "Parking spot marketplace", desc: "List, book, and pay per hour", gradient: "from-gray-500/15 to-slate-500/15", icon: "🅿️", prompt: "Build a parking spot marketplace where owners list spots, drivers book hourly slots, and payments settle automatically." },
  { label: "Blood donation scheduler", desc: "Centers, appointments, and history", gradient: "from-red-500/15 to-rose-500/15", icon: "🩸", prompt: "Create a blood donation scheduler with nearby centers, appointment booking, donation history, and eligibility reminders." },
  { label: "Vintage marketplace", desc: "Listings, offers, and messaging", gradient: "from-amber-500/15 to-orange-500/15", icon: "🕰️", prompt: "Build a vintage marketplace with seller listings, offer/counter-offer messaging, saved searches, and condition grading." },
  { label: "Drone flight log", desc: "Flights, batteries, and compliance", gradient: "from-sky-500/15 to-blue-500/15", icon: "🛸", prompt: "Create a drone flight log with pre-flight checklists, battery cycle tracking, maintenance reminders, and export for compliance." },
  { label: "Meal prep planner", desc: "Recipes, macros, and prep day", gradient: "from-green-500/15 to-teal-500/15", icon: "🍱", prompt: "Build a meal prep planner with weekly recipe selection, macro totals, prep-day checklist, and container labeling." },
  { label: "Neighborhood watch", desc: "Incidents, map, and alerts", gradient: "from-orange-500/15 to-amber-500/15", icon: "🏘️", prompt: "Create a neighborhood watch app with incident reporting map, anonymous tips, community alerts, and moderator review." },
  { label: "Auction house catalog", desc: "Lots, bids, and live countdown", gradient: "from-yellow-500/15 to-amber-500/15", icon: "🔨", prompt: "Build an auction catalog with lot listings, live bid countdown, watchlist, and buyer registration workflow." },
  { label: "Yoga studio app", desc: "Classes, memberships, and waitlist", gradient: "from-teal-500/15 to-emerald-500/15", icon: "🧘‍♀️", prompt: "Create a yoga studio app with class schedule, membership plans, waitlist auto-promotion, and instructor bios." },
  { label: "Crypto portfolio tracker", desc: "Holdings, PnL, and alerts", gradient: "from-violet-500/15 to-purple-500/15", icon: "₿", prompt: "Build a crypto portfolio tracker with manual holdings entry, profit/loss charts, price alerts, and tax export CSV." },
  { label: "Film production call sheet", desc: "Crew, locations, and schedule", gradient: "from-zinc-500/15 to-neutral-500/15", icon: "🎬", prompt: "Create a film production call sheet app with crew contacts, location maps, daily schedule, and weather notes." },
  { label: "Babysitter marketplace", desc: "Profiles, bookings, and reviews", gradient: "from-pink-500/15 to-rose-500/15", icon: "👶", prompt: "Build a babysitter marketplace with verified profiles, availability calendar, booking requests, and parent reviews." },
  { label: "Wine cellar manager", desc: "Bottles, tasting notes, and value", gradient: "from-red-500/15 to-purple-500/15", icon: "🍷", prompt: "Create a wine cellar manager with bottle inventory, tasting notes, drink-by reminders, and estimated cellar value." },
  { label: "Running club hub", desc: "Routes, events, and leaderboards", gradient: "from-orange-500/15 to-red-500/15", icon: "🏃", prompt: "Build a running club hub with group run events, route maps, pace groups, and monthly distance leaderboards." },
  { label: "Tax document vault", desc: "Uploads, categories, and deadlines", gradient: "from-slate-500/15 to-gray-500/15", icon: "📁", prompt: "Create a tax document vault with secure uploads, category tagging, deadline reminders, and accountant share links." },
  { label: "Maker space tools", desc: "Equipment booking and training", gradient: "from-cyan-500/15 to-blue-500/15", icon: "🔧", prompt: "Build a maker space tool booking system with equipment certifications, time-slot reservations, and usage logs." },
  { label: "Language exchange", desc: "Partners, chat, and session goals", gradient: "from-indigo-500/15 to-violet-500/15", icon: "🗣️", prompt: "Create a language exchange app matching partners by language pair, session scheduling, and conversation topic prompts." },
  { label: "Sustainability tracker", desc: "Carbon, habits, and challenges", gradient: "from-green-500/15 to-lime-500/15", icon: "♻️", prompt: "Build a sustainability tracker with carbon footprint estimates, eco habit challenges, and community leaderboard." },
  { label: "Photo client gallery", desc: "Proofs, selections, and downloads", gradient: "from-fuchsia-500/15 to-pink-500/15", icon: "📷", prompt: "Create a photographer client gallery with proofing, favorite selections, watermark previews, and paid download unlock." },
  { label: "Hospital visitor pass", desc: "Check-in, badges, and capacity", gradient: "from-blue-500/15 to-teal-500/15", icon: "🏥", prompt: "Build a hospital visitor management app with pre-registration, digital visitor badges, ward capacity limits, and check-out logs." },
  { label: "Tutoring marketplace", desc: "Subjects, sessions, and payments", gradient: "from-violet-500/15 to-indigo-500/15", icon: "📖", prompt: "Create a tutoring marketplace with tutor profiles by subject, session booking, Stripe payments, and student progress notes." },
  { label: "Boat marina scheduler", desc: "Slips, maintenance, and billing", gradient: "from-sky-500/15 to-cyan-500/15", icon: "⛵", prompt: "Build a marina management app with slip assignments, maintenance work orders, seasonal billing, and owner notifications." },
  { label: "Quiz night host", desc: "Rounds, teams, and live scoring", gradient: "from-purple-500/15 to-fuchsia-500/15", icon: "❓", prompt: "Create a pub quiz host app with round builder, team registration, live scoring display, and answer reveal mode." },
  { label: "Employee onboarding", desc: "Tasks, docs, and buddy assign", gradient: "from-blue-500/15 to-slate-500/15", icon: "👋", prompt: "Build an employee onboarding portal with task checklists, document e-sign, buddy assignments, and HR progress dashboard." },
  { label: "Farmers market map", desc: "Vendors, products, and hours", gradient: "from-lime-500/15 to-green-500/15", icon: "🥕", prompt: "Create a farmers market map with vendor stalls, seasonal product tags, opening hours, and favorite vendor alerts." },
  { label: "Podcast listener app", desc: "Subscriptions, queues, and clips", gradient: "from-violet-500/15 to-purple-500/15", icon: "🎧", prompt: "Build a podcast listener app with show subscriptions, episode queue, playback speed, and shareable audio clips." },
  { label: "Home inventory insurance", desc: "Rooms, photos, and values", gradient: "from-stone-500/15 to-amber-500/15", icon: "📋", prompt: "Create a home inventory app for insurance with room-by-room item lists, photo proof, estimated values, and export PDF." },
  { label: "Dance studio enrollments", desc: "Classes, recitals, and costumes", gradient: "from-pink-500/15 to-rose-500/15", icon: "💃", prompt: "Build a dance studio enrollment system with class levels, recital planning, costume sizing, and parent payment portal." },
  { label: "Volunteer shift signup", desc: "Roles, hours, and certificates", gradient: "from-emerald-500/15 to-teal-500/15", icon: "🤝", prompt: "Create a volunteer shift signup app with role descriptions, hour logging, coordinator dashboard, and service certificates." },
  { label: "Smart budget for couples", desc: "Shared accounts and goals", gradient: "from-rose-500/15 to-pink-500/15", icon: "💑", prompt: "Build a couples budget app with shared expense categories, split transactions, joint savings goals, and monthly recap." },
  { label: "Micro-SaaS waitlist", desc: "Landing, email capture, and referrals", gradient: "from-indigo-500/15 to-blue-500/15", icon: "🚀", prompt: "Create a micro-SaaS waitlist landing page with email capture, referral leaderboard, feature voting, and launch countdown." },
  { label: "Clinic queue display", desc: "Tokens, wait times, and SMS", gradient: "from-cyan-500/15 to-teal-500/15", icon: "🩺", prompt: "Build a clinic queue system with patient token numbers, estimated wait times on a display board, and SMS when ready." },
  { label: "Book club organizer", desc: "Polls, notes, and meeting dates", gradient: "from-amber-500/15 to-orange-500/15", icon: "📚", prompt: "Create a book club organizer with book polls, discussion notes, meeting date voting, and reading progress tracker." },
  { label: "Personal wiki", desc: "Linked notes, tags, and search", gradient: "from-slate-500/15 to-zinc-500/15", icon: "📓", prompt: "Build a personal wiki with linked notes, tag filtering, full-text search, and daily note templates." },
  { label: "Fleet maintenance CMMS", desc: "Assets, work orders, and parts", gradient: "from-gray-500/15 to-slate-500/15", icon: "⚙️", prompt: "Create a CMMS for fleet maintenance with asset registry, preventive work orders, parts inventory, and technician mobile view." },
  { label: "Gift registry", desc: "Events, wish lists, and thank-yous", gradient: "from-pink-500/15 to-fuchsia-500/15", icon: "🎁", prompt: "Build a gift registry app with event pages, wish list items with purchase tracking, group gifting, and thank-you notes." },
  { label: "Surf spot forecast", desc: "Conditions, logs, and photos", gradient: "from-sky-500/15 to-cyan-500/15", icon: "🏄", prompt: "Create a surf spot app with swell forecasts, session logs, crowd ratings, and photo uploads per break." },
  { label: "Coding bootcamp portal", desc: "Cohorts, assignments, and grades", gradient: "from-blue-500/15 to-indigo-500/15", icon: "💻", prompt: "Build a coding bootcamp portal with cohort dashboards, assignment submissions, code review comments, and graduation tracker." },
  { label: "Museum audio guide", desc: "Exhibits, QR tours, and favorites", gradient: "from-violet-500/15 to-purple-500/15", icon: "🏛️", prompt: "Create a museum audio guide with exhibit QR codes, narrated tours, multilingual support, and saved favorites." },
  { label: "Parking violation appeals", desc: "Tickets, evidence, and status", gradient: "from-red-500/15 to-orange-500/15", icon: "🚫", prompt: "Build a parking ticket appeal portal with ticket lookup, evidence upload, appeal status timeline, and payment option." },
  { label: "Subscription analytics", desc: "MRR, churn, and cohorts", gradient: "from-emerald-500/15 to-green-500/15", icon: "📈", prompt: "Create a subscription analytics dashboard with MRR charts, churn rate, cohort retention, and plan mix breakdown." },
  { label: "Roommate expense split", desc: "Bills, balances, and settle up", gradient: "from-teal-500/15 to-cyan-500/15", icon: "🏠", prompt: "Build a roommate expense splitter with shared bills, balance tracking, settle-up reminders, and receipt photo attach." },
  { label: "Craft fair vendor app", desc: "Booths, sales, and inventory", gradient: "from-amber-500/15 to-yellow-500/15", icon: "🧶", prompt: "Create a craft fair vendor app with booth inventory, square-style checkout log, low-stock alerts, and daily sales summary." },
  { label: "Mental wellness journal", desc: "Mood, prompts, and insights", gradient: "from-purple-500/15 to-indigo-500/15", icon: "🧠", prompt: "Build a mental wellness journal with daily mood check-ins, guided prompts, trend insights, and private encryption messaging." },
  { label: "Airbnb host ops", desc: "Turnover, cleaners, and messages", gradient: "from-rose-500/15 to-pink-500/15", icon: "🏨", prompt: "Create an Airbnb host operations hub with turnover task lists, cleaner scheduling, guest message templates, and revenue calendar." },
  { label: "Soccer training drills", desc: "Plans, videos, and progress", gradient: "from-green-500/15 to-lime-500/15", icon: "⚽", prompt: "Build a soccer training app with drill library, weekly practice plans, video demos, and player skill progress tracking." },
  { label: "Compliance training LMS", desc: "Courses, quizzes, and certs", gradient: "from-slate-500/15 to-gray-500/15", icon: "📜", prompt: "Create a compliance training LMS with assigned courses, timed quizzes, completion certificates, and admin audit reports." },
  { label: "Pop-up shop locator", desc: "Brands, dates, and map pins", gradient: "from-fuchsia-500/15 to-pink-500/15", icon: "🛒", prompt: "Build a pop-up shop locator with brand profiles, date ranges, map pins, and notify-me when a brand is nearby." },
  { label: "Personal CRM for networking", desc: "Contacts, follow-ups, and tags", gradient: "from-blue-500/15 to-violet-500/15", icon: "🤵", prompt: "Create a personal networking CRM with contact cards, last-met context, follow-up reminders, and conference tag grouping." },
  { label: "Solar install proposal", desc: "Quotes, savings, and signatures", gradient: "from-yellow-500/15 to-amber-500/15", icon: "☀️", prompt: "Build a solar installation proposal tool with roof input, savings calculator, PDF quote generation, and e-signature flow." },
  { label: "Kids chore rewards", desc: "Tasks, points, and redemptions", gradient: "from-lime-500/15 to-green-500/15", icon: "⭐", prompt: "Create a kids chore app with task assignments, point rewards, redemption store, and parent approval workflow." },
  { label: "Open mic signup", desc: "Slots, order, and performer bios", gradient: "from-violet-500/15 to-purple-500/15", icon: "🎤", prompt: "Build an open mic signup app with time slot registration, running order display, performer bios, and host admin controls." },
  { label: "Fleet EV charging map", desc: "Stations, availability, and routes", gradient: "from-cyan-500/15 to-teal-500/15", icon: "🔌", prompt: "Create an EV charging map with station availability, route planner with charge stops, favorites, and session cost log." },
  { label: "Wedding photo proofing", desc: "Albums, picks, and comments", gradient: "from-rose-500/15 to-pink-500/15", icon: "📸", prompt: "Build a wedding photo proofing portal with album galleries, client favorites, comment threads, and download package builder." },
  { label: "Neighborhood tool library", desc: "Borrow, return, and availability", gradient: "from-emerald-500/15 to-green-500/15", icon: "🔩", prompt: "Create a neighborhood tool library with item catalog, borrow/return scheduling, deposit tracking, and damage report flow." },
  { label: "Startup investor update", desc: "Metrics, deck, and subscribers", gradient: "from-indigo-500/15 to-blue-500/15", icon: "📊", prompt: "Build an investor update portal with monthly metrics dashboard, embedded deck links, subscriber list, and archive." },
  { label: "Campus event board", desc: "Clubs, RSVPs, and calendar sync", gradient: "from-purple-500/15 to-violet-500/15", icon: "🎓", prompt: "Create a campus event board with club listings, RSVP counts, calendar export, and moderator approval for new events." },
  { label: "Personal stock watchlist", desc: "Symbols, alerts, and news", gradient: "from-green-500/15 to-emerald-500/15", icon: "📉", prompt: "Build a personal stock watchlist with price alerts, mini charts, earnings calendar, and curated news feed per symbol." },
  { label: "Mobile car wash booking", desc: "Packages, zones, and dispatch", gradient: "from-sky-500/15 to-blue-500/15", icon: "🚿", prompt: "Create a mobile car wash booking app with service packages, service area map, time slots, and driver dispatch dashboard." },
  { label: "Fan club membership", desc: "Tiers, perks, and community", gradient: "from-pink-500/15 to-rose-500/15", icon: "🌟", prompt: "Build a fan club membership site with tiered perks, exclusive content feed, member forum, and merch discount codes." },
  { label: "Smart pantry", desc: "Expiry, recipes, and shopping", gradient: "from-orange-500/15 to-amber-500/15", icon: "🥫", prompt: "Create a smart pantry app with barcode scanning, expiry alerts, recipe suggestions from on-hand items, and shopping list sync." },
  { label: "Remote team standup", desc: "Async updates and blockers", gradient: "from-blue-500/15 to-indigo-500/15", icon: "👥", prompt: "Build an async standup app with daily what-done/plan/blockers prompts, team timeline, and blocker escalation tags." },
  { label: "Local service marketplace", desc: "Plumbers, reviews, and quotes", gradient: "from-teal-500/15 to-cyan-500/15", icon: "🔧", prompt: "Create a local services marketplace with provider profiles, quote requests, reviews, and job status tracking." },
  { label: "Birthday party planner", desc: "Guests, vendors, and checklist", gradient: "from-fuchsia-500/15 to-pink-500/15", icon: "🎂", prompt: "Build a birthday party planner with guest RSVP, vendor contacts, theme checklist, and budget tracker." },
  { label: "Aquarium maintenance log", desc: "Water tests, dosing, and livestock", gradient: "from-cyan-500/15 to-blue-500/15", icon: "🐠", prompt: "Create an aquarium maintenance log with water parameter tests, dosing schedule, livestock inventory, and equipment reminders." },
  { label: "Freight quote calculator", desc: "Lanes, weight, and instant rates", gradient: "from-slate-500/15 to-gray-500/15", icon: "📦", prompt: "Build a freight quote calculator with lane inputs, weight/dimension rules, instant rate estimates, and saved quote PDF export." },
  { label: "Community garden plots", desc: "Assignments, fees, and rules", gradient: "from-lime-500/15 to-green-500/15", icon: "🌻", prompt: "Create a community garden manager with plot assignments, annual fees, waitlist, and shared tool checkout calendar." },
  { label: "Nightlife guest list", desc: "Promoters, venues, and check-in", gradient: "from-violet-500/15 to-fuchsia-500/15", icon: "🎉", prompt: "Build a nightlife guest list app with promoter links, venue capacity, QR check-in, and door staff scanner view." },
  { label: "Personal knowledge base", desc: "SOPs, search, and versioning", gradient: "from-zinc-500/15 to-neutral-500/15", icon: "📚", prompt: "Create a personal knowledge base for SOPs with rich text pages, full-text search, version history, and pin favorites." },
  { label: "Smart appointment router", desc: "Intake, triage, and booking", gradient: "from-blue-500/15 to-teal-500/15", icon: "📅", prompt: "Build a smart appointment router with intake questionnaire, triage rules, specialist booking, and confirmation SMS." },
];

export const APP_IDEA_POOL: AppIdeaPrompt[] = [...CORE_APP_IDEA_POOL, ...ALL_EXPANDED_APP_IDEAS];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable seed for SSR + first client paint (avoids hydration mismatch). */
export const SSR_HOME_IDEAS_SEED = "vodex-home-ideas-v1";

/** Pick `count` unique ideas — stable per page load via session seed, different each refresh. */
export function pickRandomAppIdeas(count: number, seed?: string): AppIdeaPrompt[] {
  const sessionSeed =
    seed ??
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("vodex.ideaSeed")
      : null) ??
    SSR_HOME_IDEAS_SEED;

  if (typeof sessionStorage !== "undefined" && !seed) {
    sessionStorage.setItem("vodex.ideaSeed", sessionSeed);
  }

  const pool = [...APP_IDEA_POOL];
  let state = hashSeed(sessionSeed);
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, Math.min(count, pool.length));
}

export function pickComposerChipIdeas(
  count: number,
  seed?: string,
): Array<{ label: string; prompt: string }> {
  return pickRandomAppIdeas(count, seed).map(({ label, prompt }) => ({ label, prompt }));
}
