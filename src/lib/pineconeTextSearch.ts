import { Document } from '@langchain/core/documents';
import type { Pinecone } from '@pinecone-database/pinecone';
import { getPineconeIndex } from '@/lib/pineconeIndex';

const PAGE_SIZE = 100;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'do', 'does', 'for', 'how', 'i', 'in', 'is',
  'it', 'me', 'of', 'on', 'please', 'tell', 'the', 'to', 'what', 'when',
  'where', 'which', 'who', 'why', 'with',
]);

let documentsPromise: Promise<Document[]> | undefined;

function tokenize(value: string) {
  return (value.toLowerCase().match(/[a-z0-9.]+/g) ?? [])
    .map((token) => token.replace(/\./g, '').replace(/s$/, ''))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

async function loadStoredDocuments(pinecone: Pinecone, configuredIndex: string) {
  const index = getPineconeIndex(pinecone, configuredIndex);
  const namespace = index.namespace('');
  const ids: string[] = [];
  let paginationToken: string | undefined;

  do {
    const page = await namespace.listPaginated({
      limit: PAGE_SIZE,
      ...(paginationToken ? { paginationToken } : {}),
    });
    ids.push(...(page.vectors ?? []).flatMap((vector) => vector.id ? [vector.id] : []));
    paginationToken = page.pagination?.next;
  } while (paginationToken);

  const documents: Document[] = [];
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const records = await namespace.fetch({ ids: ids.slice(offset, offset + PAGE_SIZE) });

    for (const [id, record] of Object.entries(records.records)) {
      const text = record.metadata?.text;
      if (typeof text !== 'string' || !text.trim()) continue;

      documents.push(new Document({
        pageContent: text,
        metadata: {
          id,
          source: record.metadata?.source,
          page: record.metadata?.page,
        },
      }));
    }
  }

  return documents;
}

async function getStoredDocuments(pinecone: Pinecone, configuredIndex: string) {
  if (!documentsPromise) {
    documentsPromise = loadStoredDocuments(pinecone, configuredIndex).catch((error: unknown) => {
      documentsPromise = undefined;
      throw error;
    });
  }

  return documentsPromise;
}

export async function searchStoredPineconeText(
  pinecone: Pinecone,
  configuredIndex: string,
  query: string,
  limit = 4
) {
  const documents = await getStoredDocuments(pinecone, configuredIndex);
  const queryTerms = [...new Set(tokenize(query))];

  if (!queryTerms.length || !documents.length) return [];

  const tokenizedDocuments = documents.map((document) => tokenize(document.pageContent));
  const documentFrequencies = new Map<string, number>();

  for (const tokens of tokenizedDocuments) {
    for (const term of new Set(tokens)) {
      documentFrequencies.set(term, (documentFrequencies.get(term) ?? 0) + 1);
    }
  }

  const averageLength = tokenizedDocuments.reduce((sum, tokens) => sum + tokens.length, 0) / documents.length || 1;
  const ranked = documents.map((document, index) => {
    const tokens = tokenizedDocuments[index];
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const frequency = counts.get(term) ?? 0;
      if (!frequency) continue;

      const documentFrequency = documentFrequencies.get(term) ?? 0;
      const inverseFrequency = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const lengthNormalization = 1.2 * (0.25 + 0.75 * tokens.length / averageLength);
      score += inverseFrequency * (frequency * 2.2) / (frequency + lengthNormalization);
    }

    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length > 2 && document.pageContent.toLowerCase().includes(normalizedQuery)) {
      score += 2;
    }

    return { document, score };
  });

  return ranked
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.document);
}