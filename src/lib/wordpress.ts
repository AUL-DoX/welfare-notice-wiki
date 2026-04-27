import type { DocumentRecord } from "@/lib/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";

export function renderWordPressHtml(doc: DocumentRecord) {
  const metaItems = [
    doc.sourceType.toUpperCase(),
    doc.issuer,
    doc.publishedAt,
    DOCUMENT_CATEGORY_LABELS[doc.category],
  ].filter(Boolean) as string[];

  const sections = [
    `<div class="wnw-meta">${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`,
    `<h1>${escapeHtml(doc.title)}</h1>`,
    doc.summary ? `<p class="wnw-summary">${escapeHtml(doc.summary)}</p>` : "",
    doc.keywords.length > 0 ? renderTagSection("関連キーワード", doc.keywords) : "",
    renderBody(doc.body),
  ]
    .filter(Boolean)
    .join("\n");

  return `
<!-- wp:html -->
<div class="welfare-notice-wiki">
${sections}
</div>
<!-- /wp:html -->
  `.trim();
}

export function renderWordPressPreviewDocument(doc: DocumentRecord) {
  const articleHtml = renderWordPressHtml(doc);

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(doc.title)} | WordPress Preview</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f1e8;
      --panel: #fffdf8;
      --ink: #2f261a;
      --muted: #746756;
      --line: #ded6c8;
      --accent: #8b5e34;
      --chip: #f3ede1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Hiragino Sans", "Yu Gothic UI", sans-serif;
      background: linear-gradient(180deg, #f7f1e5 0%, #fbfaf6 48%, #edf2e8 100%);
      color: var(--ink);
      line-height: 1.8;
    }
    .shell {
      max-width: 1160px;
      margin: 0 auto;
      padding: 32px 20px 48px;
      display: grid;
      gap: 24px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 28px;
      box-shadow: 0 18px 60px rgba(58, 45, 27, 0.08);
      padding: 28px;
    }
    h1, h2, h3 { line-height: 1.3; }
    .lede { color: var(--muted); margin-top: 8px; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 18px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 12px 18px;
      background: #2f261a;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
    }
    .button.secondary {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    .preview {
      background: white;
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
    }
    .welfare-notice-wiki h1 {
      font-size: clamp(1.8rem, 3vw, 2.5rem);
      margin: 0 0 16px;
    }
    .welfare-notice-wiki h2 {
      font-size: 1.25rem;
      margin: 32px 0 12px;
    }
    .wnw-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .wnw-meta span,
    .wnw-tags span {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--chip);
      color: var(--ink);
      font-size: 0.92rem;
    }
    .wnw-summary {
      font-size: 1.05rem;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .wnw-list,
    .wnw-body {
      margin: 0;
      padding-left: 1.3rem;
    }
    .wnw-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    textarea {
      width: 100%;
      min-height: 340px;
      border-radius: 20px;
      border: 1px solid var(--line);
      padding: 16px;
      font: 14px/1.6 Consolas, "Courier New", monospace;
      resize: vertical;
      background: #fffdfa;
    }
    @media (max-width: 720px) {
      .panel, .preview { padding: 20px; border-radius: 22px; }
      .shell { padding: 18px 14px 32px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="panel">
      <h1>WordPress貼り付け用プレビュー</h1>
      <p class="lede">この画面で見えている内容を確認して、下のHTMLを WordPress のカスタムHTMLブロックかコードエディタへ貼り付けます。</p>
      <div class="actions">
        <button class="button" type="button" onclick="copyHtml()">HTMLをコピー</button>
        <a class="button secondary" href="/docs/${encodeURIComponent(doc.slug)}">元の文書画面へ戻る</a>
      </div>
    </section>
    <section class="panel">
      <h2>表示プレビュー</h2>
      <div class="preview">${articleHtml}</div>
    </section>
    <section class="panel">
      <h2>貼り付け用HTML</h2>
      <textarea id="wp-html">${escapeHtml(articleHtml)}</textarea>
    </section>
  </main>
  <script>
    async function copyHtml() {
      const textarea = document.getElementById('wp-html');
      textarea.focus();
      textarea.select();
      try {
        await navigator.clipboard.writeText(textarea.value);
      } catch (error) {
        document.execCommand('copy');
      }
    }
  </script>
</body>
</html>`;
}

function renderListSection(title: string, items: string[]) {
  return `
<h2>${escapeHtml(title)}</h2>
<ul class="wnw-list">
${items.map((item) => `  <li>${escapeHtml(item)}</li>`).join("\n")}
</ul>`.trim();
}

function renderTagSection(title: string, items: string[]) {
  return `
<h2>${escapeHtml(title)}</h2>
<div class="wnw-tags">
${items.map((item) => `  <span>${escapeHtml(item)}</span>`).join("\n")}
</div>`.trim();
}

function renderBody(body: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return `
<h2>本文</h2>
<div class="wnw-body">
${paragraphs}
</div>`.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
