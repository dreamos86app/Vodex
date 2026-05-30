import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dreamosStripeBillingDisabledResponse } from "@/lib/billing/dreamos-billing-provider";

export const dynamic = "force-dynamic";

export async function POST() {
  const blocked = dreamosStripeBillingDisabledResponse();
  if (blocked) return blocked;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Require Stripe secret key
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Billing portal is not configured. Set STRIPE_SECRET_KEY to enable it." },
      { status: 503 },
    );
  }

  // Get the profile to find the Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found for this account. Please subscribe to a plan first." },
      { status: 404 },
    );
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" });

    const { getAppUrl } = await import("@/lib/app-url");
    const appUrl = getAppUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[billing/portal]", message);
    return NextResponse.json({ error: "Failed to create billing portal session." }, { status: 500 });
  }
}
