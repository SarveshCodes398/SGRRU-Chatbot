import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { Document } from '@langchain/core/documents';
import { ChatGroq } from '@langchain/groq';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import { LocalBgeEmbeddings } from '@/lib/embeddings';
import { getPineconeIndex } from '@/lib/pineconeIndex';

const formatDocumentsAsString = (docs: Document[]) => docs.map((doc) => doc.pageContent).join('\n\n');
let pineconeStore: PineconeStore | null = null;

async function initVectorStore() {
  if (pineconeStore) return pineconeStore;

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone is not configured.');
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const pineconeIndex = getPineconeIndex(pinecone, process.env.PINECONE_INDEX);
  const embeddings = new LocalBgeEmbeddings();

  pineconeStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  return pineconeStore;
}

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(4000),
    })
  ).min(1).max(30),
});

const isGreeting = (message: string) => /^(hi+|hello+|hey+|namaste)[.!?\s]*$/i.test(message.trim());

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const parsedBody = chatRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const { messages } = parsedBody.data;
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from a user' }, { status: 400 });
    }

    const query = lastMessage.content;

    if (isGreeting(query)) {
      return new Response("Hello! I'm here to help with questions about SGRR University. How can I assist you today?", {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'The assistant is not configured yet. Please contact the site administrator.', code: 'CONFIGURATION_ERROR' },
        { status: 503 }
      );
    }

    const vectorStore = await initVectorStore();
    const contextDocs = await vectorStore.asRetriever(4).invoke(query);

    if (contextDocs.length === 0) {
      return new Response(
        "I don't have verified SGRR University information available right now. Please check the university's official website or contact admissions.",
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    const contextText = formatDocumentsAsString(contextDocs);

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY!,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.2,
      maxTokens: 500,
    });

    const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful and professional AI Assistant for SGRR University (Shri Guru Ram Rai University).
Your purpose is to answer questions about the university based on the provided context.

Guidelines:
1. STRICT GUARDRAIL: If the user asks about something completely unrelated to the university (e.g., how to code, general knowledge, math, politics), politely decline and state that you can only answer questions related to SGRR University.
2. If the user asks in Hindi or any other language, MUST ALWAYS reply in English.
3. Base your answers strictly on the context provided. If the answer is not in the context, say you don't have the exact information but provide related helpful info if possible.
4. Structure your output nicely. Use bullet points or short paragraphs.
5. GREETINGS: If the user simply sends a greeting (e.g., "hi", "heyy", "namaste", "hello"), respond warmly with a greeting like "Hello! 👋 I'm here to help with any questions you have about SGRR University. How can I assist you today?" and do NOT mention the context.

Context Information:
{context}

User's Question:
{question}

Assistant Answer:
`);

    const chain = RunnableSequence.from([
      promptTemplate,
      llm,
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({
      context: contextText,
      question: query,
    });

    return new Response(answer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'The assistant is temporarily unavailable. Please try again in a moment.', code: 'ASSISTANT_UNAVAILABLE' },
      { status: 503 }
    );
  }
}
