"use client";

import React, { useState, useRef, useEffect } from "react";
import Header from "@/components/header";
import { Send, Loader2 } from "lucide-react";

interface Message {
  role: "human" | "ai";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "human", content: userMsg }]);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s safety

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json();

      if (res.ok && data.response) {
        setMessages((prev) => [...prev, { role: "ai", content: data.response }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: data.error || "Sorry, something went wrong. Please try again.",
          },
        ]);
      }
    } catch (error: any) {
      const msg =
        error.name === "AbortError"
          ? "Request timed out. Please try a shorter question."
          : "Network error. Please check your connection and try again.";
      setMessages((prev) => [...prev, { role: "ai", content: msg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto p-4 flex flex-col items-center">
        <div
          className="w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden flex flex-col mt-8"
          style={{ height: "70vh" }}
        >
          {/* Header */}
          <div className="bg-red-700 text-white p-4">
            <h1 className="text-xl font-bold">SGRRU Assistant</h1>
            <p className="text-sm opacity-90">
              Ask me about academics, fees, or any college-related question
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                Hi! How can I help you today?
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] rounded-lg p-3 ${
                  m.role === "human"
                    ? "bg-red-100 text-red-900 self-end rounded-br-none"
                    : "bg-gray-100 text-gray-800 self-start rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="bg-gray-100 text-gray-800 self-start rounded-lg rounded-bl-none p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question here..."
                className="flex-1 border text-gray-800 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}