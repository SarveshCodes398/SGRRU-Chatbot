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
2. **Pinecone API Key**: Use the existing index containing the PDF chunks.

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

   `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`.

3. **Use the existing Pinecone data**
   The configured Pinecone index already contains the university PDF text. Do not run `scripts/ingest.ts` for normal deployment; it is only for intentionally adding or replacing PDF records.

4. **Run the App**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to start chatting!

## Deployment
The chat endpoint reads the existing PDF text stored as metadata in Pinecone's default namespace and ranks it locally. It does not create, update, or re-embed any Pinecone vectors, and does not require Hugging Face credits. Set `GROQ_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX` in Vercel Project Settings. No PDF re-ingestion is required.
