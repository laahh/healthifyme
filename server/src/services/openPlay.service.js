import { NotFoundError, ValidationError, ForbiddenError } from "../domain/errors/AppError.js";
import * as repo from "../repositories/openPlay.repository.js";

const DEFAULT_COVERS = {
  padel: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
  tennis: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
  badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
  pickleball: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
  futsal: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  mini_soccer: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  sepak_bola: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  basketball: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80",
  volleyball: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80",
  running: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&auto=format&fit=crop&q=80",
  yoga: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80",
  fitness: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&auto=format&fit=crop&q=80",
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1517649763962-0c623066027e?w=800&auto=format&fit=crop&q=80";

function defaultCover(sportKey) {
  return DEFAULT_COVERS[String(sportKey || "").toLowerCase()] || FALLBACK_COVER;
}

export async function getHub(userId, query = {}) {
  const [sports, events] = await Promise.all([
    repo.listSports(),
    repo.listHubEvents(
      {
        q: query.q,
        sport: query.sport,
        city: query.city,
        limit: query.limit ? Number(query.limit) : 40,
      },
      userId
    ),
  ]);
  return { sports, events };
}

export async function getMine(userId) {
  return repo.listMine(userId);
}

/**
 * Chat ditutup (arsip) jika event dibatalkan/selesai, atau sudah lewat:
 * batasnya ends_at jika ada, kalau tidak starts_at + 24 jam.
 */
export function chatState(event) {
  if (!event) return "archived";
  if (event.status === "cancelled" || event.status === "done") return "archived";
  const startMs = new Date(event.starts_at).getTime();
  const endMs = event.ends_at
    ? new Date(event.ends_at).getTime()
    : startMs + 24 * 3600_000;
  if (Number.isNaN(endMs)) return "open";
  return Date.now() > endMs ? "archived" : "open";
}

function canChat(event) {
  return Boolean(event?.is_host || event?.my_status === "approved");
}

export async function getDetail(userId, eventId) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  const participants = await repo.listParticipants(eventId, {
    includePending: event.is_host,
  });
  const approved = participants.filter((p) => p.status === "approved");
  const pending = event.is_host ? participants.filter((p) => p.status === "pending") : [];
  const waitlist = event.is_host ? participants.filter((p) => p.status === "waitlist") : [];
  return {
    event,
    participants: approved,
    pending,
    waitlist,
    chat_state: chatState(event),
    can_chat: canChat(event),
  };
}

export async function create(userId, body) {
  if (!String(body?.title || "").trim()) throw new ValidationError("Judul wajib.");
  if (!String(body?.sport_key || "").trim()) throw new ValidationError("Olahraga wajib.");
  if (!body?.starts_at) throw new ValidationError("Waktu mulai wajib.");
  const starts = new Date(body.starts_at);
  if (Number.isNaN(starts.getTime())) throw new ValidationError("Format waktu tidak valid.");
  if (starts.getTime() < Date.now() - 60_000) {
    throw new ValidationError("Waktu mulai harus di masa depan.");
  }
  const cover =
    String(body?.cover_url || "").trim() || defaultCover(body.sport_key);
  const event = await repo.createEvent(userId, { ...body, cover_url: cover });
  if (!event) throw new ValidationError("Gagal membuat event.");
  return event;
}

export async function update(userId, eventId, body) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (!event.is_host) throw new ForbiddenError("Hanya host yang bisa mengubah event.");
  if (body?.status === "cancelled") {
    return repo.updateEvent(eventId, userId, { status: "cancelled" });
  }
  const patch = {};
  for (const key of [
    "title",
    "sport_key",
    "starts_at",
    "ends_at",
    "place",
    "city",
    "address_note",
    "capacity",
    "skill_level",
    "fee_note",
    "description",
    "cover_url",
  ]) {
    if (body?.[key] !== undefined) patch[key] = body[key];
  }
  if (body?.status && ["open", "full", "cancelled", "done"].includes(body.status)) {
    patch.status = body.status;
  }
  const updated = await repo.updateEvent(eventId, userId, patch);
  if (patch.capacity != null) await repo.refreshEventCapacityStatus(eventId);
  return repo.findEventById(eventId, userId) || updated;
}

export async function join(userId, eventId, body = {}) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (event.status === "cancelled") throw new ValidationError("Event sudah dibatalkan.");
  if (event.status === "done") throw new ValidationError("Event sudah selesai.");
  if (event.is_host) throw new ValidationError("Host sudah tergabung sebagai peserta.");
  if (event.my_status === "approved") throw new ValidationError("Kamu sudah join.");
  if (event.my_status === "pending") throw new ValidationError("Request masih menunggu persetujuan.");
  if (event.my_status === "waitlist") throw new ValidationError("Kamu sudah di waitlist.");

  const updated = await repo.requestJoin(eventId, userId, body.note);
  if (!updated) throw new ValidationError("Gagal request join.");
  return updated;
}

export async function leave(userId, eventId) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (event.is_host) throw new ForbiddenError("Host tidak bisa leave. Batalkan event jika perlu.");
  if (!event.my_status || event.my_status === "cancelled" || event.my_status === "rejected") {
    throw new ValidationError("Kamu belum tergabung di event ini.");
  }
  return repo.cancelJoin(eventId, userId);
}

export async function listChat(userId, eventId, afterId) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (!canChat(event)) {
    throw new ForbiddenError("Chat hanya untuk peserta yang sudah di-approve.");
  }
  const messages = await repo.listMessages(eventId, afterId);
  return { messages, chat_state: chatState(event) };
}

export async function sendChat(userId, eventId, { body, image_url } = {}) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (!canChat(event)) {
    throw new ForbiddenError("Chat hanya untuk peserta yang sudah di-approve.");
  }
  if (chatState(event) === "archived") {
    throw new ForbiddenError("Chat sudah diarsipkan karena event telah berlalu.");
  }
  const text = String(body || "").trim();
  const image = String(image_url || "").trim();
  if (!text && !image) throw new ValidationError("Isi pesan atau lampirkan foto.");
  const message = await repo.sendMessage(eventId, userId, {
    body: text || null,
    image_url: image || null,
  });
  if (!message) throw new ValidationError("Gagal mengirim pesan.");
  return message;
}

export async function decide(userId, eventId, targetUserId, decision) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new ValidationError("Decision harus approved atau rejected.");
  }
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event Main Bareng tidak ditemukan.");
  if (!event.is_host) throw new ForbiddenError("Hanya host yang bisa approve/tolak.");
  if (String(targetUserId) === String(userId)) {
    throw new ValidationError("Tidak bisa decide diri sendiri.");
  }
  const result = await repo.decideParticipant(eventId, userId, targetUserId, decision);
  if (!result?.event) throw new ValidationError("Peserta tidak ditemukan atau status tidak valid.");
  return result;
}
