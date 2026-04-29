import { generateDocumentIndexFile } from "../src/lib/documents";

async function main() {
  const result = await generateDocumentIndexFile();

  console.log(
    `Generated document index. documents=${result.documents} failed=${result.failedDocuments} generatedAt=${result.generatedAt}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
