import { ObjectId, MongoServerError, type AnyBulkWriteOperation } from "mongodb";
import { z } from "zod";
import { withMongoSession } from "../lib/mongodb.ts";
import {
  getCollections,
  type GameDoc,
  type MatchEventDoc,
  type RunSubmissionDoc
} from "./collections.ts";
import { applyRatingDelta, getRatingDelta } from "./rating.ts";
import { getRoundBucketLabel, MAX_RUN_ROUNDS } from "./run-builder.ts";
import { verifyRunToken, type RunTokenPayload } from "./run-token.ts";

const endedReasonSchema = z.enum(["wrong_guess", "max_rounds", "abandoned"]);

const completeRunSelectionSchema = z.object({
  round: z.number().int().min(1).max(MAX_RUN_ROUNDS),
  pickedGameId: z.string().trim().min(1),
  completedAt: z.string().datetime()
});

export const completeRunRequestSchema = z.object({
  runId: z.string().trim().min(1),
  signedRunToken: z.string().trim().min(1),
  selections: z.array(completeRunSelectionSchema).max(MAX_RUN_ROUNDS),
  endedReason: endedReasonSchema,
  clientRunDurationMs: z.number().int().nonnegative()
});

export type CompleteRunRequest = z.infer<typeof completeRunRequestSchema>;

export type CompleteRunResponse = {
  accepted: true;
  roundsAccepted: number;
  finalScore: number;
  ratingVersion: string;
};

type SubmittedRound = {
  round: number;
  bucket: string;
  leftGameId: string;
  rightGameId: string;
  pickedGameId: string;
  correctGameId: string;
  snapshotLeftScore: number;
  snapshotRightScore: number;
  wasCorrect: boolean;
};

type MutableGameState = {
  id: ObjectId;
  currentScore: number;
};

type GameAggregate = {
  wins: number;
  losses: number;
  totalMatches: number;
  totalAppearances: number;
  currentScore: number;
};

export class RunCompletionValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RunCompletionValidationError";
    this.code = code;
  }
}

export class RunTokenValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RunTokenValidationError";
    this.code = code;
  }
}

export class DuplicateRunSubmissionError extends Error {
  readonly code = "duplicate_run_submission";

  constructor(message = "This run has already been submitted.") {
    super(message);
    this.name = "DuplicateRunSubmissionError";
  }
}

export async function completeRunSubmission(
  input: CompleteRunRequest,
  ipHash: string
): Promise<CompleteRunResponse> {
  const tokenPayload = await verifySignedRunToken(input.signedRunToken);

  if (tokenPayload.runId !== input.runId) {
    throw new RunTokenValidationError("run_id_mismatch", "Run ID does not match the issued token.");
  }

  const submittedRounds = buildSubmittedRounds(input, tokenPayload);

  const submittedAt = new Date();
  const ratingVersion = submittedAt.toISOString();

  try {
    const transactionResult = await withMongoSession(async (session, db) =>
      session.withTransaction(async () => {
        const collections = getCollections(db);
        const gameIds = getTouchedGameIds(submittedRounds);
        const games = await collections.games
          .find(
            {
              _id: {
                $in: gameIds
              }
            },
            {
              session,
              projection: { _id: 1, currentScore: 1 }
            }
          )
          .toArray();

        if (games.length !== gameIds.length) {
          throw new Error("One or more submitted games no longer exist in the database.");
        }

        const mutableStateById = new Map(
          games.map((game) => [
            game._id.toHexString(),
            {
              id: game._id,
              currentScore: game.currentScore
            } satisfies MutableGameState
          ])
        );

        const aggregatesById = new Map<string, GameAggregate>();
        const matchEvents: MatchEventDoc[] = [];
        let finalScore = 0;

        for (const round of submittedRounds) {
          const leftState = mutableStateById.get(round.leftGameId);
          const rightState = mutableStateById.get(round.rightGameId);

          if (!leftState || !rightState) {
            throw new Error(`Submitted round ${round.round} refers to an unavailable game.`);
          }

          const leftPreScore = leftState.currentScore;
          const rightPreScore = rightState.currentScore;
          const isTie = leftPreScore === rightPreScore;

          if (isTie) {
            const tieDelta = 3;
            const pickedLeft = round.pickedGameId === round.leftGameId;

            const leftDelta = pickedLeft ? tieDelta : -tieDelta;
            const rightDelta = pickedLeft ? -tieDelta : tieDelta;

            leftState.currentScore = leftPreScore + leftDelta;
            rightState.currentScore = rightPreScore + rightDelta;

            bumpAggregate(aggregatesById, round.leftGameId, leftState.currentScore, {
              wins: pickedLeft ? 1 : 0,
              losses: pickedLeft ? 0 : 1,
              totalMatches: 1,
              totalAppearances: 1
            });
            bumpAggregate(aggregatesById, round.rightGameId, rightState.currentScore, {
              wins: pickedLeft ? 0 : 1,
              losses: pickedLeft ? 1 : 0,
              totalMatches: 1,
              totalAppearances: 1
            });

            if (round.wasCorrect) {
              finalScore += 1;
            }

            matchEvents.push({
              _id: new ObjectId(),
              runId: input.runId,
              round: round.round,
              snapshotVersion: tokenPayload.snapshotVersion,
              leftGameId: leftState.id,
              rightGameId: rightState.id,
              pickedGameId: toObjectId(round.pickedGameId, "pickedGameId"),
              correctGameId: toObjectId(round.correctGameId, "correctGameId"),
              snapshotLeftScore: round.snapshotLeftScore,
              snapshotRightScore: round.snapshotRightScore,
              appliedLeftPreScore: leftPreScore,
              appliedRightPreScore: rightPreScore,
              appliedLeftPostScore: leftState.currentScore,
              appliedRightPostScore: rightState.currentScore,
              leftDelta,
              rightDelta,
              wasCorrect: round.wasCorrect,
              bucket: round.bucket,
              ipHash,
              submittedAt
            });
            continue;
          }

          const delta = getRatingDelta(
            round.leftGameId,
            leftPreScore,
            round.rightGameId,
            rightPreScore,
            round.pickedGameId
          );
          const pickedLeft = round.pickedGameId === round.leftGameId;
          const winnerPreScore = pickedLeft ? leftPreScore : rightPreScore;
          const loserPreScore = pickedLeft ? rightPreScore : leftPreScore;
          const applied = applyRatingDelta(winnerPreScore, loserPreScore, delta);

          const appliedLeftPostScore = pickedLeft ? applied.winnerPostScore : applied.loserPostScore;
          const appliedRightPostScore = pickedLeft ? applied.loserPostScore : applied.winnerPostScore;
          const leftDelta = pickedLeft ? delta.winnerDelta : applied.loserDelta;
          const rightDelta = pickedLeft ? applied.loserDelta : delta.winnerDelta;

          leftState.currentScore = appliedLeftPostScore;
          rightState.currentScore = appliedRightPostScore;

          bumpAggregate(aggregatesById, round.leftGameId, appliedLeftPostScore, {
            wins: pickedLeft ? 1 : 0,
            losses: pickedLeft ? 0 : 1,
            totalMatches: 1,
            totalAppearances: 1
          });
          bumpAggregate(aggregatesById, round.rightGameId, appliedRightPostScore, {
            wins: pickedLeft ? 0 : 1,
            losses: pickedLeft ? 1 : 0,
            totalMatches: 1,
            totalAppearances: 1
          });

          if (round.wasCorrect) {
            finalScore += 1;
          }

          matchEvents.push({
            _id: new ObjectId(),
            runId: input.runId,
            round: round.round,
            snapshotVersion: tokenPayload.snapshotVersion,
            leftGameId: leftState.id,
            rightGameId: rightState.id,
            pickedGameId: toObjectId(round.pickedGameId, "pickedGameId"),
            correctGameId: toObjectId(round.correctGameId, "correctGameId"),
            snapshotLeftScore: round.snapshotLeftScore,
            snapshotRightScore: round.snapshotRightScore,
            appliedLeftPreScore: leftPreScore,
            appliedRightPreScore: rightPreScore,
            appliedLeftPostScore,
            appliedRightPostScore,
            leftDelta,
            rightDelta,
            wasCorrect: round.wasCorrect,
            bucket: round.bucket,
            ipHash,
            submittedAt
          });
        }

        const gameUpdates = Array.from(aggregatesById.entries()).map(([gameId, aggregate]) => ({
          updateOne: {
            filter: { _id: toObjectId(gameId, "gameId") },
            update: {
              $set: {
                currentScore: aggregate.currentScore,
                lastSeenAt: submittedAt,
                updatedAt: submittedAt
              },
              $inc: {
                wins: aggregate.wins,
                losses: aggregate.losses,
                totalMatches: aggregate.totalMatches,
                totalAppearances: aggregate.totalAppearances
              }
            }
          }
        })) satisfies AnyBulkWriteOperation<GameDoc>[];

        const runSubmission: RunSubmissionDoc = {
          _id: new ObjectId(),
          runId: input.runId,
          snapshotVersion: tokenPayload.snapshotVersion,
          endedReason: input.endedReason,
          roundsAccepted: submittedRounds.length,
          finalScore,
          ipHash,
          submittedAt
        };

        await collections.runSubmissions.insertOne(runSubmission, { session });

        if (gameUpdates.length > 0) {
          await collections.games.bulkWrite(gameUpdates, { session });
        }

        if (matchEvents.length > 0) {
          await collections.matchEvents.insertMany(matchEvents, { session });
        }

        return {
          accepted: true as const,
          roundsAccepted: submittedRounds.length,
          finalScore,
          ratingVersion
        };
      })
    );

    if (!transactionResult) {
      throw new Error("Run completion transaction did not produce a result.");
    }

    return transactionResult;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new DuplicateRunSubmissionError();
    }

    throw error;
  }
}


function buildSubmittedRounds(input: CompleteRunRequest, tokenPayload: RunTokenPayload): SubmittedRound[] {
  const selections = [...input.selections].sort((left, right) => left.round - right.round);

  if (selections.length === 0) {
    if (input.endedReason !== "abandoned") {
      throw new RunCompletionValidationError(
        "invalid_ended_reason",
        "Only abandoned runs may be submitted without selections."
      );
    }

    return [];
  }

  const duplicateRounds = findDuplicateRound(selections.map((selection) => selection.round));

  if (duplicateRounds !== null) {
    throw new RunCompletionValidationError(
      "duplicate_round_number",
      `Round ${duplicateRounds} was submitted more than once.`
    );
  }

  let currentLeftGameId = tokenPayload.initialPair.leftGameId;
  let currentRightGameId = tokenPayload.initialPair.rightGameId;
  const submittedRounds: SubmittedRound[] = [];

  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index];
    const expectedRound = index + 1;

    if (selection.round !== expectedRound) {
      throw new RunCompletionValidationError(
        "non_contiguous_rounds",
        "Submitted rounds must be contiguous from round 1."
      );
    }

    if (
      selection.pickedGameId !== currentLeftGameId &&
      selection.pickedGameId !== currentRightGameId
    ) {
      throw new RunCompletionValidationError(
        "invalid_picked_game",
        `Picked game for round ${selection.round} does not match the issued pair.`
      );
    }

    if (
      !tokenPayload.gameIds.includes(selection.pickedGameId) ||
      !tokenPayload.gameIds.includes(currentLeftGameId) ||
      !tokenPayload.gameIds.includes(currentRightGameId)
    ) {
      throw new RunCompletionValidationError(
        "unknown_game_id",
        `Round ${selection.round} refers to a game outside the issued run.`
      );
    }

    const snapshotLeftScore = getSnapshotScore(tokenPayload, currentLeftGameId);
    const snapshotRightScore = getSnapshotScore(tokenPayload, currentRightGameId);
    const isTie = snapshotLeftScore === snapshotRightScore;
    const correctGameId = isTie
      ? null
      : snapshotLeftScore > snapshotRightScore
        ? currentLeftGameId
        : currentRightGameId;

    submittedRounds.push({
      round: selection.round,
      bucket: getRoundBucketLabel(selection.round, tokenPayload.challengerQueue),
      leftGameId: currentLeftGameId,
      rightGameId: currentRightGameId,
      pickedGameId: selection.pickedGameId,
      correctGameId: isTie ? currentLeftGameId : correctGameId!,
      snapshotLeftScore,
      snapshotRightScore,
      wasCorrect: isTie || selection.pickedGameId === correctGameId
    });

    if (selection.round < selections.length) {
      const nextChallenger = tokenPayload.challengerQueue.find(
        (challenger) => challenger.round === selection.round + 1
      );

      if (!nextChallenger) {
        throw new RunTokenValidationError(
          "invalid_run_token",
          `Issued run token is missing the challenger for round ${selection.round + 1}.`
        );
      }

      currentLeftGameId = selection.pickedGameId;
      currentRightGameId = nextChallenger.gameId;
    }
  }

  validateRoundTermination(input.endedReason, submittedRounds);

  return submittedRounds;
}

function validateRoundTermination(
  endedReason: CompleteRunRequest["endedReason"],
  submittedRounds: SubmittedRound[]
) {
  const firstIncorrectRound = submittedRounds.findIndex((round) => !round.wasCorrect);

  if (firstIncorrectRound !== -1 && firstIncorrectRound !== submittedRounds.length - 1) {
    throw new RunCompletionValidationError(
      "invalid_round_sequence",
      "No rounds may follow a wrong guess."
    );
  }

  const expectedEndedReason =
    firstIncorrectRound !== -1
      ? "wrong_guess"
      : submittedRounds.length === MAX_RUN_ROUNDS
        ? "max_rounds"
        : "abandoned";

  if (endedReason !== expectedEndedReason) {
    throw new RunCompletionValidationError(
      "invalid_ended_reason",
      `Expected endedReason ${expectedEndedReason} for the submitted selections.`
    );
  }
}

function getSnapshotScore(tokenPayload: RunTokenPayload, gameId: string) {
  const snapshotScore = tokenPayload.snapshotScores[gameId];

  if (typeof snapshotScore !== "number" || !Number.isFinite(snapshotScore)) {
    throw new RunTokenValidationError(
      "invalid_run_token",
      `Issued run token is missing the snapshot score for game ${gameId}.`
    );
  }

  return snapshotScore;
}

function getTouchedGameIds(submittedRounds: SubmittedRound[]) {
  const gameIds = new Set<string>();

  for (const round of submittedRounds) {
    gameIds.add(round.leftGameId);
    gameIds.add(round.rightGameId);
  }

  return Array.from(gameIds, (gameId) => toObjectId(gameId, "gameId"));
}

function bumpAggregate(
  aggregatesById: Map<string, GameAggregate>,
  gameId: string,
  currentScore: number,
  increments: Omit<GameAggregate, "currentScore">
) {
  const existing = aggregatesById.get(gameId);

  if (existing) {
    existing.wins += increments.wins;
    existing.losses += increments.losses;
    existing.totalMatches += increments.totalMatches;
    existing.totalAppearances += increments.totalAppearances;
    existing.currentScore = currentScore;
    return;
  }

  aggregatesById.set(gameId, {
    ...increments,
    currentScore
  });
}

function findDuplicateRound(rounds: number[]) {
  const seen = new Set<number>();

  for (const round of rounds) {
    if (seen.has(round)) {
      return round;
    }

    seen.add(round);
  }

  return null;
}

async function verifySignedRunToken(signedRunToken: string) {
  try {
    return await verifyRunToken(signedRunToken);
  } catch {
    throw new RunTokenValidationError(
      "invalid_run_token",
      "Run token is invalid, expired, or malformed."
    );
  }
}

function toObjectId(value: string, fieldName: string) {
  if (!ObjectId.isValid(value)) {
    throw new RunTokenValidationError(
      "invalid_run_token",
      `${fieldName} is not a valid ObjectId.`
    );
  }

  return new ObjectId(value);
}
