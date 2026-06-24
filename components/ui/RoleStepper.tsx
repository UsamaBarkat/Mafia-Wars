"use client";

// One role row: name + count with − / + steppers (FR-2). Disables − at 0 and +
// at the cap (FR-4). Presentational: it reports intent via callbacks and holds no
// game logic. An optional onRemove renders a remove control for custom roles (FR-6).

type RoleStepperProps = {
  name: string;
  count: number;
  cap: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** When provided, shows a remove control (custom roles only). */
  onRemove?: () => void;
};

const stepButton =
  "flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 text-xl leading-none text-neutral-100 hover:bg-neutral-800 active:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function RoleStepper({
  name,
  count,
  cap,
  onDecrement,
  onIncrement,
  onRemove,
}: RoleStepperProps) {
  const atMin = count <= 0;
  const atMax = count >= cap;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-lg text-white">{name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={atMin}
          aria-label={`Decrease ${name}`}
          className={stepButton}
        >
          −
        </button>
        <span
          className="w-8 text-center text-lg font-semibold tabular-nums text-white"
          aria-label={`${name} count`}
        >
          {count}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={atMax}
          aria-label={`Increase ${name}`}
          className={stepButton}
        >
          +
        </button>
      </div>
    </div>
  );
}
