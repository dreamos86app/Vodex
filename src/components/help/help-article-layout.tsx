import Link from "next/link";
import { ChevronLeft, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { renderHelpMarkdown } from "@/lib/help-markdown";
import { HelpDocBody } from "@/components/help/help-doc-body";
import { HelpArticleClient } from "@/components/help/help-article-client";
import type { HelpArticle } from "@/lib/help/cms/types";
import { getRelatedArticles } from "@/lib/help/cms/registry";
import { helpArticlePath, helpCategoryPath } from "@/lib/help/cms/paths";
import { HELP_CATEGORIES } from "@/lib/help/cms/categories";

export function HelpArticleLayout({
  article,
  projectId,
}: {
  article: HelpArticle;
  projectId?: string;
}) {
  const html = renderHelpMarkdown(article.content);
  const related = getRelatedArticles(article);
  const href = helpArticlePath(article);
  const categoryMeta = HELP_CATEGORIES.find((c) => c.slug === article.categorySlug);

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <div className="mb-6 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/help" className="flex items-center gap-1 transition hover:text-foreground">
          <ChevronLeft className="size-3" />
          Help Center
        </Link>
        <span>/</span>
        <Link href={helpCategoryPath(article.categorySlug)} className="hover:text-foreground">
          {categoryMeta?.title ?? article.category}
        </Link>
        <span>/</span>
        <span className="text-foreground">{article.title}</span>
      </div>

      <div className="flex gap-10">
        <main className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
              {article.category}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
              {article.difficulty}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" strokeWidth={1.75} />
              {article.readMinutes} min
            </span>
            {article.lastUpdated ? (
              <span className="text-[10px] text-muted-foreground">Updated {article.lastUpdated}</span>
            ) : null}
          </div>

          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.05em] text-foreground">
            {article.title}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">{article.description}</p>

          <HelpArticleClient
            href={href}
            title={article.title}
            category={article.category}
            providerId={article.slug}
            projectId={projectId}
            checklist={article.checklist}
          />

          <HelpDocBody html={html} />

          {article.officialDocsUrl ? (
            <p className="mt-8 text-[13px]">
              <a
                href={article.officialDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Official provider documentation
                <ExternalLink className="size-3.5" />
              </a>
            </p>
          ) : null}

          {related.length > 0 ? (
            <div className="mt-10 rounded-xl bg-muted/20 p-4 ring-1 ring-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Related articles
              </p>
              <ul className="mt-2 space-y-1">
                {related.map((r) => (
                  <li key={helpArticlePath(r)}>
                    <Link
                      href={helpArticlePath(r)}
                      className="flex items-center gap-1 text-[13px] text-accent hover:underline"
                    >
                      <ArrowRight className="size-3" />
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </main>

        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            {article.sections?.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-[12px] text-muted-foreground hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
