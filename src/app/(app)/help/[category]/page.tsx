import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import { getCategory } from "@/lib/help/cms/categories";
import { getArticlesByCategorySlug } from "@/lib/help/cms/registry";
import { helpArticlePath, helpCategoryPath } from "@/lib/help/cms/paths";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const { HELP_CATEGORIES } = await import("@/lib/help/cms/categories");
  return HELP_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return {};
  return { title: `${cat.title} — Help`, description: cat.description };
}

export default async function HelpCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const articles = getArticlesByCategorySlug(category);

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-6 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/help" className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-3" />
          Help Center
        </Link>
        <span>/</span>
        <span className="text-foreground">{cat.title}</span>
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{cat.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{cat.description}</p>

      <ul className="mt-8 space-y-3">
        {articles.map((a) => (
          <li key={helpArticlePath(a)}>
            <Link
              href={helpArticlePath(a)}
              className="block rounded-xl bg-background p-4 ring-1 ring-border transition hover:ring-accent/30"
            >
              <p className="font-medium text-foreground">{a.title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{a.description}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {a.readMinutes} min · {a.difficulty}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[12px] text-muted-foreground">
        Browse all categories on the{" "}
        <Link href="/help" className="text-accent hover:underline">
          Help Center home
        </Link>
        .
      </p>
    </div>
  );
}
