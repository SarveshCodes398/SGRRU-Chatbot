# Vercel Deployment Guide for SGRRU Chatbot

## 🚀 Quick Fix Summary

The API now uses pre-extracted document chunks from `src/data/official-documents.json`. PDF parsing happens only in the local extraction script, so the Vercel function does not load PDF.js, `@napi-rs/canvas`, or browser DOM APIs such as `DOMMatrix`.

## ✅ Changes Made

### 1. Updated `src/app/api/chat/route.ts`
- Removed request-time PDF parsing and static PDF fetching
- Loads the committed, pre-chunked official document data
- Keeps the Vercel function free of native PDF dependencies

### 2. Updated `package.json`
- Added `npm run extract:pdf` for refreshing document data after PDF changes
- Keeps `pdf-parse` as a development-only extraction tool

### 3. Updated `next.config.ts`
- Removed PDF native package externalization because the API no longer imports it

## 📋 Deployment Checklist

### Required Environment Variables on Vercel

1. **GROQ_API_KEY** (Required)
   - Go to [Vercel Dashboard](https://vercel.com/) → Your Project → Settings → Environment Variables
   - Add `GROQ_API_KEY` with your API key from Groq
   - Make sure it's available for Production, Preview, and Development environments
   - ⚠️ **Never commit this to GitHub!**

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

2. **Deploy on Vercel**
   - Go to your Vercel project dashboard
   - The deployment should trigger automatically
   - If not, manually trigger a redeploy

3. **Verify Environment Variables**
   - After deployment, check that `GROQ_API_KEY` is set in Project Settings
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
   - Ensure both `public/pdfs/brochure.pdf` and `public/pdfs/fee.pdf` exist
   - Files should be less than 10MB each (Vercel has size limits)
   - Files should be committed to Git (not in .gitignore)

### Testing Locally Before Deploying

```bash
# Install dependencies
npm install

# Refresh the committed document index only after changing a source PDF
npm run extract:pdf

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
