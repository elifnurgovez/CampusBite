"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function EcoChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Merhaba! Kampüs lezzetleri ve sürdürülebilir seçimler hakkında sorularını buraya yazabilirsin.",
    },
  ]);

  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    const t = input.trim();
    if (!t || sending) return;
    const uid = `u-${Date.now()}`;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: uid, role: "user", text: t },
    ];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        cache: "no-store",
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "Kısa bir ara verelim; biraz sonra tekrar dene. 🌿";
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", text: reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene. 🌿",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[200] flex flex-col items-end gap-3 p-4 sm:p-6">
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`pointer-events-auto flex max-h-[min(520px,70vh)] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-[24px] border-2 border-emerald-200/80 bg-gradient-to-b from-[#f4fbf7] to-white shadow-2xl shadow-emerald-900/10 ring-1 ring-emerald-100/90 transition-all duration-300 ease-out ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-200/60 bg-white/90 px-4 py-3 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg shadow-md"
              aria-hidden
            >
              🌿
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-bold text-[#1a2e35]">
                EcoChat
              </h2>
              <p className="truncate text-[11px] font-semibold text-emerald-700/90">
                Sürdürülebilirlik asistanı
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full p-2 text-[#1a2e35]/50 transition hover:bg-emerald-100/80 hover:text-[#1a2e35]"
            aria-label="Sohbeti kapat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm font-semibold leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "rounded-br-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                    : "rounded-bl-md border border-emerald-100/80 bg-white/95 text-[#1a2e35]"
                }`}
              >
                {msg.role === "assistant" && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    EcoChat
                  </p>
                )}
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <footer className="shrink-0 border-t border-emerald-200/50 bg-white/80 p-3 backdrop-blur-sm">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={inputId}>
              Mesaj
            </label>
            <input
              id={inputId}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !sending) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Mesaj yaz…"
              disabled={sending}
              className="min-w-0 flex-1 rounded-xl border border-emerald-200/70 bg-white px-3 py-2.5 text-sm font-medium text-[#1a2e35] outline-none ring-emerald-300/30 placeholder:text-[#1a2e35]/35 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {sending ? "…" : "Gönder"}
            </button>
          </div>
        </footer>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-2xl shadow-lg shadow-emerald-900/20 transition hover:scale-105 hover:shadow-xl hover:shadow-emerald-900/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95"
        aria-label={open ? "EcoChat panelini kapat" : "EcoChat panelini aç"}
      >
        <span aria-hidden>💬</span>
      </button>
    </div>
  );
}
