# Vercel Deployment Guide for SGRRU Chatbot

## 🚀 Quick Fix Summary

The Python API reads and splits the official PDFs from `backend/pdfs`. Vercel only proxies requests and does not parse PDFs or build embeddings.

## ✅ Changes Made

The frontend remains on Vercel and the RAG backend runs as a separate FastAPI service. Vercel's `/api/chat` endpoint proxies requests to that Python service.

### 1. Updated `src/app/api/chat/route.ts`
- Proxies chat requests to `PYTHON_BACKEND_URL`
- Keeps the Python URL and AI keys server-side

### 2. Added `backend/main.py`
- Runs FastAPI, FAISS semantic search, Hugging Face embeddings, and Groq structured output
- Reads `backend/pdfs/brochure.pdf` and `backend/pdfs/fee.pdf` at backend startup

### 3. Updated `package.json`
- Removed the obsolete Node PDF extraction command and dependency

### 4. Updated `next.config.ts`
- Removed PDF native package externalization because the API no longer imports it

## 📋 Deployment Checklist

### Required Environment Variables on Vercel

1. **PYTHON_BACKEND_URL** (Required on Vercel)
   - The public URL of the deployed Python service, for example `https://sgrru-chatbot-api.onrender.com`

2. **GROQ_API_KEY** (Required on the Python service)
   - Go to [Vercel Dashboard](https://vercel.com/) → Your Project → Settings → Environment Variables
   - Add `GROQ_API_KEY` with your API key from Groq
   - Make sure it's available for Production, Preview, and Development environments
   - Never commit this to GitHub.

3. **HF_TOKEN** (Required on the Python service)
   - A Hugging Face token with inference permissions.

4. **FRONTEND_URL** (Required on the Python service)
   - Your Vercel URL, for example `https://your-project.vercel.app`.

### Make the bot publicly accessible

If the deployed site or `/api/chat` returns `401` before reaching the app, disable deployment authentication for the public deployment:

1. Open the Vercel project settings.
2. Open **Deployment Protection**.
3. Disable **Vercel Authentication** (and any password or protection option enabled for the deployment).
4. Redeploy the project.

The chat API is intentionally server-side. `GROQ_API_KEY` must remain a Vercel server environment variable and must not be exposed as a `NEXT_PUBLIC_` variable.

### Steps to Deploy

1. **Push changes to GitHub**
   ```bash
   git add .
   git commit -m "Fix Vercel deployment: use fetch for PDF access"
   git push origin main
   ```

2. **Deploy the Python backend**
   - Create a Render or Railway web service from this repository.
   - Set the root directory to `backend`.
   - Build command: `pip install -r requirements.txt`.
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
   - Add `GROQ_API_KEY`, `HF_TOKEN`, and `FRONTEND_URL`.

3. **Deploy on Vercel**
   - Go to your Vercel project dashboard
   - The deployment should trigger automatically
   - If not, manually trigger a redeploy

4. **Verify Environment Variables**
   - After deployment, check that `PYTHON_BACKEND_URL` is set in Project Settings
   - The variable should show as "Configured" in the deployment logs

## 🔍 Troubleshooting

### If you still see HTTP 500 errors:

1. **Check Vercel Function Logs**
   - Go to Deployments → Click on the latest deployment
   - Click on the "Functions" tab
   - Look for errors in the `/api/chat` function logs

2. **Common Issues:**
   
   | Error | Solution |
   |-------|----------|
   | `GROQ_API_KEY is not configured` | Add the environment variable in Vercel settings |
   | `DOMMatrix is not defined` | Redeploy the latest commit; the API no longer parses PDFs at runtime |
   | `Module not found` | Run `npm install` and ensure all dependencies are installed |

3. **Check PDF Files**
   - Ensure both `backend/pdfs/brochure.pdf` and `backend/pdfs/fee.pdf` exist
   - Files must be included in the Python service repository

### Testing Locally Before Deploying

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test the API directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the fee structures?"}'
```

You should see a JSON response with the answer, not an error.

## 🎯 Pro Tips for Vercel Deployment

1. **Use Vercel's built-in environment variables**
   - `VERCEL_URL` is automatically available in production
   - `VERCEL_ENV` tells you if you're in production, preview, or development

2. **Monitor cold starts**
   - The first request after deployment might be slow (cold start)
   - Subsequent requests should be faster due to caching

3. **Check bundle size**
   - Large dependencies can increase cold start times
   - Consider removing unused dependencies

4. **Enable edge caching**
   - The code includes `next: { revalidate: 3600 }` for edge caching
   - This caches fetched PDFs for 1 hour at the edge

## 📞 Still Having Issues?

If you're still experiencing problems after these changes:

1. Share the exact error message from Vercel logs
2. Check if the deployment completes successfully (green checkmark)
3. Test with a simple message first (e.g., "Hello")
4. Verify your GROQ_API_KEY is valid by testing locally

## 🔗 Useful Links

- [Vercel Next.js Documentation](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Function Logs](https://vercel.com/docs/concepts/limits/overview#serverless-function-execution-timeout)
