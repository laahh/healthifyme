import * as historyRepo from "../repositories/userHistory.repository.js";
import * as employeeRepo from "../repositories/employeeProfile.repository.js";
import { isMcuPostgresConfigured } from "../config/env.js";
import { findLatestMcuBySid, mapMcuRowToUi } from "../repositories/mcuPg.repository.js";

export const MCU_HISTORY_ITEM_ID = "__mcu__";

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown> | null}
 */
function normalizeHistoryPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const mcu =
    payload.mcu && typeof payload.mcu === "object"
      ? payload.mcu
      : payload.type === "mcu" && payload.data && typeof payload.data === "object"
        ? payload.data
        : payload;

  if (!mcu || typeof mcu !== "object" || Array.isArray(mcu)) {
    return null;
  }

  const cleaned = { ...mcu };
  delete cleaned.type;
  delete cleaned.mcu;
  delete cleaned.data;

  const hasValue = Object.values(cleaned).some((v) => v != null && String(v).trim() !== "");
  return hasValue ? cleaned : null;
}

async function getMcuFromHistory(userId) {
  const row = await historyRepo.findHistoryItem(userId, MCU_HISTORY_ITEM_ID);
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  return normalizeHistoryPayload(payload);
}

/**
 * Ambil data MCU user: prioritas Postgres live (SID), fallback user_history.
 * @param {string} userId
 */
export async function getMcuForUser(userId) {
  if (isMcuPostgresConfigured()) {
    try {
      const employee = await employeeRepo.findEmployeeById(userId);
      const sid = String(employee?.kode_sid || "").trim();
      if (sid) {
        const row = await findLatestMcuBySid(sid);
        const mapped = mapMcuRowToUi(row);
        if (mapped) {
          return { mcu: mapped, source: "postgres" };
        }
        // SID known but no MCU row — still try history, then null
        const fromHistory = await getMcuFromHistory(userId);
        if (fromHistory) {
          return { mcu: fromHistory, source: "history" };
        }
        return { mcu: null, source: "postgres" };
      }
    } catch (err) {
      console.warn("[mcu] Postgres/SSH gagal, fallback history:", err?.message || err);
    }
  }

  const fromHistory = await getMcuFromHistory(userId);
  return { mcu: fromHistory, source: fromHistory ? "history" : null };
}
