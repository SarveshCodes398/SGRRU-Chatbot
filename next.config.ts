/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['onnxruntime-node', '@xenova/transformers', '@huggingface/transformers'],
};
export default nextConfig;
