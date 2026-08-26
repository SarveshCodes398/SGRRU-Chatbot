import { NextRequest, NextResponse } from "next/server";
import { ChatMistralAI } from "@langchain/mistralai";
import { Document } from "@langchain/core/documents";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";
import * as fs from "fs";
import * as path from "path";

// ===== Programme Map =====
const programmeMap: Record<string, string> = {
  "1": "B.A. Journalism and Mass Communication",
  "2": "B.C.A",
  "3": "B.Com (Bachelor of Commerce)",
  "4": "B.Pharm",
  "5": "B.Pharm (Lateral Entry)",
  "6": "B.Sc. (Hons.) Agriculture",
  "7": "B.Sc. (Optometry)",
  "8": "B.Sc. (Physics, Chemistry, Mathematics) – PCM",
  "9": "B.Sc. Biotechnology",
  "10": "B.Sc. CBZ",
  "11": "B.Sc. Food Nutrition & Dietetics",
  "12": "B.Sc. Forensic Science",
  "13": "B.Sc. in Yogic Science",
  "14": "B.Sc. Microbiology",
  "15": "B.Sc. PMG",
  "16": "B.Sc. ZBG",
  "17": "B.Sc. (IT)",
  "19": "Bachelor in Medical Laboratory Technology (BMLT)",
  "20": "Bachelor in Medical Radio Imaging Technology (BMRIT)",
  "21": "Bachelor in Physiotherapy (BPT)",
  "22": "Bachelor of Arts (B.A.)",
  "23": "Bachelor of Operation Theatre Technology (B.Sc. OTT)",
  "24": "Bachelors Of Education (B.Ed.)",
  "25": "BBA (Bachelor of Business Administration)",
  "26": "BHA (Bachelor of Hospital Administration)",
  "27": "BHM (Bachelor of Hotel Management)",
  "28": "Diploma In Pharmacy (D.Pharm)",
  "29": "Early Childhood Care and Education",
  "30": "M. Com (Master of Commerce)",
  "31": "M.A. Economics",
  "32": "M.A. History",
  "33": "M.A. in Human Consciousness and Yogic Science",
  "34": "M.A. Mass Communication",
  "35": "M.A. Music",
  "36": "M.A. Political Science",
  "37": "M.A. Psychology",
  "38": "M.A./M.Sc. Geography",
  "39": "M.Pharm (Pharmaceutics Quality Assurance)",
  "40": "M.Pharm (Pharmaceutics)",
  "41": "M.Pharm (Pharmacognosy)",
  "42": "M.Pharm (Pharmacology)",
  "43": "M.Pharm (Pharmacy Practice)",
  "44": "M.Pharm. (Pharmaceutical Chemistry)",
  "45": "M.Sc. (Ag.) Agronomy",
  "46": "M.Sc. (Ag.) Entomology",
  "47": "M.Sc. (Ag.) Plant Pathology",
  "48": "M.Sc. (Ag.) Soil Science",
  "49": "M.Sc. Biotechnology",
  "50": "M.Sc. Botany",
  "51": "M.Sc. Chemistry",
  "52": "M.Sc. Forensic Science",
  "53": "M.Sc. Geology",
  "54": "M.Sc. in Yogic Science",
  "55": "M.Sc. in Yogic Science and Alternative Therapies",
  "56": "M.Sc. in Yogic Science and Naturopathy",
  "57": "M.Sc. Mathematics",
  "58": "M.Sc. Microbiology",
  "59": "M.Sc. MLT",
  "60": "M.Sc. Physics",
  "61": "M.Sc. Zoology",
  "62": "M.Sc.(Ag) Genetics and Plant Breeding",
  "63": "M.Sc.(Ag) Horticulture",
  "64": "MA English",
  "65": "Master In Social Work (MSW)",
  "66": "Master of Computer Applications (MCA)",
  "67": "Master of Education (M.Ed.)",
  "68": "MBA (Master of Business Administration)",
  "69": "MHA (Master of Hospital Administration)",
  "70": "MPT Cardio",
  "71": "MPT Neuro",
  "72": "MPT Obs. & Gynaecology",
  "73": "MPT Ortho",
  "74": "MPT Paedia",
  "75": "MPT Sports",
  "76": "Pharm.D (Doctor of Pharmacy)",
  "77": "Pharm.D (Post-Baccalaureate)",
  "78": "Post Graduate Diploma in (Guidance and Counselling)",
};

// ===== State Type =====
interface ChatState {
  programme: string;
  messages: Array<{ role: "human" | "ai"; content: string }>;
  query_type: "academic" | "fee" | "general" | "";
  retrieved_context: string;
}

// ===== Initialize LLM & Embeddings =====
const llm = new ChatMistralAI({
  model: "mistral-large-latest",
  temperature: 0.4,
  apiKey: process.env.MISTRAL_API_KEY,
});

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

// ===== Build Retriever from a PDF file =====
async function buildRetriever(pdfPath: string) {
  try {
    if (!fs.existsSync(pdfPath)) {
      console.warn(`⚠️ File not found: ${pdfPath}`);
      return await MemoryVectorStore.fromDocuments(
        [new Document({ pageContent: "Document not available yet.", metadata: { source: pdfPath } })],
        embeddings
      );
    }

    const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
    const { text: fullText } = await parser.getText();
    await parser.destroy();

    if (!fullText.trim()) {
      console.warn(`⚠️ Empty file: ${pdfPath}`);
      return await MemoryVectorStore.fromDocuments(
        [new Document({ pageContent: "No content found.", metadata: { source: pdfPath } })],
        embeddings
      );
    }

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 100 });
    const chunks = await splitter.splitText(fullText);
    const docs = chunks.map((chunk) => new Document({ pageContent: chunk, metadata: { source: pdfPath } }));

    return await MemoryVectorStore.fromDocuments(docs, embeddings);
  } catch (error) {
    console.error(`Error building retriever for ${pdfPath}:`, error);
    throw error;
  }
}

// ===== Initialize Retrievers =====
let academicRetriever: any = null;
let feeRetriever: any = null;

async function initializeRetrievers() {
  const baseDir = path.join(process.cwd(), "public", "pdfs");
  const academicPath = path.join(baseDir, "brochure.pdf");
  const feePath = path.join(baseDir, "fee.pdf");

  try {
    console.log("📄 Loading documents and building vector stores...");
    const academicStore = await buildRetriever(academicPath);
    const feeStore = await buildRetriever(feePath);

    academicRetriever = academicStore.asRetriever({ k: 4 });
    feeRetriever = feeStore.asRetriever({ k: 4 });
    console.log("✅ Retrievers initialized");
  } catch (error) {
    console.error("Failed to initialize retrievers:", error);
  }
}

// ===== Graph Nodes =====

async function classifierNode(state: ChatState): Promise<Partial<ChatState>> {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const prompt = `Classify the following student query into exactly one category: 'academic', 'fee', or 'general'.

Use 'academic' for questions about attendance, exams, grading, credits, promotion, course structure, summer training, or degree requirements at SGRRU.
Use 'fee' for questions about tuition, payment, refund, late charges, scholarships, or any money-related topic at SGRRU.
Use 'general' for greetings, casual talk, or anything not related to the college rules or fee.

Query: ${lastMessage}

Return only one word: academic, fee, or general.`;

  const response = await llm.invoke(prompt);
  let category = (response.content as string).toLowerCase().trim();

  if (category.includes("academic")) category = "academic";
  else if (category.includes("fee")) category = "fee";
  else category = "general";

  return { query_type: category as "academic" | "fee" | "general" };
}

async function academicRagNode(state: ChatState): Promise<Partial<ChatState>> {
  if (!academicRetriever) return { retrieved_context: "Retriever not initialized" };
  const query = state.messages[state.messages.length - 1].content;
  const docs = await academicRetriever.invoke(query);
  return { retrieved_context: docs.map((doc: Document) => doc.pageContent).join("\n\n") };
}

async function feeRagNode(state: ChatState): Promise<Partial<ChatState>> {
  if (!feeRetriever) return { retrieved_context: "Retriever not initialized" };
  const query = state.messages[state.messages.length - 1].content;
  const docs = await feeRetriever.invoke(query);
  return { retrieved_context: docs.map((doc: Document) => doc.pageContent).join("\n\n") };
}

async function generalNode(): Promise<Partial<ChatState>> {
  return { retrieved_context: "NO_RETRIEVAL_NEEDED" };
}

async function responseNode(state: ChatState): Promise<Partial<ChatState>> {
  const query = state.messages[state.messages.length - 1].content;
  const { programme, retrieved_context: context } = state;

  const prompt =
    context === "NO_RETRIEVAL_NEEDED"
      ? `You are a friendly SGRRU (Shri Guru Ram Rai University) college assistant talking to a ${programme} student. Answer this question using your own general knowledge:\n\n${query}`
      : `You are a college assistant helping a ${programme} student at SGRRU (Shri Guru Ram Rai University). Use the following context from the official SGRRU documents to answer the question accurately. If the context mentions specific figures for different programmes, highlight the one relevant to ${programme} if possible.

Context:
${context}

Question: ${query}

Give a clear, friendly, and precise answer.`;

  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content : String(response.content);

  return { messages: [...state.messages, { role: "ai", content: content.trim() }] };
}

// ===== Graph Execution =====

async function executeGraph(initialState: ChatState): Promise<ChatState> {
  let state = initialState;

  state = { ...state, ...(await classifierNode(state)) };

  if (state.query_type === "academic") state = { ...state, ...(await academicRagNode(state)) };
  else if (state.query_type === "fee") state = { ...state, ...(await feeRagNode(state)) };
  else state = { ...state, ...(await generalNode()) };

  state = { ...state, ...(await responseNode(state)) };
  return state;
}

// ===== API Handler =====

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const userMessage = (data.message || "").trim();
    const programmeId = data.programme_id || "1";

    if (!userMessage) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const studentProgramme = programmeMap[programmeId] || "General";

    if (!academicRetriever || !feeRetriever) {
      await initializeRetrievers();
    }

    const initialState: ChatState = {
      programme: studentProgramme,
      messages: [{ role: "human", content: userMessage }],
      query_type: "",
      retrieved_context: "",
    };

    const result = await executeGraph(initialState);
    const aiResponse = result.messages[result.messages.length - 1].content;

    return NextResponse.json({
      response: aiResponse,
      programme: studentProgramme,
      query_type: result.query_type,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
