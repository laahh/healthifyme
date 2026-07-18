import { useEffect, useRef, useState } from "react";
import { addComment, createPost, fetchComments, togglePostLike } from "../../lib/communityApi";
import { showError, showToast } from "../../lib/appAlert";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";

const ACCENT = "#8B1E2D";

function formatPostDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hari ini";
  if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatRelativeTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "baru saja";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} mnt`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hr`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function AvatarBubble({ name, photo, size = "md" }) {
  const dim = size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm";
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover bg-slate-100`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: ACCENT }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function CommentItem({ comment, replies, isMember, onReply }) {
  const [showReplies, setShowReplies] = useState(false);
  const replyCount = replies.length;

  return (
    <li className="flex gap-2.5">
      <AvatarBubble name={comment.author_name || comment.user_name} photo={comment.author_photo} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-slate-800">
          <span className="font-bold">{comment.author_name || comment.user_name || "Pengguna"}</span>{" "}
          <span className="whitespace-pre-wrap">{comment.body}</span>
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{formatRelativeTime(comment.created_at)}</span>
          {isMember ? (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="text-[11px] font-semibold text-slate-500"
            >
              Balas
            </button>
          ) : null}
        </div>

        {replyCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"
          >
            <span className="h-px w-6 bg-slate-300" />
            {showReplies ? "Sembunyikan balasan" : `Lihat ${replyCount} balasan`}
          </button>
        ) : null}

        {showReplies && replyCount > 0 ? (
          <ul className="mt-3 space-y-3">
            {replies.map((r) => (
              <li key={r.id} className="flex gap-2.5">
                <AvatarBubble name={r.author_name || r.user_name} photo={r.author_photo} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-slate-800">
                    <span className="font-bold">{r.author_name || r.user_name || "Pengguna"}</span>{" "}
                    <span className="whitespace-pre-wrap">{r.body}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{formatRelativeTime(r.created_at)}</span>
                    {isMember ? (
                      <button
                        type="button"
                        onClick={() => onReply(comment, r)}
                        className="text-[11px] font-semibold text-slate-500"
                      >
                        Balas
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** Bottom sheet komentar ala Instagram dengan balasan berjenjang */
function CommentsSheet({ open, onClose, post, isMember, onNeedJoin, onUpdated }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || !post?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setReplyTo(null);
    fetchComments(post.id)
      .then((d) => {
        if (!cancelled) setComments(d.comments || []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, post?.id]);

  useEffect(() => {
    if (!open) {
      setText("");
      setReplyTo(null);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 280);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, comments.length]);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_id) {
      (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    }
    return acc;
  }, {});

  const startReply = (parent, mention) => {
    setReplyTo(parent);
    const name = (mention || parent)?.author_name || "";
    setText(name ? `@${name} ` : "");
    inputRef.current?.focus();
  };

  const onSend = async (e) => {
    e.preventDefault();
    if (!isMember) {
      onNeedJoin?.();
      return;
    }
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const { comment } = await addComment(post.id, body, replyTo?.id || null);
      setComments((prev) => [...prev, comment]);
      setText("");
      setReplyTo(null);
      onUpdated?.({
        ...post,
        comment_count: (Number(post.comment_count) || 0) + 1,
      });
    } catch (err) {
      showError("Gagal mengirim komentar", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 flex h-[78vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200" />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-[15px] font-extrabold text-slate-900">Komentar</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Caption singkat post */}
        <div className="flex shrink-0 gap-2.5 border-b border-slate-50 px-4 py-3">
          <AvatarBubble name={post.author_name} photo={post.author_photo} size="sm" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-800">
            <span className="font-bold">{post.author_name}</span>{" "}
            <span className="whitespace-pre-wrap">{post.body}</span>
          </p>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">Memuat komentar…</p>
          ) : topLevel.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-200">chat_bubble</span>
              <p className="mt-3 text-sm font-bold text-slate-800">Belum ada komentar</p>
              <p className="mt-1 text-[12px] text-slate-500">Jadilah yang pertama berkomentar.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {topLevel.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  replies={repliesByParent[c.id] || []}
                  isMember={isMember}
                  onReply={startReply}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span className="text-[12px] text-slate-500">
                Membalas <span className="font-semibold text-slate-700">{replyTo.author_name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setText("");
                }}
                className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200"
                aria-label="Batal balas"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ) : null}
          {isMember ? (
            <form onSubmit={onSend} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyTo ? `Balas ${replyTo.author_name}…` : "Tambahkan komentar…"}
                maxLength={2000}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40 focus:bg-white"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="shrink-0 px-2 text-sm font-bold disabled:opacity-35"
                style={{ color: ACCENT }}
              >
                {busy ? "…" : "Kirim"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={onNeedJoin}
              className="w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Join untuk berkomentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, onUpdated, isMember, onNeedJoin, communityName, communityCity }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLike = async () => {
    if (!isMember || busy) return;
    setBusy(true);
    try {
      const { post: updated } = await togglePostLike(post.id);
      onUpdated?.(updated);
    } catch (err) {
      showError("Gagal update like", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    const text = `${post.author_name}: ${post.body || ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Post Komunitas", text, url: post.image_url || undefined });
      } else {
        await navigator.clipboard.writeText(text);
        showToast("Post disalin ke clipboard");
      }
    } catch {
      /* user membatalkan share */
    }
  };

  const likeCount = Number(post.like_count) || 0;
  const commentCount = Number(post.comment_count) || 0;
  const locationLine = [communityName, communityCity].filter(Boolean).join(", ");

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-start gap-3 px-4 pt-4">
          <AvatarBubble name={post.author_name} photo={post.author_photo} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900 truncate">{post.author_name}</p>
            <p className="text-[12px] text-slate-500">
              {formatPostDate(post.created_at)} · WELL App
            </p>
            {locationLine ? (
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-500">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span className="truncate">{locationLine}</span>
              </p>
            ) : null}
          </div>
        </div>

        <p className="px-4 pt-3 text-[19px] font-extrabold leading-snug text-slate-900 whitespace-pre-wrap">
          {post.body}
        </p>

        {post.image_url ? (
          <img
            src={post.image_url}
            alt=""
            className="mt-3 max-h-80 w-full object-cover bg-slate-100"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        <div className="flex items-center justify-between px-4 pt-3">
          <p className="text-[12px] text-slate-500">
            {likeCount > 0 ? `${likeCount} kudos` : "Jadilah yang pertama memberi kudos!"}
          </p>
          {commentCount > 0 ? (
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="text-[12px] font-semibold text-slate-500"
            >
              {commentCount} komentar
            </button>
          ) : null}
        </div>

        {commentCount > 0 ? (
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="block w-full px-4 pt-1 text-left text-[13px] text-slate-500"
          >
            Lihat semua komentar
          </button>
        ) : null}

        <div className="mt-2 flex items-stretch border-t border-slate-100">
          <button
            type="button"
            disabled={!isMember || busy}
            onClick={onLike}
            className="flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-slate-600 disabled:opacity-50"
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{
                color: post.liked_by_me ? ACCENT : undefined,
                fontVariationSettings: post.liked_by_me ? "'FILL' 1" : undefined,
              }}
            >
              thumb_up
            </span>
            {likeCount > 0 ? likeCount : ""}
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-slate-600"
          >
            <span className="material-symbols-outlined text-[22px]">mode_comment</span>
            {commentCount > 0 ? commentCount : ""}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex flex-1 items-center justify-center py-3 text-slate-600"
            aria-label="Bagikan post"
          >
            <span className="material-symbols-outlined text-[22px]">ios_share</span>
          </button>
        </div>
      </article>

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        post={post}
        isMember={isMember}
        onNeedJoin={onNeedJoin}
        onUpdated={onUpdated}
      />
    </>
  );
}

function ComposePostModal({
  open,
  onClose,
  body,
  setBody,
  imageUrl,
  setImageUrl,
  error,
  setError,
  busy,
  onSubmit,
}) {
  const fileRef = useRef(null);
  const [picking, setPicking] = useState(false);

  if (!open) return null;

  const previewUrl = String(imageUrl || "").trim();
  const showPreview =
    /^https?:\/\//i.test(previewUrl) || /^data:image\//i.test(previewUrl);

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar (JPG/PNG/WebP).");
      return;
    }
    setError("");
    setPicking(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressDataUrlForAi(String(reader.result || ""), {
          maxEdge: 1280,
          quality: 0.75,
        });
        setImageUrl(compressed);
      } catch {
        setError("Gagal memproses foto.");
      } finally {
        setPicking(false);
      }
    };
    reader.onerror = () => {
      setError("Gagal membaca foto.");
      setPicking(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Buat post</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Teks</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Bagikan update ke komunitas…"
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
            />
          </label>

          <div>
            <span className="text-[11px] font-semibold text-slate-600">Foto (opsional)</span>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={picking || busy}
                onClick={() => fileRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: ACCENT }}>
                  add_a_photo
                </span>
                {picking ? "Memproses…" : showPreview ? "Ganti foto" : "Upload foto"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickPhoto}
              />
            </div>
            {showPreview ? (
              <div className="relative mt-2">
                <img
                  src={previewUrl}
                  alt="Pratinjau"
                  className="max-h-48 w-full rounded-xl object-cover bg-slate-100"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Hapus foto"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500">Atau tempel URL gambar</span>
            <input
              value={/^data:image\//i.test(imageUrl) ? "" : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              disabled={/^data:image\//i.test(imageUrl)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || picking || !body.trim()}
            className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {busy ? "Mengirim…" : "Kirim post"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CommunityFeedPanel({
  communityId,
  posts,
  setPosts,
  isMember,
  onNeedJoin,
  communityName,
  communityCity,
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const closeCompose = () => {
    setComposeOpen(false);
    setError("");
  };

  const openCompose = () => {
    if (!isMember) {
      onNeedJoin?.();
      return;
    }
    setComposeOpen(true);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!isMember) {
      onNeedJoin?.();
      return;
    }
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { post } = await createPost(communityId, {
        body: body.trim(),
        image_url: imageUrl.trim() || undefined,
      });
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      setBody("");
      setImageUrl("");
      closeCompose();
      showToast("Post berhasil dibuat");
    } catch (err) {
      const msg = err?.message || "Gagal memposting.";
      const friendly = /Data too long|image_url|ER_DATA_TOO_LONG/i.test(msg)
        ? "Foto terlalu besar untuk DB saat ini. Jalankan migrate 013_community_post_image_text.sql, atau post tanpa foto."
        : msg;
      setError(friendly);
      showError("Gagal memposting", friendly);
    } finally {
      setBusy(false);
    }
  };

  const onUpdated = (updated) => {
    if (!updated?.id) return;
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  };

  return (
    <>
      <div className="space-y-3 pb-20">
        {!isMember ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center">
            <p className="text-sm font-bold text-slate-800">Join untuk posting</p>
            <p className="mt-1 text-[12px] text-slate-500">Tekan + untuk gabung atau buat post setelah join.</p>
            <button
              type="button"
              onClick={onNeedJoin}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Join Community
            </button>
          </div>
        ) : null}

        {posts.length === 0 ? (
          <div className="py-10 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300">dynamic_feed</span>
            <p className="mt-3 text-sm font-bold text-slate-800">Feed masih kosong</p>
            <p className="mt-1 text-[12px] text-slate-500 px-4">
              {isMember ? "Tekan + di pojok kanan bawah untuk memposting." : "Jadilah yang pertama setelah bergabung."}
            </p>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onUpdated={onUpdated}
              isMember={isMember}
              onNeedJoin={onNeedJoin}
              communityName={communityName}
              communityCity={communityCity}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={openCompose}
        aria-label="Buat post baru"
        className="fixed right-4 z-[75] flex size-14 items-center justify-center rounded-full text-white shadow-lg shadow-black/20 active:scale-95 transition-transform"
        style={{
          backgroundColor: ACCENT,
          bottom: "calc(4.25rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      <ComposePostModal
        open={composeOpen}
        onClose={closeCompose}
        body={body}
        setBody={setBody}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        error={error}
        setError={setError}
        busy={busy}
        onSubmit={onCreate}
      />
    </>
  );
}
