"use client";

// Online Mode screen (FR-2, FR-3, FR-4, FR-5). Enter a name, then either CREATE GAME
// (become the moderator) or enter a 6-digit code and JOIN GAME. On success, routes to
// the Waiting Room. Online actions use the green accent; back arrow returns Home.

import { useState } from "react";
import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import { BackArrow } from "@/components/ui/BackArrow";
import { createRoom } from "@/lib/room/createRoom";
import { joinRoom, JoinRoomError } from "@/lib/room/joinRoom";
import { isValidRoomCode } from "@/lib/room/paths";

export function OnlineModeScreen() {
  const { state, actions } = useGame();
  const { uid, ready } = useAuthUid();
  const [name, setName] = useState(state.onlineName);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canAct = ready && !!uid && !busy;

  const handleCreate = async () => {
    setError(null);
    if (name.trim() === "") {
      setError("Please enter your name.");
      return;
    }
    if (!canAct) return;
    setBusy(true);
    try {
      const newCode = await createRoom(uid!);
      actions.enterWaitingRoom({ code: newCode, isModerator: true, name: name.trim() });
    } catch (e) {
      console.error(e);
      setError("Couldn't create a game. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    if (name.trim() === "") {
      setError("Please enter your name.");
      return;
    }
    if (!isValidRoomCode(code)) {
      setError("Enter the 6-digit game code.");
      return;
    }
    if (!canAct) return;
    setBusy(true);
    try {
      await joinRoom(code, uid!, name.trim());
      actions.enterWaitingRoom({ code, isModerator: false, name: name.trim() });
    } catch (e) {
      if (e instanceof JoinRoomError) {
        setError(e.message);
      } else {
        console.error(e);
        setError("Couldn't join the game. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-6 py-16 text-white">
      <BackArrow onBack={actions.goHome} label="Back to Home" />

      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-4xl font-extrabold tracking-tight text-red-600">
          Play Online
        </h1>

        <label className="flex flex-col gap-1 text-sm text-neutral-400">
          Your name
          <input
            type="text"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-lg text-white outline-none focus:border-emerald-500"
          />
        </label>

        <button
          type="button"
          onClick={handleCreate}
          disabled={!canAct}
          className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create Game
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3 text-neutral-500">
          <span className="h-px flex-1 bg-neutral-800" />
          <span className="text-sm uppercase tracking-widest">or</span>
          <span className="h-px flex-1 bg-neutral-800" />
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-400">
          Game code
          <input
            type="text"
            inputMode="numeric"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            aria-label="Game code"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white outline-none focus:border-emerald-500"
          />
        </label>

        <button
          type="button"
          onClick={handleJoin}
          disabled={!canAct}
          className="rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join Game
        </button>

        {error && (
          <p className="text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
