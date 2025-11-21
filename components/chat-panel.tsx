'use client';

import { useCallback, useState } from "react";

import { ChatMessage, DigestEntry, QuickAction } from "@/types/digest";
import styles from "./chat-panel.module.css";

interface Props {
  seedMessages: ChatMessage[];
  quickActions: QuickAction[];
  latestDigest?: DigestEntry;
}

export function ChatPanel({ seedMessages, quickActions, latestDigest }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, actionId?: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
        actionId,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, actionId }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch reply.");
        }

        const data = (await response.json()) as { reply: ChatMessage };
        setMessages((prev) => [...prev, data.reply]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleAction = useCallback(
    (action: QuickAction) => {
      void sendMessage(action.prompt, action.id);
    },
    [sendMessage]
  );

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.label}>Release Pilot</p>
          <h3>What shipped & how it’s doing</h3>
        </div>
        {latestDigest ? (
          <p className={styles.muted}>
            Last updated {new Date(latestDigest.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : null}
      </header>

      <div className={styles.messages}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.bubble} ${styles[message.role]}`}
          >
            <p>{message.content}</p>
            <small>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
        ))}
        {isLoading ? <p className={styles.typing}>Drafting digest...</p> : null}
      </div>

      <div className={styles.actions}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            className={styles.action}
            type="button"
            onClick={() => handleAction(action)}
          >
            <span>{action.label}</span>
            <small>{action.description}</small>
          </button>
        ))}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about release health or digests…"
          aria-label="Ask Release Pilot"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "…" : "Send"}
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

