import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

export const UNIVERSITY_NAMESPACE = 'sgrru-gemini-embedding-001';

export function createUniversityEmbeddings() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not configured.');
  }

  return new GoogleGenerativeAIEmbeddings({
    apiKey,
    modelName: 'gemini-embedding-001',
    outputDimensionality: 1024,
  });
}