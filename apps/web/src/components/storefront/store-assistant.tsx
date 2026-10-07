"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type ChatMessage = { role: "USER" | "ASSISTANT"; content: string };
type ThreadSummary = { id: string; updatedAt: string };

function messageWithProductLinks(content: string) {
  const matcher = /(\/ar\/products\/[a-z0-9]+(?:-[a-z0-9]+)*)/g;
  return content.split(matcher).map((part, index) => /^\/ar\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part)
    ? <Link key={`${part}-${index}`} href={part}>{part.replace("/ar/products/", "")}</Link>
    : <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>);
}

export function StoreAssistant({ locale = "ar", onClose, onThreadsAvailable, hidden = false }: { locale?: "ar" | "en"; onClose: () => void; onThreadsAvailable: (available: boolean) => void; hidden?: boolean }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [retryDraft, setRetryDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isArabic = locale === "ar";
  const text = isArabic ? {
    title: "اسألي شيمو", close: "إغلاق المساعد", input: "اكتبي سؤالك هنا…",
    send: "إرسال", loading: "أفكر…", welcome: "مرحبًا! أستطيع مساعدتك في المنتجات ومعلومات المتجر والطلبات.",
    unavailable: "المساعد غير متاح مؤقتًا. حاولي مرة أخرى لاحقًا.", auth: "سجّلي الدخول لاستخدام المساعد ومراجعة طلباتك.",
    retry: "إعادة المحاولة", newChat: "محادثة جديدة", error: "تعذر تحميل المحادثة.",
  } : {
    title: "Ask Shimo", close: "Close assistant", input: "Ask a question…",
    send: "Send", loading: "Thinking…", welcome: "Hello! I can help with products, store information, and your orders.",
    unavailable: "The assistant is temporarily unavailable. Please try again later.", auth: "Sign in to use the assistant and check your orders.",
    retry: "Try again", newChat: "New chat", error: "Could not load this conversation.",
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, loading, error]);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/ai/threads", { cache: "no-store" });
        if (response.status === 401) { if (!cancelled) setError("authentication-required"); return; }
        if (!response.ok) throw new Error();
        const data = await response.json() as { threads: ThreadSummary[] };
        if (cancelled) return;
        onThreadsAvailable(data.threads.length > 0);
        const latest = data.threads[0];
        if (!latest) return;
        setThreadId(latest.id);
        const history = await fetch(`/api/ai/threads/${encodeURIComponent(latest.id)}/messages`, { cache: "no-store" });
        if (!history.ok) throw new Error();
        const result = await history.json() as { messages: ChatMessage[] };
        if (!cancelled) setMessages(result.messages);
      } catch {
        if (!cancelled) setError("load-failed");
      }
    })();
    return () => { cancelled = true; };
  }, [hidden, onThreadsAvailable]);

  async function createThread() {
    const response = await fetch("/api/ai/threads", { method: "POST" });
    if (response.status === 401) throw new Error("authentication-required");
    if (response.status === 409) throw new Error("conversation-limit");
    if (!response.ok) throw new Error("assistant-unavailable");
    const data = await response.json() as { thread: ThreadSummary };
    onThreadsAvailable(true);
    setThreadId(data.thread.id);
    return data.thread.id;
  }

  async function submit(value: string) {
    const message = value.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    setRetryDraft("");
    try {
      const activeThread = threadId ?? await createThread();
      const response = await fetch(`/api/ai/threads/${encodeURIComponent(activeThread)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, locale }),
      });
      const data = await response.json().catch(() => null) as { error?: string; message?: ChatMessage } | null;
      if (response.status === 401) throw new Error("authentication-required");
      if (!response.ok || !data?.message) throw new Error("assistant-unavailable");
      setMessages((current) => [...current, { role: "USER", content: message }, data.message!]);
      setDraft("");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "assistant-unavailable";
      setError(code === "authentication-required" ? code : "assistant-unavailable");
      setRetryDraft(message);
    } finally {
      setLoading(false);
    }
  }

  async function startNewConversation() {
    setLoading(true);
    setError(null);
    try {
      await createThread();
      setMessages([]);
      setRetryDraft("");
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "authentication-required" ? "authentication-required" : "load-failed");
    } finally { setLoading(false); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(draft);
  }

  return <section className="store-assistant__panel" dir={isArabic ? "rtl" : "ltr"} aria-label={text.title} hidden={hidden}>
      <header className="store-assistant__header">
        <strong>{text.title}</strong>
        <div className="store-assistant__header-actions">
          <button type="button" onClick={() => void startNewConversation()} disabled={loading} aria-label={text.newChat}>{text.newChat}</button>
          <button type="button" onClick={onClose} aria-label={text.close}>×</button>
        </div>
      </header>
      <div className="store-assistant__messages" aria-live="polite" aria-busy={loading}>
        {messages.length === 0 && <p className="store-assistant__welcome">{text.welcome}</p>}
        {messages.map((message, index) => <p className={`store-assistant__message store-assistant__message--${message.role.toLowerCase()}`} key={`${index}-${message.role}`}>
          {message.role === "ASSISTANT" ? messageWithProductLinks(message.content) : message.content}
        </p>)}
        {loading && <p className="store-assistant__loading">{text.loading}</p>}
        {error && <div className="store-assistant__error">
          <p>{error === "authentication-required" ? text.auth : error === "load-failed" ? text.error : text.unavailable}</p>
          {error === "authentication-required" ? <Link href="/ar/login">{isArabic ? "تسجيل الدخول" : "Sign in"}</Link> : retryDraft && <button type="button" onClick={() => void submit(retryDraft)} disabled={loading}>{text.retry}</button>}
        </div>}
        <div ref={endRef} />
      </div>
      <form className="store-assistant__form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="store-assistant-message">{text.input}</label>
        <textarea id="store-assistant-message" value={draft} maxLength={2000} rows={2} placeholder={text.input} onChange={(event) => setDraft(event.target.value)} disabled={loading} />
        <button type="submit" disabled={loading || !draft.trim()}>{text.send}</button>
      </form>
    </section>;
}
