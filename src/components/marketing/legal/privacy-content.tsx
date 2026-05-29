import { LegalParagraph, LegalProse, LegalSection } from "@/components/marketing/legal-document";
import Link from "next/link";

export function PrivacyContent() {
  return (
    <LegalProse>
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Effective date: May 2026
      </p>
      <h1 className="mt-2 text-balance text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        Privacy Policy
      </h1>
      <p className="mt-4 text-muted-foreground">
        This Privacy Policy explains how DreamOS86 (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses,
        and shares information when you use our website, platform, and related services (the &quot;Service&quot;). By using
        the Service, you agree to this policy.
      </p>

      <LegalSection title="1. Information we collect">
        <LegalParagraph>
          <strong className="text-foreground">Account information.</strong> When you register, we collect identifiers
          such as your email address, display name, and authentication metadata from our auth provider (Supabase Auth).
          OAuth sign-in may provide your name and profile image from Google or GitHub.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Workspace and profile data.</strong> Dream Space name, workspace
          description, avatar, plan, token balance, onboarding answers, and settings you save in the product.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Prompts and generated content.</strong> Messages you send in AI Chat,
          Create/Build flows, project files, conversation history, build jobs, and publish configuration.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Uploads.</strong> Images and files you upload (for example, avatars,
          workspace icons, chat attachments, imported ZIPs).
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Usage and technical data.</strong> Logs of feature usage, token
          consumption, errors, IP address, browser type, device information, and cookies or similar technologies used for
          session management.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Payment data.</strong> If you purchase a DreamOS86 paid plan, payment
          details are processed by our platform billing provider (for example, Paddle or Stripe). We receive subscription
          status and billing identifiers, not full card numbers. If you connect payment providers for a generated app, we
          may store connection metadata, encrypted API keys, product mappings, and webhook events needed for billing health,
          entitlements, and fraud prevention. We do not intentionally expose raw payment secrets to clients.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Contact and sales inquiries.</strong> Information you submit through contact
          or sales forms (name, email, company, message).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. How we use information">
        <LegalParagraph>
          We use information to provide and improve the Service; authenticate users; generate and store apps; charge
          tokens fairly; host previews; process payments; send transactional notices; prevent abuse; comply with law; and
          communicate product updates. We do not sell your personal information.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-foreground">Marketing emails (optional).</strong> If you opt in during checkout or in
          account settings, DreamOS86 may send product updates, onboarding tips, offers, and other marketing emails. Marketing
          consent is optional. We do not send marketing emails unless you opted in. You may unsubscribe or opt out at any time
          using the link in our emails or by contacting support. We may still send transactional and service emails for your
          account, billing, security, product operation, and support even if you opt out of marketing.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. AI provider processing">
        <LegalParagraph>
          To generate Output, we send prompts and relevant context to AI providers such as OpenAI, Anthropic, and Google
          (Gemini), depending on the model you select and which keys are configured on our servers. Those providers
          process data under their own terms and privacy policies. Do not submit sensitive personal data in prompts unless
          you accept that risk.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Infrastructure and subprocessors">
        <LegalParagraph>
          We rely on trusted providers to operate the Service, including:
        </LegalParagraph>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Supabase</strong> — authentication, database, storage, and realtime
            features.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — hosting, deployment, and performance analytics (Speed
            Insights).
          </li>
          <li>
            <strong className="text-foreground">AI providers</strong> — model inference as described above.
          </li>
          <li>
            <strong className="text-foreground">Paddle</strong> — DreamOS86 subscription checkout and billing (when enabled).
            Paddle may collect optional marketing consent at checkout; we store your preference when provided.
          </li>
          <li>
            <strong className="text-foreground">Stripe</strong> — legacy payments when enabled.
          </li>
          <li>
            <strong className="text-foreground">Email providers</strong> (for example, Resend) — transactional email when
            configured.
          </li>
        </ul>
        <LegalParagraph>
          These providers may process data in the United States and other countries. We choose providers with
          industry-standard security practices but cannot control their independent compliance programs.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Cookies and sessions">
        <LegalParagraph>
          We use cookies and local storage to keep you signed in, remember preferences, and protect against abuse.
          Session cookies are essential for authentication. You can control non-essential cookies through your browser,
          but some features may not work without them.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Secrets and API keys">
        <LegalParagraph>
          Project secrets you store in DreamOS86 are kept server-side and used only for operations you authorize (for
          example, deployments and integrations). We do not intentionally expose secrets in public previews or client-side
          bundles. You are responsible for the secrets you add and for revoking keys that are no longer needed.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Sharing of information">
        <LegalParagraph>
          We share information with subprocessors listed above, when required by law, to protect rights and safety, or
          with your direction (for example, publishing an app or connecting GitHub). We do not share personal information
          with advertisers for cross-context behavioral advertising.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Retention">
        <LegalParagraph>
          We retain account and project data while your account is active and for a reasonable period afterward for
          backups, legal compliance, and dispute resolution. You may request deletion of your account through settings;
          some logs may persist in aggregated or backup form for limited periods.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Security">
        <LegalParagraph>
          We use encryption in transit (HTTPS), access controls, and service-role isolation for server operations.
          No method of transmission or storage is 100% secure; report suspected issues via our{" "}
          <Link href="/contact" className="text-accent hover:underline underline-offset-4">
            contact form
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <LegalParagraph>
          Depending on your location, you may have rights to access, correct, delete, or export personal data, and to
          object to or restrict certain processing. Contact us to exercise these rights. If you are in the EEA/UK, you
          may lodge a complaint with your supervisory authority.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="11. Children">
        <LegalParagraph>
          The Service is not directed to children under 13. We do not knowingly collect personal information from
          children. If you believe a child has provided data, contact us and we will delete it.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="12. International users">
        <LegalParagraph>
          DreamOS86 is operated from the United States. If you access the Service from other regions, your information may
          be transferred to and processed in the U.S. and other countries where our providers operate.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <LegalParagraph>
          We may update this Privacy Policy from time to time. We will post the revised policy on this page and update
          the effective date. Material changes may be communicated by email or in-product notice.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="14. Contact">
        <LegalParagraph>
          Privacy questions: use our{" "}
          <Link href="/contact" className="text-accent hover:underline underline-offset-4">
            contact form
          </Link>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalProse>
  );
}
