function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string, wikiTitles: Set<string>): string {
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_m, raw: string, label?: string) => {
    const title = String(raw).trim();
    const display = label ? String(label).trim() : title;
    if (wikiTitles.has(title.toLowerCase())) {
      return `<span class="wiki-link" title="${esc(title)}">${esc(display)}</span>`;
    }
    return esc(display);
  });
  return s;
}

export function markdownToHtmlBlocks(md: string, wikiTitles: Set<string> = new Set()): string {
  const body = md.replace(/^---[\s\S]*?---\n/, "");
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const t = para.join("\n").trim();
    if (t) out.push(`<p>${inlineMarkdown(t, wikiTitles).replace(/\n/g, "<br/>")}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((li) => `<li>${inlineMarkdown(li, wikiTitles)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);

    if (h1 || h2 || h3 || bullet) {
      flushPara();
    }

    if (h1) {
      flushList();
      out.push(`<h1>${inlineMarkdown(h1[1], wikiTitles)}</h1>`);
    } else if (h2) {
      flushList();
      out.push(`<h2>${inlineMarkdown(h2[1], wikiTitles)}</h2>`);
    } else if (h3) {
      flushList();
      out.push(`<h3>${inlineMarkdown(h3[1], wikiTitles)}</h3>`);
    } else if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

export async function wikiTitleSet(): Promise<Set<string>> {
  const { buildWikiIndex } = await import("./wikiIndex");
  const { entries } = await buildWikiIndex();
  return new Set(entries.map((e) => e.title.toLowerCase()));
}

export function markdownToXhtml(md: string, title: string, wikiTitles: Set<string>): string {
  const body = markdownToHtmlBlocks(md, wikiTitles);
  return `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>\n${body}\n</body></html>`;
}
