import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import { getDoc } from "@/lib/docs";
import { getHelpArticleByLegacySlug } from "@/lib/help/cms/registry";
import { helpArticlePath } from "@/lib/help/cms/paths";
import { renderHelpMarkdown } from "@/lib/help-markdown";
import { HelpDocBody } from "@/components/help/help-doc-body";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { DOCS } = await import("@/lib/docs");
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const migrated = getHelpArticleByLegacySlug(slug);
  if (migrated) return { title: `${migrated.title} Help` };
  const doc = getDoc(slug);
  if (!doc) return {};
  return { title: `${doc.title} Help`, description: doc.description };
}

export default async function HelpDocPage({ params }: Props) {
  const { slug } = await params;
  const migrated = getHelpArticleByLegacySlug(slug);
  if (migrated) redirect(helpArticlePath(migrated));

  const doc = getDoc(slug);
  if (!doc) notFound();

  const html = renderHelpMarkdown(doc.content);

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="mb-6 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/help" className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-3" />
          Help Center
        </Link>
        <span>/</span>
        <span className="text-foreground">{doc.title}</span>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
          {doc.category}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {doc.readMinutes} min
        </span>
      </div>
      <h1 className="text-2xl font-semibold text-foreground">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{doc.description}</p>
      <HelpDocBody html={html} />
    </div>
  );
}
