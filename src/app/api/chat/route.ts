import { NextRequest, NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";

// In-memory cache for parsed PDF chunks to avoid re-parsing on every request
let chunkCache: Record<"academic" | "fee", { chunks: any[]; error?: string } | null> = {
  academic: null,
  fee: null,
};

export const runtime = "nodejs";
export const maxDuration = 60;

// Create the client per request so deployment environment variables are read at runtime.
function getLlm(): ChatGroq {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  return new ChatGroq({
    model: "openai/gpt-oss-20b",
    temperature: 0.3,
    apiKey,
    maxRetries: 0,
    maxTokens: 350,
  });
}

const OFFICIAL_DOCUMENTS = {
  academic: {
    name: "SGRRU Official Academic Brochure 2026-27",
    filename: "brochure.pdf",
  },
  fee: {
    name: "SGRRU Official Fee Structure 2026-27",
    filename: "fee.pdf",
  },
} as const;

type IndexedChunk = Document & { metadata: { documentName: string; source: string } };

// Get base URL for fetching PDFs - works both locally and on Vercel
function getBaseUrl(): string {
  // Vercel provides VERCEL_URL automatically in production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // For local development
  return "http://localhost:3000";
}

// Fetch PDF from static serving and parse it
// On Vercel, files in public/ are served as static assets at the root URL
async function fetchAndParsePDF(filename: string, documentName: string): Promise<{ text: string; error?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/pdfs/${filename}`;
    
    console.log(`[DEBUG] Fetching PDF from: ${url}`);
    
    // Use a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds
    
    const response = await fetch(url, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: HTTP ${response.status} from ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    
    const parsedText = pdfData.text || "";
    
    if (!parsedText.trim()) {
      throw new Error(`Empty text extracted from ${documentName}`);
    }

    console.log(`[DEBUG] Successfully parsed ${filename} - ${parsedText.length} chars`);
    return { text: parsedText };
  } catch (error) {
    console.error(`[ERROR] fetching/parsing PDF ${documentName}:`, error);
    return { 
      text: `Official document unavailable: ${documentName}.`,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Parse and index PDFs - now with caching and HTTP fetching
async function buildIndex(documentName: string, filename: string): Promise<IndexedChunk[]> {
  const cacheKey = documentName === OFFICIAL_DOCUMENTS.academic.name ? "academic" : "fee";
  
  // Return cached chunks if available
  if (chunkCache[cacheKey]) {
    if (chunkCache[cacheKey]!.error) {
      return [new Document({
        pageContent: `Official document unavailable: ${documentName}.`,
        metadata: { source: filename, documentName },
      }) as IndexedChunk];
    }
    return chunkCache[cacheKey]!.chunks as IndexedChunk[];
  }

  const result = await fetchAndParsePDF(filename, documentName);
  
  if (result.error) {
    chunkCache[cacheKey] = { chunks: [], error: result.error };
    return [new Document({
      pageContent: `Official document unavailable: ${documentName}.`,
      metadata: { source: filename, documentName },
    }) as IndexedChunk];
  }

  const docs = [
    new Document({
      pageContent: result.text,
      metadata: { source: filename, documentName },
    }),
  ];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });
  
  const chunks = await splitter.splitDocuments(docs);
  chunks.forEach((chunk) => {
    chunk.metadata = { ...chunk.metadata, documentName };
  });

  console.log(`[DEBUG] Loaded ${chunks.length} chunks from ${documentName}`);
  
  // Cache the chunks
  chunkCache[cacheKey] = { chunks, error: undefined };
  
  return chunks as IndexedChunk[];
}

function findRelevantChunks(chunks: IndexedChunk[], query: string): IndexedChunk[] {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const requestedLateralEntry = normalizedQuery.includes("lateral");
  const courseHeading = requestedLateralEntry ? "b pharm lateral entry" : "b pharm fee particulars";
  const courseStart = chunks.findIndex((chunk) => {
    const text = chunk.pageContent.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    return text.includes(courseHeading);
  });

  if (courseStart >= 0 && normalizedQuery.includes("b pharm")) {
    return chunks.slice(courseStart, courseStart + 6);
  }

  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 2);
  const scored = chunks.map((chunk, index) => {
    const text = chunk.pageContent.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const score = terms.reduce((total, term) => {
      const termMatches = text.split(/\s+/).filter((word) => word === term).length;
      return total + (termMatches * (term.length > 4 ? 3 : 1));
    }, normalizedQuery.includes("b pharm") && text.includes("b pharm") ? 12 : 0);
    return { chunk, score, index };
  });
  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 6)
    .map(({ chunk }) => chunk);
}

function isGreeting(query: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you)[!. ]*$/i.test(query.trim());
}

function getTextContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part as { text?: string }).text || ""))
      .join("")
      .trim();
  }
  return "";
}

function classifyQuery(query: string): "academic" | "fee" | "general" {
  const normalizedQuery = query.toLowerCase();
  const feeTerms = [
    "fee", "fees", "tuition", "cost", "price", "payment",
    "admission charge", "scholarship", "concession",
    "hostel", "hostel charge", "pharm", "pharma", "pharmacy"
  ];

  if (feeTerms.some((term) => normalizedQuery.includes(term))) return "fee";

  const academicTerms = [
    "attendance", "exam", "grading", "credit", "syllabus", "course",
    "semester", "admission", "eligibility", "degree", "program", "subject",
  ];
  return academicTerms.some((term) => normalizedQuery.includes(term)) ? "academic" : "general";
}

// ===== API Handler =====
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const userMessage = (data.message || "").trim();

    if (!userMessage) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const queryType = classifyQuery(userMessage);

    let context = "NO_RETRIEVAL_NEEDED";
    let documentName = "No official document used";

    if (!isGreeting(userMessage)) {
      // Build indexes on-demand with caching
      const [academicChunks, feeChunks] = await Promise.all([
        buildIndex(OFFICIAL_DOCUMENTS.academic.name, OFFICIAL_DOCUMENTS.academic.filename),
        buildIndex(OFFICIAL_DOCUMENTS.fee.name, OFFICIAL_DOCUMENTS.fee.filename),
      ]);
      const normalizedMessage = userMessage.toLowerCase().replace(/[^a-z0-9]+/g, " ");
      const academicDocs = normalizedMessage.includes("dean")
        ? academicChunks.filter((chunk) => chunk.pageContent.toLowerCase().includes("dean")).slice(0, 6)
        : findRelevantChunks(academicChunks, userMessage);
      const feeDocs = findRelevantChunks(feeChunks, userMessage);
      const retrievedDocs = [...academicDocs.slice(0, 3), ...feeDocs.slice(0, 3)];
      context = retrievedDocs
        .map((d: Document) => `[${d.metadata.documentName}]\n${d.pageContent}`)
        .join("\n\n")
        .slice(0, 7000);
      documentName = `${OFFICIAL_DOCUMENTS.academic.name} and ${OFFICIAL_DOCUMENTS.fee.name}`;
      if (normalizedMessage.includes("btech ai") || normalizedMessage.includes("b tech ai")) {
        context = `The fee document lists B.Tech CSE as the fee category for the B.Tech Artificial Intelligence and Machine Learning specialization. It does not list a separate B.Tech AI fee row.\n\n${context}`;
      }
    }

    // Better system prompt – never invent, but also never blame the documents
    const systemPrompt =
      isGreeting(userMessage)
        ? `You are a friendly assistant for Shri Guru Ram Rai University (SGRRU). Answer briefly and politely.`
        : `You are the official SGRRU college assistant. 
Answer ONLY from the context below. 
The context comes from the official SGRRU documents: ${documentName}.

Rules:
- Be short, clear and friendly.
- If the exact information is present, give it directly.
- If the information is partially present, give what is available.
- If the document gives separate domicile categories and the user does not specify one, include every applicable category.
- Use related wording and nearby course or table information; do not reject an answer just because the user's words differ from the PDF.
- Say "I don't have that specific information in the official documents right now." only when the context contains no answer at all.
- Never invent numbers or facts.
- Do not mention "visit the website" or "contact the university".

Context:
${context}`;

    const result = await getLlm().invoke([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${userMessage}\n\nReturn only the concise answer text. Do not return JSON, XML, or explanations about your instructions.`,
      },
    ]);
    const answer = getTextContent(result.content);

    return NextResponse.json({
      response: answer || "I don't have that specific information in the official documents right now.",
      query_type: queryType,
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

    if (error instanceof Error && error.message === "GROQ_API_KEY is not configured on the server.") {
      return NextResponse.json(
        { error: "The chat service is not configured. Add GROQ_API_KEY to the deployment environment." },
        { status: 503 }
      );
    }

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "The chat service credentials were rejected. Update GROQ_API_KEY in the deployment environment." },
        { status: 503 }
      );
    }

    if (status === 429) {
      return NextResponse.json(
        { error: "The AI service is temporarily busy. Please try again in a few seconds." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}