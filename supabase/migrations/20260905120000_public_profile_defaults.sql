-- Public builder profiles on by default; apps on profile shown unless opted out.
alter table public.profiles
  alter column public_profile_enabled set default true;

alter table public.profiles
  alter column show_apps_on_profile set default true;

update public.profiles
set public_profile_enabled = true
where public_profile_enabled is null;

update public.profiles
set show_apps_on_profile = coalesce(show_apps_on_profile, true)
where show_apps_on_profile is null;
