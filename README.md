# SGRR University Chatbot

A production-ready RAG Chatbot for SGRR University, built with Next.js, Langchain, Pinecone, and Groq.

## Features
- **Next.js App Router**: Fast, responsive UI with TailwindCSS.
- **RAG Architecture**: Uses Pinecone Vector DB to store PDF embeddings and retrieve context.
- **Fast Inference**: Uses Groq LLM API (`gemma2-9b-it`) for near-instant responses.
- **Streaming UI**: Custom stream parsing to render the assistant's answer in real-time as it's generated.
- **Guardrails**: Prompt engineering ensures the bot strictly answers university-related queries and always responds in English.

## Prerequisites
1. **Groq API Key**: Get one from [console.groq.com](https://console.groq.com/).
2. **Google API Key**: Enable the Gemini API in Google AI Studio. The app uses `gemini-embedding-001` for hosted 1024-dimensional embeddings.
3. **Pinecone API Key**: Create an index with 1024 dimensions at [pinecone.io](https://pinecone.io).

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Rename `.env.example` to `.env.local` and fill in your keys:
   ```bash
   GROQ_API_KEY=your_groq_key
   GOOGLE_API_KEY=your_google_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX=your_index_name_or_https_host_url
   ```

   `HF_TOKEN` is not required. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`.

3. **Ingest PDFs into Vector Database**
   Put your `fees.pdf` and `brochure.pdf` in the `data/` folder at the root of the project.
   Then run the ingestion script to chunk, embed, and store them:
   ```bash
   npx ts-node scripts/ingest.ts
   ```

4. **Run the App**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to start chatting!

## Deployment
The chat endpoint uses Google's hosted Gemini embedding API, so it does not download or run a local model in Vercel functions. Set `GOOGLE_API_KEY`, `GROQ_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX` in Vercel Project Settings for every deployment environment. The index must have 1024 dimensions. After deploying this embedding change, ingest PDFs again; the new embeddings are stored in the `sgrru-gemini-embedding-001` namespace and are intentionally isolated from older BGE vectors.
