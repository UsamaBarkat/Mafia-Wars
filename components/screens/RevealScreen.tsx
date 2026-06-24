"use client";

// Reveal screen (FR-8, FR-9, FR-11). Forward-only, one player at a time, driven by
// the provider's assignment / revealIndex / revealShown.
//   hidden  → progress + "pass the phone" + "Click to see the role"; tap anywhere reveals
//   shown   → ONLY the bare role name + a bottom-right Next (advances and re-hides)
// The top-left back arrow opens a confirm before leaving (FR-11); confirm ends the
// reveal and goes Home, cancel stays put. Browser/hardware Back guard is task 14.

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/components/GameProvider";
import { BackArrow } from "@/components/ui/BackArrow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function RevealScreen() {
  const { state, actions } = useGame();
  const { assignment, revealIndex, revealShown } = state;
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Set true right before our own programmatic history.back() (in cleanup) so the
  // popstate it fires is ignored rather than treated as a user Back. Persists across
  // React Strict Mode's mount→unmount→remount, where the remounted listener would
  // otherwise catch that stray popstate and pop the dialog open on entry.
  const ignoreNextPopRef = useRef(false);

  // Browser/hardware Back guard (FR-11). On entering the reveal we push a history
  // entry; pushState never fires popstate, so arming is silent (no dialog on entry).
  // A real Back press pops the guard → popstate: two-step — if the confirm dialog is
  // open, Back closes it (cancel); otherwise Back opens it. Ending only happens via the
  // dialog's confirm button, never on a single Back press. We re-arm after each Back,
  // and pop the guard on unmount so Home/Configure/All Done Back is unaffected.
  useEffect(() => {
    window.history.pushState({ revealGuard: true }, "");

    const onPopState = () => {
      // Swallow the single programmatic back() our cleanup issues (see ref above).
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      // Real user Back: re-arm the guard, then two-step toggle the confirm dialog.
      window.history.pushState({ revealGuard: true }, "");
      setConfirmOpen((open) => !open);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Remove our guard entry so other screens' Back works normally. Mark the
      // resulting popstate to be ignored by any (Strict Mode) re-armed listener.
      if (window.history.state?.revealGuard) {
        ignoreNextPopRef.current = true;
        window.history.back();
      }
    };
  }, []);

  // Defensive: the router only mounts this with an assignment, but guard anyway.
  if (assignment === null) return null;

  const total = assignment.length;
  const playerNumber = revealIndex + 1;
  const role = assignment[revealIndex];

  return (
    <main className="relative flex min-h-screen flex-col bg-neutral-950 text-white">
      <BackArrow onBack={() => setConfirmOpen(true)} label="End reveal" />

      {!revealShown ? (
        // Whole hidden card is the tap target (FR-8).
        <button
          type="button"
          onClick={actions.revealCurrent}
          className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center"
        >
          <p className="text-lg uppercase tracking-[0.2em] text-neutral-400">
            Player {playerNumber} of {total}
          </p>
          <p className="text-xl text-neutral-200">
            Pass the phone to Player {playerNumber}
          </p>
          <p className="mt-8 text-2xl font-semibold text-red-500">
            Click to see the role
          </p>
        </button>
      ) : (
        // Revealed: only the role name. The card itself is inert; Next advances.
        <>
          {/* pb-28 reserves space so a long/wrapped name never sits under Next. */}
          <div className="flex flex-1 items-center justify-center px-6 pb-28 text-center">
            <span className="max-w-full break-words text-5xl font-extrabold tracking-tight sm:text-6xl">
              {role}
            </span>
          </div>
          <button
            type="button"
            onClick={actions.nextPlayer}
            className="absolute bottom-6 right-6 rounded-xl bg-red-700 px-8 py-4 text-lg font-bold uppercase tracking-wide text-white hover:bg-red-800 active:bg-red-900"
          >
            Next
          </button>
        </>
      )}

      {confirmOpen && (
        <ConfirmDialog
          message="End reveal and return Home? Roles won't be shown again"
          confirmLabel="End reveal"
          cancelLabel="Keep going"
          onConfirm={() => {
            setConfirmOpen(false);
            actions.endReveal();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </main>
  );
}
