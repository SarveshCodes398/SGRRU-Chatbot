import { Embeddings } from '@langchain/core/embeddings';
import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL_ID = 'Xenova/bge-large-en-v1.5';
const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 4;

if (process.env.TRANSFORMERS_CACHE) {
  env.cacheDir = process.env.TRANSFORMERS_CACHE;
}

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, { quantized: true });
  }

  try {
    return await extractorPromise;
  } catch (error) {
    extractorPromise = undefined;
    throw error;
  }
}

export class LocalBgeEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(texts: string[]) {
    const vectors: number[][] = [];
    const extractor = await getExtractor();

    for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
      const batch = texts.slice(offset, offset + BATCH_SIZE);
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const batchVectors = output.tolist() as number[][];

      if (batchVectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error(`Embedding model returned a vector with an unexpected dimension (expected ${EMBEDDING_DIMENSIONS}).`);
      }

      vectors.push(...batchVectors);
    }

    return vectors;
  }

  async embedQuery(text: string) {
    const [vector] = await this.embedDocuments([text]);

    if (!vector) {
      throw new Error('Embedding model returned no vector for the query.');
    }

    return vector;
  }
}