import { isSupabaseEnabled, supabase } from "../lib/supabaseClient";
import { apiRequest, isApiBackendEnabled } from "../lib/apiClient";
import {
  HISTORY_KEY,
  PROFILE_ADDRESS_KEY,
  PROFILE_INFO_KEY,
} from "../lib/storageKeys";

function readLocalHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(Array.isArray(items) ? items : []));
}

function mergeLocalProfile(profile) {
  if (!profile || typeof profile !== "object") return;
  const info = {
    name: profile.name || "",
    phone: profile.phone || "",
    email: profile.email || "",
  };
  const address = {
    label: profile.address?.label || "Rumah",
    detail: profile.address?.detail || "",
    city: profile.address?.city || "",
  };
  localStorage.setItem(PROFILE_INFO_KEY, JSON.stringify(info));
  localStorage.setItem(PROFILE_ADDRESS_KEY, JSON.stringify(address));
}

function mapHistoryRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      ...(row.payload || {}),
      id: row.item_id || row.payload?.id,
      createdAt:
        row.payload?.createdAt ||
        Date.parse(String(row.created_at || "")) ||
        Date.now(),
    }))
    .filter((row) => row && row.id);
}

export async function hydrateUserDataFromCloud(userId) {
  if (!userId) return;

  if (isApiBackendEnabled()) {
    try {
      const data = await apiRequest("/me/sync");
      if (data?.profile) {
        mergeLocalProfile({
          name: data.profile.name,
          phone: data.profile.phone,
          email: data.profile.email,
          address: data.profile.address,
        });
      }
      if (Array.isArray(data?.history)) {
        writeLocalHistory(mapHistoryRows(data.history));
      }
    } catch {
      /* offline / error — tetap pakai cache lokal */
    }
    return;
  }

  if (!isSupabaseEnabled || !supabase) return;

  const [profileRes, historyRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("user_history")
      .select("item_id, payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (!profileRes.error && profileRes.data) {
    mergeLocalProfile(profileRes.data);
  }

  if (!historyRes.error && Array.isArray(historyRes.data)) {
    writeLocalHistory(mapHistoryRows(historyRes.data));
  }
}

export async function upsertProfileToCloud(userId, profile) {
  if (!userId || !profile) return;

  if (isApiBackendEnabled()) {
    try {
      await apiRequest("/me/profile", {
        method: "PUT",
        json: {
          name: profile.name || "",
          phone: profile.phone || "",
          email: profile.email || "",
          address: profile.address ?? null,
        },
      });
    } catch {
      /* ignore */
    }
    return;
  }

  if (!isSupabaseEnabled || !supabase) return;
  await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      name: profile.name || "",
      phone: profile.phone || "",
      email: profile.email || "",
      address: profile.address || null,
    },
    { onConflict: "user_id" }
  );
}

export async function upsertHistoryItemToCloud(userId, item) {
  if (!userId || !item?.id) return;

  if (isApiBackendEnabled()) {
    try {
      await apiRequest(`/me/history/${encodeURIComponent(String(item.id))}`, {
        method: "PUT",
        json: item,
      });
    } catch {
      /* ignore */
    }
    return;
  }

  if (!isSupabaseEnabled || !supabase) return;
  await supabase.from("user_history").upsert(
    {
      user_id: userId,
      item_id: String(item.id),
      payload: item,
      created_at: new Date(item.createdAt || Date.now()).toISOString(),
    },
    { onConflict: "user_id,item_id" }
  );
}

export async function deleteHistoryItemFromCloud(userId, itemId) {
  if (!userId || !itemId) return;

  if (isApiBackendEnabled()) {
    try {
      await apiRequest(`/me/history/${encodeURIComponent(String(itemId))}`, {
        method: "DELETE",
      });
    } catch {
      /* ignore */
    }
    return;
  }

  if (!isSupabaseEnabled || !supabase) return;
  await supabase
    .from("user_history")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", String(itemId));
}

export function saveHistoryLocalWithCap(item, cap = 100) {
  const items = readLocalHistory();
  const next = [item, ...items].slice(0, cap);
  writeLocalHistory(next);
}
