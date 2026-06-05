import { notFound, redirect } from "next/navigation";
import { getHelpArticle, HELP_ARTICLES } from "@/lib/help/cms/registry";
import { HelpArticleLayout } from "@/components/help/help-article-layout";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ category: a.categorySlug, slug: a.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { category, slug } = await params;
  const article = getHelpArticle(category, slug);
  if (!article) return {};
  return { title: `${article.title} — Help`, description: article.description };
}

export default async function HelpArticlePage({ params }: Props) {
  const { category, slug } = await params;
  const article = getHelpArticle(category, slug);
  if (!article) notFound();
  return <HelpArticleLayout article={article} />;
}
