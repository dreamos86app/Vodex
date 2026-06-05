export type HelpDifficulty = "beginner" | "intermediate" | "advanced";

export type HelpChecklistItem = {
  id: string;
  label: string;
};

export type HelpArticleSection = {
  id: string;
  title: string;
};

/** Structured help article — editable CMS record. */
export type HelpArticle = {
  slug: string;
  categorySlug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  difficulty: HelpDifficulty;
  keywords?: string[];
  relatedSlugs?: string[];
  officialDocsUrl?: string;
  checklist?: HelpChecklistItem[];
  sections?: HelpArticleSection[];
  lastUpdated?: string;
  content: string;
  /** Legacy flat slug for /help/docs/[slug] redirects */
  legacySlug?: string;
};

export type HelpCategory = {
  slug: string;
  title: string;
  description: string;
  icon: string;
};
