import {
  listPins, upsertPin, getPin,
  listPresets, upsertPreset, getPreset, deletePreset
} from "./idb.js";

const $ = (sel) => document.querySelector(sel);

// Pins counters (tabs)
const countMine = $("#countMine");
const countSaved = $("#countSaved");

// Presets UI
const presetGrid = $("#presetGrid");
const newPresetBtn = $("#newPresetBtn");
const presetSearch = $("#presetSearch");
const mixerTemplate = $("#mixerTemplate");
const mixerPick = $("#mixerPick");
const mixerBuild = $("#mixerBuild");
const mixerCopy = $("#mixerCopy");
const mixerClear = $("#mixerClear");
const mixerResult = $("#mixerResult");

const routes = {
  album: $("#view-album"),
  builder: $("#view-builder"),
  presets: $("#view-presets"),
};

const navBtns = document.querySelectorAll(".navbtn");
const grid = $("#grid");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const newPinBtn = $("#newPinBtn");
const downloadAllZipBtn = $("#downloadAllZipBtn");
const emptyNewPinBtn = $("#emptyNewPinBtn");
const themeToggle = $("#themeToggle");
const themeIcon = document.querySelector(".themeIcon");
const themeLabel = document.querySelector(".themeLabel");
const moodSidebar = document.querySelector(".mood-sidebar");

const dropzone = $("#dropzone");
const imageInput = $("#imageInput");
const imagePreviewWrap = $("#imagePreviewWrap");
const imagePreview = $("#imagePreview");
const removeImageBtn = $("#removeImageBtn");
const promptInput = $("#promptInput");
const notesInput = $("#notesInput");
const dateInput = $("#dateInput");
const copyBtn = $("#copyBtn");
const saveBtn = $("#saveBtn");

const toast = $("#toast");

// Modal
const modal = $("#modal");
const modalBackdrop = $("#modalBackdrop");
const closeModalBtn = $("#closeModalBtn");
const modalImage = $("#modalImage");
const modalPrompt = $("#modalPrompt");
const modalNotesWrap = $("#modalNotesWrap");
const modalNotes = $("#modalNotes");
const modalDateWrap = $("#modalDateWrap");
const modalDate = $("#modalDate");
const modalCopyBtn = $("#modalCopyBtn");
const modalDownloadImageBtn = $("#modalDownloadImageBtn");
const modalEditBtn = $("#modalEditBtn");
const modalTitle = $("#modalTitle");

// Preset Modal
const presetModal = $("#presetModal");
const presetModalBackdrop = $("#presetModalBackdrop");
const presetCloseBtn = $("#presetCloseBtn");
const presetModalTitle = $("#presetModalTitle");

const presetName = $("#presetName");
const presetDesc = $("#presetDesc");
const presetRole = $("#presetRole");
const presetPronouns = $("#presetPronouns");

const presetAvatarBtn = $("#presetAvatarBtn");
const presetAvatarImg = $("#presetAvatarImg");
const presetAvatarFallback = $("#presetAvatarFallback");
const presetAvatarInput = $("#presetAvatarInput");
const presetRemoveAvatarBtn = $("#presetRemoveAvatarBtn");

const presetCancelBtn = $("#presetCancelBtn");
const presetSaveBtn = $("#presetSaveBtn");


let state = {
  pins: [],
  currentRoute: "album",
  editingId: null,
  currentImageBlob: null,
  currentImageType: null,
  modalOpenId: null,
presetEditingId: null,
presetAvatarBlob: null,
presetAvatarType: null,


  albumTab: "mine",       // "mine" | "saved"
  builderIsMine: true,    // checkbox in builder
  moodFilter: "all",      // "all" | "sweet" | "spicy" | "other"
};

let mixerSelectedIds = []; // keeps order of selection
let zipDownloadRunning = false;

function fileExtFromType(type, fallback = "png") {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  return map[type] || fallback;
}

function slugifyFileName(text, fallback = "pin") {
  const clean = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function buildPinImageFileName(pin, index, ext) {
  const title = pin?.title || firstTitleFromPrompt(pin?.prompt || "") || `pin-${index}`;
  const safeTitle = slugifyFileName(title, `pin-${index}`);
  const order = String(index).padStart(3, "0");
  return `${order}-${safeTitle}.${ext}`;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPinTextExport(pin) {
  const title = pin?.title || "Untitled";
  const prompt = (pin?.prompt || "").trim();
  const notes = (pin?.notes || "").trim();
  const dateText = (pin?.dateText || "").trim();
  const moods = Array.isArray(pin?.moods) ? pin.moods.join(", ") : "";
  const owner = (pin?.bucket || "mine") === "mine" ? "mine" : "saved";
  const creditName = (pin?.creditName || "").trim();
  const creditLink = (pin?.creditLink || "").trim();

  const lines = [
    `Title: ${title}`,
    `Owner: ${owner}`,
  ];
  if (dateText) lines.push(`Date: ${dateText}`);
  if (moods) lines.push(`Moods: ${moods}`);
  if (creditName) lines.push(`Credit: ${creditName}`);
  if (creditLink) lines.push(`Credit link: ${creditLink}`);

  lines.push("", "Prompt:", prompt || "(empty)");
  if (notes) lines.push("", "Notes:", notes);
  return lines.join("\n");
}

function getPinImageDownloadData(pin) {
  if (!pin?.imageBlob) return null;
  const ext = fileExtFromType(pin.imageType || pin.imageBlob.type, "png");
  return { blob: pin.imageBlob, ext };
}

function downloadSinglePinImage(pin, index = 1, silent = false) {
  const file = getPinImageDownloadData(pin);
  if (!file) {
    if (!silent) showToast("This pin has no image");
    return false;
  }
  const filename = buildPinImageFileName(pin, index, file.ext);
  triggerBlobDownload(file.blob, filename);
  if (!silent) showToast("Image downloaded ✨");
  return true;
}

async function downloadModalImage() {
  const pin = state.pins.find((p) => p.id === state.modalOpenId);
  if (!pin) {
    showToast("No pin open");
    return;
  }
  downloadSinglePinImage(pin, 1, false);
}

async function downloadAllImagesZip() {
  if (zipDownloadRunning) return;
  if (!window.JSZip) {
    showToast("ZIP library unavailable");
    return;
  }

  const pinsWithImage = state.pins.filter((p) => p.imageBlob);
  if (!pinsWithImage.length) {
    showToast("No images to export");
    return;
  }

  zipDownloadRunning = true;
  const originalText = downloadAllZipBtn?.textContent || "Download ZIP";
  if (downloadAllZipBtn) {
    downloadAllZipBtn.disabled = true;
    downloadAllZipBtn.textContent = "Preparing ZIP...";
  }

  try {
    const zip = new window.JSZip();
    const names = new Set();
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < pinsWithImage.length; i++) {
      const pin = pinsWithImage[i];
      const file = getPinImageDownloadData(pin);
      if (!file) {
        fail++;
        continue;
      }

      let name = buildPinImageFileName(pin, i + 1, file.ext);
      if (names.has(name)) {
        const dot = name.lastIndexOf(".");
        const base = dot >= 0 ? name.slice(0, dot) : name;
        const ext = dot >= 0 ? name.slice(dot) : "";
        let n = 2;
        while (names.has(`${base}-${n}${ext}`)) n++;
        name = `${base}-${n}${ext}`;
      }

      names.add(name);
      zip.file(name, file.blob);
      zip.file(name.replace(/\.[^/.]+$/, ".txt"), buildPinTextExport(pin));
      ok++;
    }

    if (!ok) {
      showToast("No images could be exported");
      return;
    }

    if (downloadAllZipBtn) downloadAllZipBtn.textContent = "Building ZIP...";
    const blob = await zip.generateAsync({ type: "blob" });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(blob, `promptpin-export-${stamp}.zip`);
    showToast(`ZIP ready: ${ok} images${fail ? `, ${fail} failed` : ""}`);
  } finally {
    zipDownloadRunning = false;
    if (downloadAllZipBtn) {
      downloadAllZipBtn.disabled = false;
      downloadAllZipBtn.textContent = originalText;
    }
  }
}

function uuid() {
  return (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  if (themeIcon) themeIcon.textContent = theme === "dark" ? "🌞" : "🌙";
  if (themeLabel) themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
}

function initTheme(){
  const saved = localStorage.getItem("pp_theme");
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function pronounSet(type) {
  if (type === "she") return { subj: "she", obj: "her", poss: "her" };
  if (type === "he")  return { subj: "he", obj: "him", poss: "his" };
  return { subj: "they", obj: "them", poss: "their" };
}

function buildCharBlock(preset, idx){
  const name = (preset?.name || "Untitled").trim();
  const desc = (preset?.description || "").trim();
  if(!name && !desc) return "";
  return `${idx}) ${name}\n${desc}`.trim();
}

async function renderMixerPicklist(){
  if(!mixerPick) return;

  const items = await listPresets();

  // map for fast lookup
  const byId = new Map(items.map(p => [p.id, p]));

  // ensure selected ids exist
  mixerSelectedIds = mixerSelectedIds.filter(id => byId.has(id));

  mixerPick.innerHTML = "";

  for(const p of items){
    const isSelected = mixerSelectedIds.includes(p.id);
    const order = isSelected ? (mixerSelectedIds.indexOf(p.id) + 1) : 0;

    const row = document.createElement("div");
    row.className = "mixer-item";
    row.dataset.id = p.id;

    row.innerHTML = `
      <div class="mixer-item-left">
        <input class="mixer-check" type="checkbox" ${isSelected ? "checked" : ""} />
        <span class="mixer-order">${order ? order : "—"}</span>
        <div class="mixer-name" title="${(p.name||"Untitled").replaceAll('"', "'")}">${p.name || "Untitled"}</div>
      </div>
      <div class="mixer-controls">
        <button class="iconbtn" data-act="up" title="Move up" ${(!isSelected || order === 1) ? "disabled" : ""}>↑</button>
        <button class="iconbtn" data-act="down" title="Move down" ${(!isSelected || order === mixerSelectedIds.length) ? "disabled" : ""}>↓</button>
      </div>
    `;

    // Events: checkbox + arrows
    row.addEventListener("click", async (e) => {
      const id = row.dataset.id;
      const act = e.target?.dataset?.act;

      // checkbox toggle (if click on checkbox OR left area)
      if(e.target?.classList?.contains("mixer-check")){
        const checked = e.target.checked;
        if(checked && !mixerSelectedIds.includes(id)) mixerSelectedIds.push(id);
        if(!checked) mixerSelectedIds = mixerSelectedIds.filter(x => x !== id);
        await renderMixerPicklist();
        return;
      }

      // arrows
      if(act === "up"){
        const i = mixerSelectedIds.indexOf(id);
        if(i > 0){
          const tmp = mixerSelectedIds[i-1];
          mixerSelectedIds[i-1] = mixerSelectedIds[i];
          mixerSelectedIds[i] = tmp;
          await renderMixerPicklist();
        }
        return;
      }

      if(act === "down"){
        const i = mixerSelectedIds.indexOf(id);
        if(i >= 0 && i < mixerSelectedIds.length - 1){
          const tmp = mixerSelectedIds[i+1];
          mixerSelectedIds[i+1] = mixerSelectedIds[i];
          mixerSelectedIds[i] = tmp;
          await renderMixerPicklist();
        }
        return;
      }
    });

    mixerPick.appendChild(row);
  }
}

function mergeTemplateWithSelected(template, selectedPresets){
  const humans = selectedPresets.filter(p => p.role === "human");
  const ais = selectedPresets.filter(p => p.role === "ai");
  const humanPronouns =
    humans.length === 1
      ? pronounSet(humans[0].pronouns)
      : pronounSet("they");
  const aiPronouns =
    ais.length === 1
      ? pronounSet(ais[0].pronouns)
      : pronounSet("they");
  const placeholder = "<INSERT CHARACTER DESCRIPTION>";

  template = template
    .replaceAll("<HUMAN_SUBJ>", humanPronouns.subj)
    .replaceAll("<HUMAN_OBJ>", humanPronouns.obj)
    .replaceAll("<HUMAN_POSS>", humanPronouns.poss)
    .replaceAll("<AI_SUBJ>", aiPronouns.subj)
    .replaceAll("<AI_OBJ>", aiPronouns.obj)
    .replaceAll("<AI_POSS>", aiPronouns.poss);
  const blocks = selectedPresets
    .map((p, idx) => buildCharBlock(p, idx + 1))
    .filter(Boolean)
    .join("\n\n");

  if(template.includes(placeholder)){
    return template.replaceAll(placeholder, `CHARACTERS:\n${blocks}`.trim());
  }

  // If no placeholder, append neatly
  return blocks ? `${template}\n\nCHARACTERS:\n${blocks}` : template;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
}

function routeTo(name) {
  state.currentRoute = name;

  Object.entries(routes).forEach(([k, el]) => {
    if (!el) return; // <- evita que reviente si falta alguna vista
    el.classList.toggle("hidden", k !== name);
  });

  navBtns.forEach((b) => b.classList.toggle("active", b.dataset.route === name));
  if (name === "presets") {
    renderPresets();
    renderMixerPicklist();
  } else {
    mixerSelectedIds = [];
    if (mixerResult) mixerResult.value = "";
    if (mixerPick) mixerPick.innerHTML = "";
  }
}

function firstTitleFromPrompt(prompt) {
  const t = (prompt || "").trim().split(/\s+/).slice(0, 6).join(" ");
  return t || "Untitled";
}

function renderAlbum() {
  const q = (searchInput.value || "").trim().toLowerCase();

  // Si hay búsqueda, mostramos TODO (mine + saved)
  const searching = q.length > 0;

  const mineCount = state.pins.filter(p => (p.bucket || "mine") === "mine").length;
  const savedCount = state.pins.filter(p => (p.bucket || "mine") === "saved").length;
  if (countMine) countMine.textContent = mineCount;
  if (countSaved) countSaved.textContent = savedCount;

  const tab = state.albumTab || "mine";
  const base = searching
    ? state.pins // <-- todo
    : state.pins.filter((p) => (p.bucket || "mine") === tab);

  const moodBase = state.moodFilter === "all"
    ? base
    : base.filter((p) => Array.isArray(p.moods) && p.moods.includes(state.moodFilter));

  const filtered = searching
    ? moodBase.filter(
        (p) =>
          (p.prompt || "").toLowerCase().includes(q) ||
          (p.title || "").toLowerCase().includes(q) ||
          (p.notes || "").toLowerCase().includes(q) ||
          (p.creditName || "").toLowerCase().includes(q) // bonus: buscar por autor
      )
    : moodBase;

  grid.innerHTML = "";
  emptyState.style.display = filtered.length ? "none" : "block";

  for (const pin of filtered) {
    const card = document.createElement("article");
    card.className = "pin";
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.alt = pin.title || "Pin image";

    if (pin.imageBlob) {
      const url = URL.createObjectURL(pin.imageBlob);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
    } else {
      img.src = "";
    }

    const actions = document.createElement("div");
    actions.className = "pin-actions";

    const copy = document.createElement("button");
    copy.className = "actionbtn";
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", async (e) => {
      e.stopPropagation();
      await copyText(pin.prompt || "");
    });

    actions.appendChild(copy);

    const meta = document.createElement("div");
    meta.className = "pin-meta";

    const title = document.createElement("div");
    title.className = "pin-title";
    title.textContent = pin.title || "Untitled";

    const sub = document.createElement("div");
    sub.className = "pin-sub";
    sub.textContent = (pin.prompt || "").trim();

    meta.appendChild(title);
    meta.appendChild(sub);

    if ((pin.bucket || "mine") === "saved" && pin.creditName) {
      const credit = document.createElement("div");
      credit.className = "pin-credit";
      credit.textContent = `by ${pin.creditName}`;
      meta.appendChild(credit);
    }

    if (pin.dateText) {
      const dateEl = document.createElement("div");
      dateEl.className = "pin-date";
      dateEl.textContent = pin.dateText;
      meta.appendChild(dateEl);
    }

    card.appendChild(img);
    card.appendChild(actions);
    card.appendChild(meta);

    card.addEventListener("click", () => openModal(pin.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openModal(pin.id);
    });

    grid.appendChild(card);
  }
}

async function refreshPins() {
  state.pins = await listPins();
  renderAlbum();
}

function resetBuilder() {
  state.editingId = null;
  state.currentImageBlob = null;
  state.currentImageType = null;

  promptInput.value = "";
  notesInput.value = "";
  if (dateInput) dateInput.value = "";
  imagePreviewWrap.classList.add("hidden");
  imagePreview.src = "";
  saveBtn.disabled = true;
}

function builderDirtyValid() {
  const hasPrompt = !!(promptInput.value || "").trim();
  const hasImage = !!state.currentImageBlob;
  return hasPrompt && hasImage;
}

function updateSaveEnabled() {
  saveBtn.disabled = !builderDirtyValid();
}

async function setImageFromFile(file) {
  if (!file) return;

  // Basic type check
  if (!file.type.startsWith("image/")) {
    showToast("Please upload an image ✨");
    return;
  }

  state.currentImageBlob = file;
  state.currentImageType = file.type;

  const url = URL.createObjectURL(file);
  imagePreview.src = url;
  imagePreview.onload = () => URL.revokeObjectURL(url);

  imagePreviewWrap.classList.remove("hidden");
  updateSaveEnabled();
}

async function copyText(text) {
  const t = (text || "").trim();
  if (!t) return;

  try {
    await navigator.clipboard.writeText(t);
    showToast("Copied! ✨");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied! ✨");
  }
}

async function savePin() {
  const prompt = (promptInput.value || "").trim();
  const notes = (notesInput.value || "").trim();
  const dateText = (dateInput?.value || "").trim();
  const moods = Array.from(
    document.querySelectorAll(".mood-picker input:checked")
  ).map(i => i.value);

  if (!builderDirtyValid()) return;

  const isEdit = !!state.editingId;
  const existing = isEdit ? await getPin(state.editingId) : null;

  // NEW: ownership + credits
  const isMine = !!$("#isMine")?.checked;
  const creditName = (($("#creditName")?.value || "")).trim();
  const creditLink = (($("#creditLink")?.value || "")).trim();

  const pin = {
    id: isEdit ? state.editingId : uuid(),
    createdAt: isEdit ? (existing?.createdAt ?? Date.now()) : Date.now(),
    updatedAt: Date.now(),
    title: firstTitleFromPrompt(prompt),
    prompt,
    notes,
    dateText,
    moods,
    imageBlob: state.currentImageBlob,
    imageType: state.currentImageType || "image/png",

    // NEW fields
    bucket: isMine ? "mine" : "saved",
    creditName: isMine ? "" : creditName,
    creditLink: isMine ? "" : creditLink,
  };

  await upsertPin(pin);
  showToast("Saved ✨");

  await refreshPins();
  routeTo("album");
  resetBuilder();
}

function openModal(id) {
  state.modalOpenId = id;
  const pin = state.pins.find(p => p.id === id);
  if (!pin) return;

  modalTitle.textContent = pin.title || "Pin";
  if (pin.imageBlob) {
    const url = URL.createObjectURL(pin.imageBlob);
    modalImage.src = url;
    modalImage.onload = () => URL.revokeObjectURL(url);
  } else {
    modalImage.src = "";
  }

  modalPrompt.textContent = pin.prompt || "";
  if (pin.dateText && pin.dateText.trim()) {
    modalDateWrap.style.display = "block";
    modalDate.textContent = pin.dateText;
  } else {
    modalDateWrap.style.display = "none";
  }
  if (pin.notes && pin.notes.trim()) {
    modalNotesWrap.style.display = "block";
    modalNotes.textContent = pin.notes;
  } else {
    modalNotesWrap.style.display = "none";
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  state.modalOpenId = null;
  modal.classList.add("hidden");
}

async function editFromModal() {
  const id = state.modalOpenId;
  if (!id) return;

  const pin = await getPin(id);
  if (!pin) return;

  // Load into builder
  state.editingId = pin.id;
  promptInput.value = pin.prompt || "";
  notesInput.value = pin.notes || "";
  if (dateInput) dateInput.value = pin.dateText || "";

  if (pin.imageBlob) {
    state.currentImageBlob = pin.imageBlob;
    state.currentImageType = pin.imageType || (pin.imageBlob.type || "image/png");

    const url = URL.createObjectURL(pin.imageBlob);
    imagePreview.src = url;
    imagePreview.onload = () => URL.revokeObjectURL(url);
    imagePreviewWrap.classList.remove("hidden");
  } else {
    state.currentImageBlob = null;
    state.currentImageType = null;
    imagePreviewWrap.classList.add("hidden");
  }

  updateSaveEnabled();
  closeModal();
  routeTo("builder");
}

function wireEvents() {
  // Preset editor open
newPresetBtn?.addEventListener("click", () => openPresetEditor());

  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("pp_theme", next);
    applyTheme(next);
  });
  downloadAllZipBtn?.addEventListener("click", downloadAllImagesZip);

// Preset modal close
presetModalBackdrop?.addEventListener("click", closePresetModal);
presetCloseBtn?.addEventListener("click", closePresetModal);
presetCancelBtn?.addEventListener("click", closePresetModal);

// Avatar upload
presetAvatarBtn?.addEventListener("click", () => presetAvatarInput?.click());
presetAvatarBtn?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") presetAvatarInput?.click();
});

presetAvatarInput?.addEventListener("change", async () => {
  const file = presetAvatarInput.files?.[0];
  await setPresetAvatarFromFile(file);
  presetAvatarInput.value = "";
});

presetRemoveAvatarBtn?.addEventListener("click", () => {
  state.presetAvatarBlob = null;
  state.presetAvatarType = null;
  if (presetAvatarImg) {
    presetAvatarImg.src = "";
    presetAvatarImg.style.display = "none";
  }
  presetAvatarFallback?.classList.remove("hidden");
});

// Save preset
presetSaveBtn?.addEventListener("click", savePreset);

// Mixer actions
mixerBuild?.addEventListener("click", async () => {
  const tpl = (mixerTemplate?.value || "").trim();
  if(!tpl){
    showToast("Paste a template first ✨");
    return;
  }

  const items = await listPresets();
  const byId = new Map(items.map(p => [p.id, p]));
  const selected = mixerSelectedIds.map(id => byId.get(id)).filter(Boolean);

  if(!selected.length){
    showToast("Select at least 1 preset ✨");
    return;
  }

  mixerResult.value = mergeTemplateWithSelected(tpl, selected);
  showToast("Built ✨");
});

mixerCopy?.addEventListener("click", async () => {
  const t = (mixerResult?.value || "").trim();
  if(!t) return;
  await copyText(t);
});

mixerClear?.addEventListener("click", async () => {
  mixerSelectedIds = [];
  if(mixerResult) mixerResult.value = "";
  await renderMixerPicklist();
  showToast("Cleared ✨");
});

// ESC close preset modal
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && presetModal && !presetModal.classList.contains("hidden")) {
    closePresetModal();
  }
});

// Nav
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => routeTo(btn.dataset.route));
  });

  // New pin
  newPinBtn?.addEventListener("click", () => { resetBuilder(); routeTo("builder"); });
  emptyNewPinBtn?.addEventListener("click", () => { resetBuilder(); routeTo("builder"); });

  // Search
  searchInput?.addEventListener("input", renderAlbum);

  // Mood filter
  moodSidebar?.addEventListener("click", (e) => {
    const btn = e.target?.closest("button[data-mood]");
    if (!btn) return;
    const mood = btn.dataset.mood;
    state.moodFilter = state.moodFilter === mood ? "all" : mood;

    moodSidebar.querySelectorAll("button[data-mood]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === state.moodFilter);
    });

    renderAlbum();
  });

  // Dropzone click
  dropzone?.addEventListener("click", () => imageInput?.click());
  dropzone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") imageInput?.click();
  });

  // Drag & drop
  dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "rgba(118,224,255,.95)";
  });
  dropzone?.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "rgba(183,168,255,.6)";
  });
  dropzone?.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "rgba(183,168,255,.6)";
    const file = e.dataTransfer?.files?.[0];
    await setImageFromFile(file);
  });

  // File input
  imageInput?.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    await setImageFromFile(file);
    imageInput.value = "";
  });

  removeImageBtn?.addEventListener("click", () => {
    state.currentImageBlob = null;
    state.currentImageType = null;
    imagePreviewWrap?.classList.add("hidden");
    if (imagePreview) imagePreview.src = "";
    updateSaveEnabled();
  });

  // Enable Save
  promptInput?.addEventListener("input", updateSaveEnabled);

  // Buttons
  copyBtn?.addEventListener("click", async () => copyText(promptInput?.value || ""));
  saveBtn?.addEventListener("click", savePin);

  // Album tabs
  const tabMine = $("#tabMine");
  const tabSaved = $("#tabSaved");

  function setTab(tab) {
    state.albumTab = tab;
    tabMine?.classList.toggle("active", tab === "mine");
    tabSaved?.classList.toggle("active", tab === "saved");
    renderAlbum();
  }

  tabMine?.addEventListener("click", () => setTab("mine"));
  tabSaved?.addEventListener("click", () => setTab("saved"));

  // Builder ownership
  const isMineEl = $("#isMine");
  const creditFields = $("#creditFields");

  function syncCreditUI() {
    const isMine = !!isMineEl?.checked;
    creditFields?.classList.toggle("hidden", isMine);
    updateSaveEnabled();
  }

  isMineEl?.addEventListener("change", syncCreditUI);
  syncCreditUI();

  // Modal
  modalBackdrop?.addEventListener("click", closeModal);
  closeModalBtn?.addEventListener("click", closeModal);
  modalCopyBtn?.addEventListener("click", async () => {
    const pin = state.pins.find(p => p.id === state.modalOpenId);
    await copyText(pin?.prompt || "");
  });
  modalDownloadImageBtn?.addEventListener("click", downloadModalImage);
  modalEditBtn?.addEventListener("click", editFromModal);

  // ESC closes modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal?.classList.contains("hidden")) closeModal();
  });
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // ignore
  }
}

async function init() {
  initTheme();
  wireEvents();
  await refreshPins();
  await registerSW();
  await renderPresets();
  await renderMixerPicklist();
  routeTo("album");
}
init();

function openPresetModal() {
  presetModal?.classList.remove("hidden");
}

function closePresetModal() {
  presetModal?.classList.add("hidden");
  state.presetEditingId = null;
  state.presetAvatarBlob = null;
  state.presetAvatarType = null;

  if (presetName) presetName.value = "";
  if (presetDesc) presetDesc.value = "";

  // reset avatar preview
  if (presetAvatarImg) {
    presetAvatarImg.src = "";
    presetAvatarImg.style.display = "none";
  }
  presetAvatarFallback?.classList.remove("hidden");
}

async function setPresetAvatarFromFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please upload an image ✨");
    return;
  }

  state.presetAvatarBlob = file;
  state.presetAvatarType = file.type;

  const url = URL.createObjectURL(file);
  presetAvatarImg.src = url;
  presetAvatarImg.onload = () => URL.revokeObjectURL(url);

  presetAvatarImg.style.display = "block";
  presetAvatarFallback?.classList.add("hidden");
}

async function openPresetEditor(id = null) {
  state.presetEditingId = id;

  if (id) {
    const p = await getPreset(id);
    if (!p) return;

    presetModalTitle.textContent = "Edit Preset";
    presetName.value = p.name || "";
    presetDesc.value = p.description || "";
    if (presetRole) presetRole.value = p.role || "human";
    if (presetPronouns) presetPronouns.value = p.pronouns || "she";

    if (p.imageBlob) {
      state.presetAvatarBlob = p.imageBlob;
      state.presetAvatarType = p.imageType || (p.imageBlob.type || "image/png");

      const url = URL.createObjectURL(p.imageBlob);
      presetAvatarImg.src = url;
      presetAvatarImg.onload = () => URL.revokeObjectURL(url);
      presetAvatarImg.style.display = "block";
      presetAvatarFallback?.classList.add("hidden");
    } else {
      state.presetAvatarBlob = null;
      state.presetAvatarType = null;
      presetAvatarImg.style.display = "none";
      presetAvatarFallback?.classList.remove("hidden");
    }
  } else {
    presetModalTitle.textContent = "New Preset";
    // clean slate
    state.presetAvatarBlob = null;
    state.presetAvatarType = null;
    presetAvatarImg.style.display = "none";
    presetAvatarFallback?.classList.remove("hidden");
    presetName.value = "";
    presetDesc.value = "";
    if (presetRole) presetRole.value = "human";
    if (presetPronouns) presetPronouns.value = "she";
  }

  openPresetModal();
}

async function savePreset() {
  const name = (presetName?.value || "").trim();
  const description = (presetDesc?.value || "").trim();
  const role = (presetRole?.value || "human").trim();
  const pronouns = (presetPronouns?.value || "she").trim();

  if (!name || !description) {
    showToast("Name + Description, please ✨");
    return;
  }

  const isEdit = !!state.presetEditingId;
  const existing = isEdit ? await getPreset(state.presetEditingId) : null;

  const preset = {
    id: isEdit ? state.presetEditingId : uuid(),
    createdAt: isEdit ? (existing?.createdAt ?? Date.now()) : Date.now(),
    updatedAt: Date.now(),
    name,
    description,
    role,
    pronouns,
    imageBlob: state.presetAvatarBlob,
    imageType: state.presetAvatarType || "image/png",
  };

  await upsertPreset(preset);
  showToast("Saved ✨");
  closePresetModal();
  await renderPresets();
}

async function renderPresets() {
  const q = (presetSearch?.value || "").toLowerCase().trim();
  const items = await listPresets();

  const filtered = q
    ? items.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      )
    : items;

  if (!presetGrid) return;
  presetGrid.innerHTML = "";

  for (const p of filtered) {
    const card = document.createElement("div");
    card.className = "preset-card";

    const avatar = document.createElement("div");
    avatar.className = "preset-avatar";
    if (p.imageBlob) {
      const img = document.createElement("img");
      const url = URL.createObjectURL(p.imageBlob);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      avatar.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "preset-body";
    body.innerHTML = `
      <div class="preset-name">${p.name || "Untitled"}</div>
      <div class="preset-desc">${(p.description || "").replaceAll("<","&lt;").replaceAll(">","&gt;")}</div>
      <div class="preset-actions">
        <button class="actionbtn" data-act="copy" type="button">Copy</button>
        <button class="actionbtn" data-act="edit" type="button">Edit</button>
        <button class="actionbtn" data-act="del" type="button">Delete</button>
      </div>
    `;

    body.addEventListener("click", async (e) => {
      const btn = e.target?.closest("button[data-act]");
      const act = btn?.dataset?.act;
      if (!act) return;

      if (act === "copy") {
        await navigator.clipboard.writeText(p.description || "");
        showToast("Copied ✨");
      } else if (act === "edit") {
        await openPresetEditor(p.id);
      } else if (act === "del") {
        await deletePreset(p.id);
        await renderPresets();
        showToast("Deleted ✨");
      }
    });

    card.appendChild(avatar);
    card.appendChild(body);
    presetGrid.appendChild(card);
  }
}

presetSearch?.addEventListener("input", renderPresets);
