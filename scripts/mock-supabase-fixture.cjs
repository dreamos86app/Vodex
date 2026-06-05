const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = path.join(__dirname, "..");
const dataPath = path.join(__dirname, ".live-cert-data.json");
const filesPath = path.join(__dirname, ".live-cert-files.json");

function unwrap(v) {
  if (v && typeof v === "object" && Array.isArray(v.value)) return v.value[0] ?? null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}
const raw = readJson(dataPath);
const files = readJson(filesPath);
const snapPath = path.join(__dirname, ".live-cert-snapshot.json");
const snapshot = fs.existsSync(snapPath) ? readJson(snapPath) : null;
const project = unwrap(raw.project);
const projectId = project.id;
const ownerId = project.owner_id;
const publishedRaw = unwrap(raw.published);
const published = publishedRaw
  ? {
      ...publishedRaw,
      project_id: publishedRaw.project_id ?? projectId,
      status: publishedRaw.status ?? "published",
      snapshot_files: snapshot ?? publishedRaw.snapshot_files,
    }
  : null;
const auth = unwrap(raw.auth);
const integrations = unwrap(raw.integrations) ?? raw.integrations;
const integrationRows = Array.isArray(integrations?.value) ? integrations.value : Array.isArray(integrations) ? integrations : [];

function chain(rows, filters = {}) {
  let result = [...rows];
  const api = {
    select() {
      return api;
    },
    eq(col, val) {
      result = result.filter((r) => r[col] === val);
      return api;
    },
    order() {
      return api;
    },
    limit(n) {
      result = result.slice(0, n);
      return api;
    },
    maybeSingle: async () => ({ data: result[0] ?? null, error: null }),
    single: async () => ({ data: result[0] ?? null, error: null }),
    then(resolve) {
      return Promise.resolve({ data: result, error: null, count: result.length }).then(resolve);
    },
  };
  return api;
}

function createFixtureClient() {
  return {
    from(table) {
      if (table === "projects") {
        return chain([project]);
      }
      if (table === "app_files") {
        return {
          select() {
            return this;
          },
          eq(_c, val) {
            this._pid = val;
            return this;
          },
          or(_filter) {
            this._priority = true;
            return this;
          },
          order() {
            return this;
          },
          limit(n) {
            this._limit = n;
            return this;
          },
          async then(resolve) {
            const limit = this._limit ?? files.length;
            const rows = this._priority
              ? files.filter((f) =>
                  /\/page\.(tsx|jsx)$/i.test(f.path) ||
                  /index\.html$/i.test(f.path) ||
                  f.path === "package.json" ||
                  /^src\/pages\//i.test(f.path) ||
                  /^src\/App\./i.test(f.path) ||
                  /^src\/main\./i.test(f.path),
                ).slice(0, limit)
              : files.slice(0, limit);
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          },
        };
      }
      if (table === "published_apps") {
        const row = published ? { ...published, status: published.status ?? "published" } : null;
        return chain(row ? [row] : []);
      }
      if (table === "app_auth_provider_settings") {
        return chain(auth ? [auth] : []);
      }
      if (table === "app_integration_connections") {
        return chain(integrationRows);
      }
      if (table === "app_user_profiles" || table === "app_analytics_events" || table === "app_payment_events") {
        return {
          select(_cols, opts) {
            this._head = opts?.head;
            return this;
          },
          eq() {
            return this;
          },
          limit: async () => ({ data: [{ id: "probe" }], error: null }),
          maybeSingle: async () => ({ data: null, error: null, count: 0 }),
          then(resolve) {
            if (this._head) {
              return Promise.resolve({ data: null, error: null, count: 0 }).then(resolve);
            }
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
      }
      if (table === "mobile_app_configs") {
        return chain([]);
      }
      return chain([]);
    },
  };
}

const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request.includes("supabase") && request.includes("admin")) {
    return {
      createServiceRoleClient: () => createFixtureClient(),
      createSupabaseAdmin: () => createFixtureClient(),
    };
  }
  return original.apply(this, arguments);
};

module.exports = { projectId, ownerId, project, published, auth };
