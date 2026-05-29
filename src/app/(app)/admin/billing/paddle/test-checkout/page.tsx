import { AdminPaddleTestCheckout } from "@/components/admin/admin-paddle-test-checkout";

export default function AdminPaddleTestCheckoutPage() {
  return (
    <div className="dashboard-shell mx-auto max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Owner live checkout test</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Production Paddle checkout — verifies pri_* price IDs, custom_data, and webhook entitlements.
        </p>
      </div>
      <AdminPaddleTestCheckout />
    </div>
  );
}
