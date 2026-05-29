import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Alias /signup?ref=… → /auth/signup (preserves query). */
export default async function SignupAliasPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) val.forEach((v) => q.append(key, v));
    else q.set(key, val);
  }
  const suffix = q.toString();
  redirect(suffix ? `/auth/signup?${suffix}` : "/auth/signup");
}
