"use client";

// App entry: mount the in-memory game state and render the screen named by
// state.screen. Home is built (task 8); the other screens arrive in later tasks
// and show a temporary placeholder until then.
import { GameProvider, useGame } from "@/components/GameProvider";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { ConfigureRolesScreen } from "@/components/screens/ConfigureRolesScreen";
import { RevealScreen } from "@/components/screens/RevealScreen";
import { AllDoneScreen } from "@/components/screens/AllDoneScreen";

function ScreenRouter() {
  const { state, actions } = useGame();

  switch (state.screen) {
    case "home":
      return <HomeScreen />;
    case "configure":
      return <ConfigureRolesScreen />;
    case "reveal":
      return <RevealScreen />;
    case "allDone":
      return <AllDoneScreen />;
    default:
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-white">
          <p className="text-lg text-neutral-300">
            “{state.screen}” screen is coming in a later task.
          </p>
          <button
            type="button"
            onClick={actions.goHome}
            className="rounded-xl border border-neutral-700 px-6 py-3 font-semibold text-neutral-200 hover:bg-neutral-900"
          >
            Back to Home
          </button>
        </main>
      );
  }
}

export default function Page() {
  return (
    <GameProvider>
      <ScreenRouter />
    </GameProvider>
  );
}
