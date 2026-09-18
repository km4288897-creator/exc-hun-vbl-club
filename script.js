const db = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_KEY
);

const BUCKET = "vbl-videos";

/* =========================
   SEGÉDFÜGGVÉNYEK
========================= */

function msg(id, text, bad = false) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = text;
  el.style.color = bad ? "#ff7777" : "#79c5ff";
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

/* =========================
   LÁTOGATÓ AZONOSÍTÓ
========================= */

function getVisitorId() {
  let id = localStorage.getItem("exc_vbl_visitor_id");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("exc_vbl_visitor_id", id);
  }

  return id;
}

const visitorId = getVisitorId();

/* =========================
   VIDEÓK BETÖLTÉSE
========================= */

async function loadVideos() {
  const box = document.getElementById("videoList");

  if (!box) return;

  box.innerHTML = '<p class="muted">Videók betöltése...</p>';

  const result = await db
    .from("videos")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (result.error) {
    box.innerHTML =
      '<p class="muted">Videóadatbázis hiba: ' +
      esc(result.error.message) +
      "</p>";
    return;
  }

  if (!result.data || result.data.length === 0) {
    box.innerHTML =
      '<p class="muted">Még nincs jóváhagyott videó.</p>';
    return;
  }

  /* LIKE SZÁMOK */

  const counts = await db.rpc("get_video_like_counts");

  const countMap = {};

  if (counts.data) {
    counts.data.forEach(item => {
      countMap[item.video_id] = Number(item.like_count || 0);
    });
  }

  /* SAJÁT LIKE-OK */

  const mine = await db
    .from("video_likes")
    .select("video_id")
    .eq("visitor_id", visitorId);

  const liked = new Set(
    (mine.data || []).map(item => item.video_id)
  );

  /* VIDEÓK MEGJELENÍTÉSE */

  box.innerHTML = result.data.map(video => {

    const publicUrl =
      db.storage
        .from(BUCKET)
        .getPublicUrl(video.file_path)
        .data.publicUrl;

    const alreadyLiked = liked.has(video.id);

    return `
      <article class="video-card">

        <video
          controls
          preload="metadata"
          src="${esc(publicUrl)}"
        ></video>

        <h3>${esc(video.title)}</h3>

        <div class="video-actions">

          <button
            class="like-btn"
            onclick="likeVideo('${video.id}')"
            ${alreadyLiked ? "disabled" : ""}
          >
            ${alreadyLiked ? "❤️ Lájkolva" : "🤍 Like"}
          </button>

          <span class="like-count">
            ❤️ ${countMap[video.id] || 0}
          </span>

        </div>

      </article>
    `;

  }).join("");
}

/* =========================
   LIKE
========================= */

async function likeVideo(videoId) {

  const result = await db
    .from("video_likes")
    .insert({
      video_id: videoId,
      visitor_id: visitorId
    });

  if (result.error && result.error.code !== "23505") {
    alert("Like hiba: " + result.error.message);
    return;
  }

  await loadVideos();
}

/* =========================
   VIDEÓ FELTÖLTÉS
========================= */

async function uploadVideo() {

  const titleEl = document.getElementById("title");
  const fileEl = document.getElementById("file");

  if (!titleEl || !fileEl) return;

  const title = titleEl.value.trim();
  const file = fileEl.files[0];

  if (!title) {
    msg(
      "uploadMsg",
      "Írd be a videó címét.",
      true
    );
    return;
  }

  if (!file) {
    msg(
      "uploadMsg",
      "Válassz ki egy videót.",
      true
    );
    return;
  }

  /* MAXIMUM 50 MB */

  if (file.size > 50 * 1024 * 1024) {
    msg(
      "uploadMsg",
      "A videó maximum 50 MB lehet.",
      true
    );
    return;
  }

  /* VIDEÓ ELLENŐRZÉS */

  if (!file.type.startsWith("video/")) {
    msg(
      "uploadMsg",
      "Csak videófájl tölthető fel.",
      true
    );
    return;
  }

  msg(
    "uploadMsg",
    "⏳ Videó feltöltése..."
  );

  /* BIZTONSÁGOS FÁJLNÉV */

  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );

  const path =
    "pending/" +
    crypto.randomUUID() +
    "-" +
    safeName;

  /* STORAGE FELTÖLTÉS */

  const upload = await db.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (upload.error) {
    msg(
      "uploadMsg",
      "❌ Feltöltési hiba: " +
      upload.error.message,
      true
    );
    return;
  }

  /* ADATBÁZIS */

  const insert = await db
    .from("videos")
    .insert({
      title: title,
      file_path: path,
      status: "pending"
    });

  if (insert.error) {

    await db.storage
      .from(BUCKET)
      .remove([path]);

    msg(
      "uploadMsg",
      "❌ Adatbázis hiba: " +
      insert.error.message,
      true
    );

    return;
  }

  /* SIKER */

  titleEl.value = "";
  fileEl.value = "";

  msg(
    "uploadMsg",
    "✅ Siker! A videó elküldve ellenőrzésre."
  );
}

/* =========================
   ADMIN BEJELENTKEZÉS
========================= */

async function login() {

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");

  if (!emailEl || !passwordEl) return;

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    msg(
      "adminMsg",
      "Add meg az email címet és a jelszót.",
      true
    );
    return;
  }

  msg(
    "adminMsg",
    "⏳ Bejelentkezés..."
  );

  const result = await db.auth.signInWithPassword({
    email,
    password
  });

  if (result.error) {
    msg(
      "adminMsg",
      "❌ Belépési hiba: " +
      result.error.message,
      true
    );
    return;
  }

  msg(
    "adminMsg",
    "✅ Sikeres belépés."
  );

  await loadPending();
}

/* =========================
   KIJELENTKEZÉS
========================= */

async function logout() {

  await db.auth.signOut();

  const box = document.getElementById("pending");

  if (box) {
    box.innerHTML = "";
  }

  msg(
    "adminMsg",
    "Kijelentkezve."
  );
}

/* =========================
   VÁRAKOZÓ VIDEÓK
========================= */

async function loadPending() {

  const adminCheck = await db.rpc("is_admin");

  if (
    adminCheck.error ||
    adminCheck.data !== true
  ) {
    msg(
      "adminMsg",
      "❌ Ez a fiók nem admin.",
      true
    );
    return;
  }

  const result = await db
    .from("videos")
    .select("*")
    .eq("status", "pending")
    .order("created_at", {
      ascending: true
    });

  if (result.error) {
    msg(
      "adminMsg",
      "❌ " + result.error.message,
      true
    );
    return;
  }

  const box = document.getElementById("pending");

  if (!box) return;

  if (
    !result.data ||
    result.data.length === 0
  ) {
    box.innerHTML =
      '<p class="muted">Nincs várakozó videó.</p>';
    return;
  }

  box.innerHTML = result.data.map(video => {

    const publicUrl =
      db.storage
        .from(BUCKET)
        .getPublicUrl(video.file_path)
        .data.publicUrl;

    return `
      <div class="pending-item">

        <video
          controls
          preload="metadata"
          src="${esc(publicUrl)}"
        ></video>

        <h3>${esc(video.title)}</h3>

        <div class="moderation-buttons">

          <button
            onclick="moderate('${video.id}', 'approved')"
          >
            ✅ Jóváhagyás
          </button>

          <button
            onclick="moderate('${video.id}', 'rejected')"
          >
            ❌ Elutasítás
          </button>

        </div>

      </div>
    `;

  }).join("");
}

/* =========================
   ADMIN MODERÁCIÓ
========================= */

async function moderate(videoId, status) {

  if (
    status !== "approved" &&
    status !== "rejected"
  ) {
    return;
  }

  const result = await db
    .from("videos")
    .update({
      status: status
    })
    .eq("id", videoId);

  if (result.error) {
    msg(
      "adminMsg",
      "❌ " + result.error.message,
      true
    );
    return;
  }

  msg(
    "adminMsg",
    status === "approved"
      ? "✅ Videó jóváhagyva."
      : "❌ Videó elutasítva."
  );

  await loadPending();
  await loadVideos();
}

/* =========================
   AUTH FIGYELÉS
========================= */

db.auth.onAuthStateChange((event) => {

  if (event === "SIGNED_IN") {
    loadPending();
  }

  if (event === "SIGNED_OUT") {

    const box =
      document.getElementById("pending");

    if (box) {
      box.innerHTML = "";
    }

  }

});

/* =========================
   OLDAL INDÍTÁSA
========================= */

loadVideos();

/* =========================
   GLOBÁLIS FÜGGVÉNYEK
========================= */

window.uploadVideo = uploadVideo;
window.likeVideo = likeVideo;
window.login = login;
window.logout = logout;
window.moderate = moderate;
