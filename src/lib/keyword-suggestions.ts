import type { DocumentRecord } from "@/lib/documents";

export type SuggestedKeywordResult = {
  keywords: string[];
  source: "openai" | "fallback";
};

export async function suggestKeywordsForDocument(doc: DocumentRecord): Promise<SuggestedKeywordResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      keywords: buildFallbackKeywords(doc),
      source: "fallback",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_KEYWORD_MODEL ?? "gpt-5.2",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "あなたは行政通知文の整理担当です。文書の関連キーワード候補を、短く、再利用しやすい名詞句で返してください。冗長な文断片や助詞を含む文章は避けてください。",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `タイトル: ${doc.title}`,
                  `概要: ${doc.summary}`,
                  `発行元: ${doc.issuer ?? "不明"}`,
                  `既存キーワード: ${doc.keywords.join(" / ")}`,
                  "本文抜粋:",
                  doc.body.slice(0, 5000),
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "keyword_suggestions",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                keywords: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  minItems: 4,
                  maxItems: 12,
                },
              },
              required: ["keywords"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
    };
    const parsed = JSON.parse(payload.output_text ?? "{}") as { keywords?: unknown };

    if (!Array.isArray(parsed.keywords)) {
      throw new Error("keywords missing");
    }

    return {
      keywords: normalizeKeywordList(parsed.keywords.filter((item): item is string => typeof item === "string")),
      source: "openai",
    };
  } catch {
    return {
      keywords: buildFallbackKeywords(doc),
      source: "fallback",
    };
  }
}

function buildFallbackKeywords(doc: DocumentRecord) {
  return normalizeKeywordList([
    ...doc.manualKeywords,
    ...doc.keywords,
    ...doc.relatedTerms,
    ...(doc.issuer ? [doc.issuer] : []),
    ...extractHeadlinePhrases(doc.title),
    ...extractHeadlinePhrases(doc.summary),
  ]).slice(0, 12);
}

function extractHeadlinePhrases(text: string) {
  return text
    .split(/[、。・/\s]+/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && value.length <= 18);
}

function normalizeKeywordList(keywords: string[]) {
  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .filter((keyword) => !/[。、「」]/u.test(keyword))
        .filter((keyword) => keyword.length >= 2 && keyword.length <= 24),
    ),
  );
}
