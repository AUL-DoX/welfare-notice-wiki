import fs from "node:fs/promises";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const officeXmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

export async function extractXlsxText(filePath: string) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const sharedStrings = await readSharedStrings(zip);
  const sheetEntries = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((left, right) => extractNumber(left) - extractNumber(right));

  const sheets = await Promise.all(
    sheetEntries.map(async (entryName) => {
      const xml = await zip.files[entryName].async("string");
      const parsed = officeXmlParser.parse(xml);
      const rows = toArray(parsed?.worksheet?.sheetData?.row)
        .map((row) => readWorksheetRow(row, sharedStrings))
        .filter(Boolean)
        .slice(0, 250);

      return rows.join("\n");
    }),
  );

  return sheets.filter(Boolean).join("\n\n");
}

export async function extractDocxText(filePath: string) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const targets = [
    "word/document.xml",
    ...Object.keys(zip.files)
      .filter((name) => /^word\/(header|footer)\d+\.xml$/.test(name))
      .sort(),
  ];

  const parts = await Promise.all(
    targets.map(async (name) => {
      const file = zip.files[name];
      if (!file) {
        return "";
      }

      const xml = await file.async("string");
      return collectTextNodes(officeXmlParser.parse(xml)).join("\n");
    }),
  );

  return parts.filter(Boolean).join("\n\n");
}

async function readSharedStrings(zip: JSZip) {
  const file = zip.files["xl/sharedStrings.xml"];
  if (!file) {
    return [];
  }

  const parsed = officeXmlParser.parse(await file.async("string"));
  return toArray(parsed?.sst?.si).map((item) => collectTextNodes(item).join(""));
}

function readWorksheetRow(row: unknown, sharedStrings: string[]) {
  const cells = toArray((row as { c?: unknown } | null)?.c)
    .map((cell) => readCell(cell, sharedStrings))
    .filter(Boolean);

  return cells.join(" | ");
}

function readCell(cell: unknown, sharedStrings: string[]) {
  if (!cell || typeof cell !== "object") {
    return "";
  }

  const typedCell = cell as {
    "@_t"?: string;
    v?: string | number;
    is?: unknown;
  };
  const rawValue = typedCell.v;

  if (typedCell["@_t"] === "s") {
    const index = Number(rawValue);
    return Number.isInteger(index) ? sharedStrings[index] ?? "" : "";
  }

  if (typedCell["@_t"] === "inlineStr") {
    return collectTextNodes(typedCell.is).join("");
  }

  return rawValue == null ? "" : String(rawValue);
}

function collectTextNodes(node: unknown): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item) => collectTextNodes(item));
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "t") {
      return collectTextNodes(value);
    }

    return collectTextNodes(value);
  });
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractNumber(value: string) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}
