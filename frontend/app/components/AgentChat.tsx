"use client";

import { useState, type FormEvent } from "react";

type ChatMessage = { role: "user" | "model"; text: string };

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : `發生錯誤：${data.error ?? "未知錯誤"}`;
      setMessages([...nextMessages, { role: "model", text: reply }]);
    } catch {
      setMessages([...nextMessages, { role: "model", text: "網路連線失敗，請稍後再試。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      onClick={(e) => e.stopPropagation()}
    >
      {open && (
        <div className="flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-emerald-100 bg-emerald-600 px-4 py-3">
            <span className="text-sm font-semibold text-white">CIP 小樹洞助理</span>
            <button onClick={() => setOpen(false)} className="text-white/90 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500">
                問我「最近哪個高股息ETF關鍵字最熱門？」之類的問題吧！
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-950"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && <div className="text-sm text-emerald-700">思考中…</div>}
          </div>

          <form onSubmit={send} className="flex shrink-0 gap-2 border-t border-emerald-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入問題…"
              className="flex-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-950 outline-none placeholder:text-zinc-400 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              送出
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg hover:bg-emerald-700"
        title="詢問 CIP 小樹洞助理"
      >
        💬
      </button>
    </div>
  );
}
