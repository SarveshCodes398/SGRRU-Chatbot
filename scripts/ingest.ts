// @ts-nocheck
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Pinecone } from '@pinecone-database/pinecone';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const PINECONE_DIMENSION = 1024;

const toPineconeVector = (vector: number[]) => [
  ...vector,
  ...new Array(PINECONE_DIMENSION - vector.length).fill(0),
];

const toPineconeMetadata = (metadata: Record<string, unknown>, text: string) => ({
  source: typeof metadata.source === 'string' ? metadata.source : 'university-pdf',
  page: typeof metadata.page === 'number' ? metadata.page : 0,
  text,
});

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function ingest() {
  try {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndexName = process.env.PINECONE_INDEX;

    if (!pineconeApiKey || !pineconeIndexName) {
      throw new Error('Please ensure PINECONE_API_KEY and PINECONE_INDEX are set in .env or .env.local');
    }

    console.log('Loading PDFs...');
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log('Created /data directory. Please place your PDFs there and run this script again.');
        return;
    }

    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.pdf'));
    if (files.length === 0) {
        console.log('No PDFs found in the /data directory. Please add them.');
        return;
    }

    let allDocs: any[] = [];
    for (const file of files) {
        const filePath = path.join(dataDir, file);
        console.log(`Parsing ${file}...`);
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();
        allDocs = allDocs.concat(docs);
    }

    console.log('Splitting text...');
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(allDocs);
    console.log(`Created ${splitDocs.length} chunks.`);

    console.log('Initializing Pinecone...');
    const pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });
    
    const pineconeIndex = pinecone.Index(pineconeIndexName);

    const embeddings = new HuggingFaceTransformersEmbeddings({
      model: EMBEDDING_MODEL,
    });

    console.log('Creating embeddings...');
    const vectors = await embeddings.embedDocuments(
      splitDocs.map((doc) => doc.pageContent)
    );
    const namespace = pineconeIndex.namespace('');
    const records = splitDocs.map((doc, index) => ({
      id: `sgrr-${index}`,
      values: toPineconeVector(vectors[index]),
      metadata: toPineconeMetadata(doc.metadata, doc.pageContent),
    }));

    console.log('Uploading vectors...');
    for (let index = 0; index < records.length; index += 100) {
      await namespace.upsert({ records: records.slice(index, index + 100) });
    }

    console.log('Ingestion complete! Your vector database is ready.');
  } catch (error) {
    console.error('Error during ingestion:', error);
  }
}

ingest();
