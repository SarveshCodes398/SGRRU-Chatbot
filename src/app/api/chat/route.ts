import { NextRequest, NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { Document } from "@langchain/core/documents";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ===== Zod schema – forces clean short output =====
const AnswerSchema = z.object({
  answer: z
    .string()
    .max(650)
    .describe("Short, clear, friendly answer. No markdown, no hashtags, no extra quotes."),
});

// ===== LLM =====
const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0.3,
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 2,
});

const structuredLlm = llm.withStructuredOutput(AnswerSchema);

// ===== Local embeddings (no HF API key) =====
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

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

// ===== Build Retriever (fixed parser) =====
async function buildRetriever(pdfPath: string, documentName: string) {
  try {
    if (!fs.existsSync(pdfPath)) {
      console.warn(`File not found: ${pdfPath}`);
      return await MemoryVectorStore.fromDocuments(
        [
          new Document({
            pageContent: `Official document unavailable: ${documentName}.`,
            metadata: { source: pdfPath, documentName },
          }),
        ],
        embeddings
      );
    }

    // Parse the PDF using the named export provided by pdf-parse.
    const dataBuffer = await fs.promises.readFile(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    const parsedText = pdfData.text || "";

    if (!parsedText.trim()) {
      console.warn(`Empty text extracted from ${pdfPath}`);
      return await MemoryVectorStore.fromDocuments(
        [
          new Document({
            pageContent: `No readable content found in the official document: ${documentName}.`,
            metadata: { source: pdfPath, documentName },
          }),
        ],
        embeddings
      );
    }

    const docs = [
      new Document({
        pageContent: parsedText,
        metadata: { source: pdfPath, documentName },
      }),
    ];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,      // slightly larger chunks work better for fee tables
      chunkOverlap: 150,
    });
    const chunks = await splitter.splitDocuments(docs);
    chunks.forEach((chunk) => {
      chunk.metadata = { ...chunk.metadata, documentName };
    });

    console.log(`Loaded ${chunks.length} chunks from ${documentName}`);
    return await MemoryVectorStore.fromDocuments(chunks, embeddings);
  } catch (error) {
    console.error(`Error building retriever for ${pdfPath}:`, error);
    throw error;
  }
}

// ===== Cached retrievers =====
let academicRetriever: any = null;
let feeRetriever: any = null;
let isInitializing = false;

async function initializeRetrievers() {
  if (academicRetriever && feeRetriever) return;
  if (isInitializing) {
    await new Promise((r) => setTimeout(r, 2000));
    return;
  }

  isInitializing = true;
  try {
    const baseDir = path.join(process.cwd(), "public", "pdfs");
    const academicPath = path.join(baseDir, OFFICIAL_DOCUMENTS.academic.filename);
    const feePath = path.join(baseDir, OFFICIAL_DOCUMENTS.fee.filename);

    console.log("Loading PDFs...");
    const [academicStore, feeStore] = await Promise.all([
      buildRetriever(academicPath, OFFICIAL_DOCUMENTS.academic.name),
      buildRetriever(feePath, OFFICIAL_DOCUMENTS.fee.name),
    ]);

    academicRetriever = academicStore.asRetriever({ k: 6 }); // increased k for better recall
    feeRetriever = feeStore.asRetriever({ k: 6 });
    console.log("Retrievers ready");
  } catch (error) {
    console.error("Failed to initialize retrievers:", error);
  } finally {
    isInitializing = false;
  }
}

// ===== Classifier (kept almost same, slightly improved) =====
async function classifyQuery(query: string): Promise<"academic" | "fee" | "general"> {
  const normalizedQuery = query.toLowerCase();
  const feeTerms = [
    "fee", "fees", "tuition", "cost", "price", "payment",
    "admission charge", "scholarship", "concession",
    "hostel", "hostel charge", "pharm", "pharma", "pharmacy"
  ];

  if (feeTerms.some((term) => normalizedQuery.includes(term))) return "fee";

  const prompt = `Classify into exactly one word: academic, fee, or general.

academic = attendance, exams, grading, credits, syllabus, course structure, degree rules
fee = tuition, fees, payment, refund, scholarship, hostel charges, any money topic
general = greeting or unrelated

Query: ${query}

Reply with only one word.`;

  const res = await llm.invoke(prompt);
  const text = (res.content as string).toLowerCase().trim();

  if (text.includes("fee")) return "fee";
  if (text.includes("academic")) return "academic";
  return "general";
}

// ===== API Handler =====
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const userMessage = (data.message || "").trim();

    if (!userMessage) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    await initializeRetrievers();

    const queryType = await classifyQuery(userMessage);

    let context = "NO_RETRIEVAL_NEEDED";
    let documentName = "No official document used";

    if (queryType === "academic" && academicRetriever) {
      const docs = await academicRetriever.invoke(userMessage);
      context = docs.map((d: Document) => d.pageContent).join("\n\n");
      documentName = OFFICIAL_DOCUMENTS.academic.name;
    } else if (queryType === "fee" && feeRetriever) {
      const docs = await feeRetriever.invoke(userMessage);
      context = docs.map((d: Document) => d.pageContent).join("\n\n");
      documentName = OFFICIAL_DOCUMENTS.fee.name;
    }

    // Better system prompt – never invent, but also never blame the documents
    const systemPrompt =
      queryType === "general"
        ? `You are a friendly assistant for Shri Guru Ram Rai University (SGRRU). Answer briefly and politely.`
        : `You are the official SGRRU college assistant. 
Answer ONLY from the context below. 
The context comes from: ${documentName}.

Rules:
- Be short, clear and friendly.
- If the exact information is present, give it directly.
- If the information is partially present, give what is available.
- If nothing relevant is found in the context, simply say: "I don't have that specific information in the official documents right now."
- Never invent numbers or facts.
- Do not mention "visit the website" or "contact the university".

Context:
${context}`;

    const result = await structuredLlm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    return NextResponse.json({
      response: result.answer,
      query_type: queryType,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}