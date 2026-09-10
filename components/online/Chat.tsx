"use client";

// Reusable chat panel (FR-9; spec-2c FR-3/8/9/10). Live message list via useRoomChat,
// append via sendChatMessage — both channel-agnostic, so this one component serves lobby
// chat, Mafia chat, and Day chat alike; the caller picks the channel via `path`. When
// `canPost` is false the message list still renders live but there's no input/send
// control — the same read-only-vs-interactive split VotePanel already uses for `canVote`
// (an eliminated player reading Day chat, or anyone denied Mafia chat by the rules). The
// list scrolls within a bounded height and auto-scrolls to the newest message on a phone.

import { useEffect, useRef, useState } from "react";
import { useRoomChat } from "@/lib/room/subscriptions";
import { sendChatMessage, CHAT_MAX_LENGTH } from "@/lib/room/chat";

export function Chat({
  path,
  uid,
  name,
  canPost = true,
}: {
  path: string;
  uid: string | null;
  name: string;
  canPost?: boolean;
}) {
  const chat = useRoomChat(path);
  const messages = chat.data ?? [];
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as messages arrive.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (trimmed === "" || !uid) return;
    setText("");
    try {
      await sendChatMessage(path, uid, name, trimmed);
    } catch (e) {
      console.error("chat send failed:", e);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <span className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Chat
      </span>

      <div
        ref={listRef}
        className="flex max-h-48 flex-col gap-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug">
              <span className="font-semibold text-emerald-400">{m.name}</span>{" "}
              <span className="break-words text-white">{m.text}</span>
            </div>
          ))
        )}
      </div>

      {canPost && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            type="text"
            value={text}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message"
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={text.trim() === "" || !uid}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
