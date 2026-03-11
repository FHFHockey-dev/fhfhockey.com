type LineComboGroup = "forward" | "defense" | "goalie";

type LineCombinationLikeRow = {
  forwards: number[];
  defensemen: number[];
  goalies: number[];
};

type LineComboAssignment = {
  slot: number | null;
  positionGroup: LineComboGroup | null;
};

export const ROLLING_PLAYER_LINE_CONTEXT_CONTRACT = {
  labelKeys: ["line_combo_slot", "line_combo_group"],
  semanticType: "contextual_line_assignment_label",
  description:
    "Contextual line assignment labels sourced from the line combinations builder. Not rolling metrics.",
  authoritativeSource: {
    rowSource: "lineCombinations",
    fields: ["forwards", "defensemen", "goalies"]
  },
  freshnessDependencies: ["lineCombinations"],
  validationRequirements: [
    "Validate line_combo_slot and line_combo_group against refreshed lineCombinations rows for the same game/team.",
    "Do not infer line assignments from rolling metric values or PP context.",
    "Treat null slot/group as untrusted when a line row is missing or the player is absent from the builder row."
  ],
  staleRefreshActions: [
    "Rerun update-line-combinations/[id].ts for affected games before trusting line_combo fields.",
    "If line rows are broadly stale, rerun update-line-combinations/index.ts before revalidating rolling rows."
  ]
} as const;

export function resolveTrustedLineAssignment(args: {
  row: LineCombinationLikeRow | null | undefined;
  playerId: number;
}): {
  lineCombo: LineComboAssignment;
  hasSourceRow: boolean;
  hasTrustedAssignment: boolean;
} {
  const row = args.row;
  if (!row) {
    return {
      lineCombo: { slot: null, positionGroup: null },
      hasSourceRow: false,
      hasTrustedAssignment: false
    };
  }

  const findSlot = (list: number[], groupSize: number): number | null => {
    const index = list.findIndex((value) => value === args.playerId);
    if (index === -1) return null;
    return Math.floor(index / groupSize) + 1;
  };

  const forwardSlot = findSlot(row.forwards, 3);
  if (forwardSlot) {
    return {
      lineCombo: { slot: forwardSlot, positionGroup: "forward" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    };
  }

  const defenseSlot = findSlot(row.defensemen, 2);
  if (defenseSlot) {
    return {
      lineCombo: { slot: defenseSlot, positionGroup: "defense" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    };
  }

  const goalieSlot = findSlot(row.goalies, 1);
  if (goalieSlot) {
    return {
      lineCombo: { slot: goalieSlot, positionGroup: "goalie" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    };
  }

  return {
    lineCombo: { slot: null, positionGroup: null },
    hasSourceRow: true,
    hasTrustedAssignment: false
  };
}
