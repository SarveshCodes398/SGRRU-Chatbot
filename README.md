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
2. **Pinecone API Key**: Create an index with 1024 dimensions at [pinecone.io](https://pinecone.io).
3. A Node.js server with sufficient memory and writable disk space for the local BGE embedding model.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Rename `.env.example` to `.env.local` and fill in your keys:
   ```bash
   GROQ_API_KEY=your_groq_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX=your_index_name_or_https_host_url
   ```

   `HF_TOKEN` and `GOOGLE_API_KEY` are not required. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`.

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
The chat endpoint runs embeddings locally, avoiding Hugging Face Inference Provider credit limits. The model downloads on first use. In production, configure `TRANSFORMERS_CACHE` to use writable persistent storage and ensure the server has enough memory for inference. Keep the Pinecone index at 1024 dimensions and re-run ingestion after switching from the old inference embeddings to refresh stored vectors.
