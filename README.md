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
2. **Google Gemini API Key**: For fast, high-quality text embeddings. Get it from Google AI Studio.
3. **Pinecone API Key**: Create a free vector index at [pinecone.io](https://pinecone.io). Make sure the dimension size matches the embedding model (Google's `text-embedding-004` uses 768 dimensions).

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
   PINECONE_INDEX=your_index_name
   ```

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
This app is ready to be deployed to Vercel. Just connect your GitHub repo and add the environment variables in your Vercel project settings.
