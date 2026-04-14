# Public Notice Wiki MVP

PDF と PowerPoint の通知文を `source-docs` フォルダに置くと、本文を抽出して検索できるローカル Web アプリです。

## できること

- `source-docs` 内の `.pdf` `.pptx` `.md` `.txt` を取り込み
- 文書一覧、全文検索、詳細ページ表示
- 発信元候補、日付候補、締切候補、関連キーワードの抽出
- 元ファイルの直接表示

## 使い方

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## フォルダ構成

- `source-docs`: 元になる通知文置き場
- `src/lib/documents.ts`: 文書抽出と索引化ロジック
- `src/app/page.tsx`: 検索トップ
- `src/app/docs/[slug]/page.tsx`: 文書詳細

## 今後の拡張候補

- 公開可否ワークフロー
- 発信元や制度の正規化辞書
- FAQ 自動生成
- 更新検知と再索引 API
