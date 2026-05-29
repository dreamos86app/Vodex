/**
 * Help Center markdown → HTML (links processed before Tailwind bracket classes).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTableSeparatorRow(row: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(row.trim());
}

function parseTableRow(row: string): string[] {
  return row
    .trim()
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function renderMarkdownTableBlock(tableLines: string[]): string {
  if (tableLines.length < 2) return tableLines.join("\n");

  const headerCells = parseTableRow(tableLines[0]);
  const bodyStart = isTableSeparatorRow(tableLines[1]) ? 2 : 1;
  const bodyRows = tableLines.slice(bodyStart).filter((line) => line.trim().startsWith("|"));

  const th = headerCells
    .map(
      (cell, i) =>
        `<th scope="col" class="help-doc-th ${i === 0 ? "help-doc-th-plan" : "help-doc-th-num"}">${cell}</th>`,
    )
    .join("");

  const trs = bodyRows
    .map((row) => {
      const cells = parseTableRow(row);
      return `<tr class="help-doc-tr">${cells
        .map(
          (cell, i) =>
            `<td class="help-doc-td ${i === 0 ? "help-doc-td-plan" : "help-doc-td-num"}">${cell}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");

  return `<div class="help-doc-table-wrap"><table class="help-doc-table"><thead><tr class="help-doc-tr">${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function extractMarkdownTables(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim().startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        block.push(lines[i]);
        i += 1;
      }
      out.push(renderMarkdownTableBlock(block));
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }

  return out.join("\n");
}

export function renderHelpMarkdown(md: string): string {
  const codeBlocks: string[] = [];

  let text = extractMarkdownTables(md);

  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const safe = escapeHtml(code.trimEnd());
    codeBlocks.push(
      `<pre class="help-code-block my-4 overflow-x-auto rounded-lg bg-muted/60 p-4 text-xs font-mono ring-1 ring-border" data-copyable="true"><code class="language-${escapeHtml(lang)}">${safe}</code></pre>`,
    );
    return `\x00CODE${idx}\x00`;
  });

  text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, href) => {
    const safeHref = escapeHtml(href);
    const safeLabel = escapeHtml(label);
    return `<a href="${safeHref}" class="text-accent hover:underline underline-offset-4">${safeLabel}</a>`;
  });

  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<code class="rounded bg-muted/60 px-1.5 py-0.5 text-xs font-mono ring-1 ring-border/50">${escapeHtml(code)}</code>`;
  });

  text = text.replace(/^---$/gm, '<hr class="my-6 border-border" />');

  text = text.replace(
    /^## (.+)$/gm,
    '<h2 class="mt-8 mb-3 text-lg font-semibold tracking-tight text-foreground first:mt-0">$1</h2>',
  );
  text = text.replace(/^### (.+)$/gm, '<h3 class="mt-6 mb-2 text-base font-semibold text-foreground">$1</h3>');
  text = text.replace(/^#### (.+)$/gm, '<h4 class="mt-4 mb-2 text-sm font-semibold text-foreground">$1</h4>');

  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');

  text = text.replace(
    /^\d+\. (.+)$/gm,
    '<li class="ml-5 list-decimal text-sm leading-relaxed text-muted-foreground">$1</li>',
  );
  text = text.replace(
    /^[-*] (.+)$/gm,
    '<li class="ml-5 list-disc text-sm leading-relaxed text-muted-foreground">$1</li>',
  );

  text = text.replace(
    /^> (.+)$/gm,
    '<blockquote class="my-3 border-l-2 border-accent/40 pl-4 text-sm italic text-muted-foreground">$1</blockquote>',
  );

  const lines = text.split("\n");
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const body = para.join(" ").trim();
    if (body && !body.startsWith("<")) {
      out.push(`<p class="mt-3 text-sm leading-relaxed text-muted-foreground">${body}</p>`);
    } else if (body) {
      out.push(body);
    }
    para = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushPara();
      continue;
    }
    if (
      t.startsWith("<h") ||
      t.startsWith("<li") ||
      t.startsWith("<pre") ||
      t.startsWith("<div") ||
      t.startsWith("<blockquote") ||
      t.startsWith("<hr") ||
      t.startsWith("\x00CODE")
    ) {
      flushPara();
      out.push(t);
      continue;
    }
    para.push(t);
  }
  flushPara();

  let html = out.join("\n");
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[Number(i)] ?? "");

  return html;
}
