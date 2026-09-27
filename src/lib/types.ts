/** Game metadata within a run. */
export type RunGame = {
  id: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  snapshotScore: number;
  seedRank: number;
};

/** Fixed pair issued for a playable run round. */
export type RunPair = {
  round: number;
  leftGameId: string;
  rightGameId: string;
  bucket: string;
};

/** Response body from POST /api/runs. */
export type CreateRunResponse = {
  runId: string;
  expiresAt: string;
  roundPairs: RunPair[];
  games: Record<string, RunGame>;
  signedRunToken: string;
};

/** A player pick for one round. */
export type RunSelection = {
  round: number;
  pickedGameId: string;
  /** Informational only; the server ignores it. */
  completedAt?: string;
};

/** Request body for POST /api/runs/complete. */
export type CompleteRunRequest = {
  runId: string;
  signedRunToken: string;
  selections: RunSelection[];
};

/** Response body from POST /api/runs/complete. */
export type CompleteRunResponse = {
  accepted: true;
  roundsAccepted: number;
  finalScore: number;
  ratingVersion: string;
};

/** State machine phases for useGame. */
export type GameState =
  | "LOADING"
  | "ROUND_INTRO"
  | "AWAITING_CHOICE"
  | "REVEALING"
  | "CORRECT"
  | "INCORRECT"
  | "TRANSITIONING"
  | "TOURNAMENT_COMPLETE"
  | "GAME_OVER";
