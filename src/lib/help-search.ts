import { HELP_ARTICLES } from "@/lib/help/cms/registry";
import { helpArticlePath } from "@/lib/help/cms/paths";
import type { HelpArticle } from "@/lib/help/cms/types";

export type HelpSearchHit = {
  slug: string;
  href: string;
  title: string;
  description: string;
  category: string;
  score: number;
  snippet?: string;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function articleSearchBlob(doc: HelpArticle): string {
  return normalize(
    [doc.title, doc.description, doc.category, ...(doc.keywords ?? []), doc.content].join(" "),
  );
}

export function searchHelpArticles(query: string, limit = 12): HelpSearchHit[] {
  const q = normalize(query);
  if (!q) return [];

  const terms = q.split(" ").filter(Boolean);
  const hits: HelpSearchHit[] = [];

  for (const doc of HELP_ARTICLES) {
    const blob = articleSearchBlob(doc);
    let score = 0;
    for (const term of terms) {
      if (normalize(doc.title).includes(term)) score += 8;
      if (normalize(doc.description).includes(term)) score += 4;
      if ((doc.keywords ?? []).some((k) => normalize(k).includes(term))) score += 6;
      if (blob.includes(term)) score += 2;
    }
    if (score <= 0) continue;
    hits.push({
      slug: `${doc.categorySlug}/${doc.slug}`,
      href: helpArticlePath(doc),
      title: doc.title,
      description: doc.description,
      category: doc.category,
      score,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export { getAllHelpArticleLinks } from "@/lib/help/cms/registry";
