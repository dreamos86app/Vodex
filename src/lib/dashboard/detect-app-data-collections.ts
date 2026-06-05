import "server-only";

export type AppDataCollection = {
  name: string;
  source: "import" | "migration" | "schema" | "metadata";
  fieldCount: number;
  recordCount: number | null;
  lastUpdated: string | null;
  permissionStatus: "protected" | "public" | "unknown";
  fields: string[];
};

const INTERNAL_TABLE_DENY = /^(admin_|platform_|vodex_|zip_preview_|credit_|billing_)/i;

export function detectAppDataCollections(input: {
  files: Array<{ path: string; content: string }>;
  metadata?: Record<string, unknown>;
}): AppDataCollection[] {
  const collections = new Map<string, AppDataCollection>();

  for (const file of input.files) {
    if (!/\.(sql|ts|tsx|js|jsx|json)$/i.test(file.path)) continue;

    if (file.path.endsWith(".sql")) {
      const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(file.content))) {
        const name = m[1];
        if (INTERNAL_TABLE_DENY.test(name)) continue;
        const body = m[2];
        const fields = body
          .split(",")
          .map((l) => l.trim().split(/\s+/)[0]?.replace(/"/g, ""))
          .filter((f) => f && !/^(primary|unique|foreign|check|constraint)/i.test(f));
        collections.set(name, {
          name,
          source: "migration",
          fieldCount: fields.length,
          recordCount: null,
          lastUpdated: null,
          permissionStatus: "protected",
          fields: fields.slice(0, 20),
        });
      }
    }

    if (/entities|collections|data.?model/i.test(file.path)) {
      try {
        const json = JSON.parse(file.content) as Record<string, unknown>;
        const entities = (json.entities ?? json.collections ?? json.tables) as Record<string, unknown> | undefined;
        if (entities && typeof entities === "object") {
          for (const [name, def] of Object.entries(entities)) {
            const fields =
              def && typeof def === "object" && "fields" in def && Array.isArray((def as { fields: unknown }).fields)
                ? ((def as { fields: Array<{ name?: string }> }).fields).map((f) => f.name ?? "field")
                : Object.keys(def as object);
            collections.set(name, {
              name,
              source: "schema",
              fieldCount: fields.length,
              recordCount: null,
              lastUpdated: null,
              permissionStatus: "unknown",
              fields: fields.slice(0, 20),
            });
          }
        }
      } catch {
        /* not json */
      }
    }
  }

  const importMeta = input.metadata?.import;
  if (importMeta && typeof importMeta === "object") {
    const deps = (importMeta as { dependencies?: { has_supabase?: boolean } }).dependencies;
    if (deps?.has_supabase && !collections.has("supabase_tables")) {
      collections.set("supabase_tables", {
        name: "Supabase tables",
        source: "import",
        fieldCount: 0,
        recordCount: null,
        lastUpdated: null,
        permissionStatus: "protected",
        fields: ["Connect Supabase to inspect live rows"],
      });
    }
  }

  return [...collections.values()].sort((a, b) => a.name.localeCompare(b.name));
}
