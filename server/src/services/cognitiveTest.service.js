import { ValidationError } from "../domain/errors/AppError.js";
import * as cognitiveRepo from "../repositories/cognitiveTest.repository.js";
import { parseBigIntId } from "../repositories/sqlBigInt.js";

function ensureEmployeeUserId(userId) {
  if (parseBigIntId(userId) == null) {
    throw new ValidationError("Akun tidak terhubung ke ID karyawan di server.");
  }
}

export async function savePvtResult(userId, data) {
  ensureEmployeeUserId(userId);
  const rawPayload = { ...data };
  await cognitiveRepo.upsertPvtResult(userId, {
    clientId: data.id,
    at: data.at,
    sessionId: data.sessionId ?? null,
    trials: data.trials,
    validTrials: data.validTrials,
    meanRtMs: data.meanRtMs,
    medianRtMs: data.medianRtMs,
    lapses: data.lapses,
    falseStarts: data.falseStarts,
    passed: data.passed,
    evaluationLabel: data.evaluationLabel,
    rawPayload,
  });
}

export async function saveMemoryResult(userId, data) {
  ensureEmployeeUserId(userId);
  const rawPayload = { ...data };
  await cognitiveRepo.upsertMemoryResult(userId, {
    clientId: data.id,
    at: data.at,
    sessionId: data.sessionId ?? null,
    rounds: data.rounds,
    roundsCorrect: data.roundsCorrect,
    maxSpan: data.maxSpan,
    sumCorrectLengths: data.sumCorrectLengths,
    score: data.score,
    passed: data.passed,
    evaluationLabel: data.evaluationLabel,
    rawPayload,
  });
}

export async function saveTestSession(userId, data) {
  ensureEmployeeUserId(userId);
  await cognitiveRepo.upsertTestSession(userId, {
    sessionId: data.sessionId,
    at: data.at,
    overallLevel: data.overall?.level ?? "",
    overall: data.overall,
    pvt: data.pvt,
    memory: data.memory,
  });
}
