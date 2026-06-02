-- P1.6: expanded status components, multi-banner gradients, schema reload
-- After applying: NOTIFY pgrst, 'reload schema';

alter table public.platform_announcements
  add column if not exists priority int not null default 100,
  add column if not exists banner_type text not null default 'incident',
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists text_color text default '#ffffff',
  add column if not exists icon_type text default 'alert';

alter table public.platform_announcements drop constraint if exists platform_announcements_severity_check;
alter table public.platform_announcements add constraint platform_announcements_severity_check
  check (severity in ('info', 'warning', 'incident', 'maintenance', 'outage', 'sale', 'success'));

alter table public.platform_announcements drop constraint if exists platform_announcements_banner_type_check;
alter table public.platform_announcements add constraint platform_announcements_banner_type_check
  check (banner_type in ('incident', 'sale', 'maintenance', 'info', 'success', 'warning'));

create index if not exists platform_announcements_active_priority_idx
  on public.platform_announcements (is_active, priority asc, starts_at desc);

-- P1.6 component catalog (upsert by key)
insert into public.status_components (key, name, group_name, description, sort_order) values
  ('platform', 'Platform', 'Core Platform', 'Core Vodex web application', 110),
  ('login', 'Login / Authentication', 'Core Platform', 'Sign-in and session services', 120),
  ('dashboard', 'Dashboard', 'Core Platform', 'Home dashboard and navigation', 130),
  ('admin_panel', 'Admin Panel', 'Core Platform', 'Owner administration tools', 140),
  ('ai_builder', 'AI Builder', 'Builder', 'AI-assisted app builder workspace', 210),
  ('app_generation', 'App Generation', 'Builder', 'End-to-end app generation pipeline', 220),
  ('build_queue', 'Build Queue', 'Builder', 'Queued and background builds', 230),
  ('edit_mode', 'Edit Mode', 'Builder', 'Surgical edit and refinement', 240),
  ('preview_rendering', 'Preview Rendering', 'Builder', 'Live preview iframe rendering', 250),
  ('code_export', 'Code Export', 'Builder', 'Export and deploy artifacts', 260),
  ('supabase', 'Database / Supabase', 'Infrastructure', 'Postgres, auth, and storage', 310),
  ('file_storage', 'File Storage', 'Infrastructure', 'Project file persistence', 320),
  ('images_serving', 'Images Serving', 'Infrastructure', 'Static assets and media CDN', 330),
  ('vercel_hosting', 'Hosting / Vercel', 'Infrastructure', 'Production hosting and edge', 340),
  ('published_apps', 'Published Applications', 'Infrastructure', 'Public published apps', 350),
  ('paddle_checkout', 'Paddle Checkout', 'Billing', 'Subscription checkout', 410),
  ('subscription_sync', 'Subscription Sync', 'Billing', 'Webhook and plan sync', 420),
  ('credits_usage', 'Credits / Usage', 'Billing', 'Credit metering and balances', 430),
  ('upgrade_flow', 'Upgrade Flow', 'Billing', 'Plan upgrades and previews', 440),
  ('email_resend', 'Email / Resend', 'Communications', 'Transactional email delivery', 510),
  ('notifications', 'Notifications', 'Communications', 'In-app and email notifications', 520),
  ('discord_community', 'Discord Community', 'Communications', 'Community Discord server', 530),
  ('openai', 'OpenAI', 'AI Services', 'OpenAI model provider', 610),
  ('anthropic', 'Anthropic', 'AI Services', 'Claude model provider', 620),
  ('google_gemini', 'Google Gemini', 'AI Services', 'Gemini model provider', 630),
  ('image_generation', 'Image Generation', 'AI Services', 'Image and icon generation', 640)
on conflict (key) do update set
  name = excluded.name,
  group_name = excluded.group_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Legacy keys mapped to new groups where applicable
update public.status_components set group_name = 'Builder', sort_order = 215 where key = 'app_builder';
update public.status_components set group_name = 'Builder', sort_order = 255 where key = 'app_preview';
update public.status_components set group_name = 'AI Services', sort_order = 615 where key = 'ai_generation';

notify pgrst, 'reload schema';
