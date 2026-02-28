/** Game metadata within a run (mirrors RunGamePayload from the server). */
export type RunGame = {
  id: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  snapshotScore: number;
  seedRank: number;
};

/** Challenger queue entry from the run definition. */
export type RunChallenger = {
  round: number;
  gameId: string;
  bucket: string;
};

/** Response body from POST /api/runs. */
export type CreateRunResponse = {
  runId: string;
  snapshotVersion: string;
  issuedAt: string;
  expiresAt: string;
  bandModel: string;
  initialPair: {
    leftGameId: string;
    rightGameId: string;
  };
  challengerQueue: RunChallenger[];
  games: Record<string, RunGame>;
  signedRunToken: string;
};

/** A player pick for one round. */
export type RunSelection = {
  round: number;
  pickedGameId: string;
  completedAt: string;
};

/** Request body for POST /api/runs/complete. */
export type CompleteRunRequest = {
  runId: string;
  signedRunToken: string;
  selections: RunSelection[];
  endedReason: "wrong_guess" | "max_rounds" | "abandoned";
  clientRunDurationMs: number;
};

/** Response body from POST /api/runs/complete. */
export type CompleteRunResponse = {
  accepted: true;
  roundsAccepted: number;
  finalScore: number;
  ratingVersion: string;
};

/** Single item in the leaderboard response. */
export type LeaderboardItem = {
  id: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  currentScore: number;
  seedRank: number;
  wins: number;
  losses: number;
  totalMatches: number;
};

/** Response body from GET /api/leaderboard. */
export type LeaderboardResponse = {
  items: LeaderboardItem[];
  generatedAt: string;
};

/** State machine phases for useGame. */
export type GameState =
  | "LOADING"
  | "READY"
  | "AWAITING_CHOICE"
  | "REVEALING"
  | "CORRECT"
  | "INCORRECT"
  | "TRANSITIONING"
  | "GAME_OVER";
