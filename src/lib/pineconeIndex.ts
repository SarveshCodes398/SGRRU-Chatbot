import type { Pinecone } from '@pinecone-database/pinecone';

export function getPineconeIndex(pinecone: Pinecone, configuredIndex: string) {
  const value = configuredIndex.trim();

  if (!value) {
    throw new Error('PINECONE_INDEX must be an index name or HTTPS index host URL.');
  }

  if (/^https?:\/\//i.test(value)) {
    const host = new URL(value);

    if (host.protocol !== 'https:' || host.pathname !== '/' || host.search || host.hash) {
      throw new Error('PINECONE_INDEX host URLs must use HTTPS and contain no path, query, or fragment.');
    }

    return pinecone.index({ host: host.origin });
  }

  return pinecone.index({ name: value });
}