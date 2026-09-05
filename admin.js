const LANGS = [
  ["uk", "Ukrainian"],
  ["he", "Hebrew"],
  ["ru", "Russian"],
  ["en", "English"]
];

const isLocal = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const warning = document.querySelector("[data-local-warning]");
const editor = document.querySelector("[data-editor]");
const listNode = document.querySelector("[data-artwork-list]");
const form = document.querySelector("[data-artwork-form]");
const statusNode = document.querySelector("[data-status]");
const languageFields = document.querySelector("[data-language-fields]");
const priceFields = document.querySelector("[data-price-fields]");
const mainThumbs = document.querySelector("[data-main-thumbs]");
const piecesThumbs = document.querySelector("[data-pieces-thumbs]");
const historyThumbs = document.querySelector("[data-history-thumbs]");
const resetButton = document.querySelector("[data-reset-artwork]");

let artworks = [];
let currentArtwork = null;

function translate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.uk || value.ru || value.he || Object.values(value)[0] || "";
}

function buildLanguageFields() {
  languageFields.innerHTML = LANGS.map(([lang, label]) => `
    <fieldset class="language-block">
      <h3>${label}</h3>
      <label>Title <input name="title_${lang}"></label>
      <label>Description <textarea name="description_${lang}"></textarea></label>
      <label>Technique / materials <textarea name="technique_${lang}"></textarea></label>
    </fieldset>
  `).join("");
}

function buildPriceFields() {
  priceFields.innerHTML = LANGS.map(([lang, label]) => `
    <label>${label} <input name="price_${lang}" placeholder="₪1,200 / On request / Sold"></label>
  `).join("");
}

async function loadArtworks() {
  const response = await fetch("/api/artworks");
  if (!response.ok) throw new Error("Cannot load artworks. Start with: node local-server.js");
  artworks = (await response.json()).artworks;
  renderList();
}

function renderList() {
  listNode.innerHTML = artworks.map((artwork) => `
    <button class="artwork-item" type="button" data-id="${escapeHtml(artwork.id)}">
      <img src="${escapeHtml(artwork.image)}" alt="">
      <span>
        <strong>${escapeHtml(translate(artwork.title))}</strong>
        <span>${escapeHtml(artwork.id)}</span>
      </span>
    </button>
  `).join("");
}

function emptyArtwork() {
  currentArtwork = null;
  form.reset();
  form.elements.existingId.value = "";
  form.elements.id.value = "";
  form.elements.image.value = "";
  form.elements.piecesPaths.value = "";
  form.elements.historyPaths.value = "";
  form.elements.extraJson.value = "";
  clearPriceFields();
  renderThumbs(mainThumbs, []);
  renderThumbs(piecesThumbs, []);
  renderThumbs(historyThumbs, []);
  statusNode.textContent = "";
}

function fillArtwork(artwork) {
  currentArtwork = artwork;
  form.reset();
  form.elements.existingId.value = artwork.id;
  form.elements.id.value = artwork.id;
  form.elements.createdAt.value = artwork.createdAt ? artwork.createdAt.slice(0, 7) : "";
  form.elements.image.value = artwork.image || "";
  form.elements.piecesPaths.value = Array.isArray(artwork.pieces) ? artwork.pieces.join("\n") : "";
  form.elements.historyPaths.value = Array.isArray(artwork.history) ? artwork.history.join("\n") : "";
  fillPriceFields(artwork.price);
  form.elements.extraJson.value = extraJsonFor(artwork);
  renderThumbs(mainThumbs, artwork.image ? [artwork.image] : []);
  renderThumbs(piecesThumbs, Array.isArray(artwork.pieces) ? artwork.pieces : []);
  renderThumbs(historyThumbs, Array.isArray(artwork.history) ? artwork.history : []);

  for (const [lang] of LANGS) {
    form.elements[`title_${lang}`].value = artwork.title?.[lang] || "";
    form.elements[`description_${lang}`].value = artwork.description?.[lang] || "";
    form.elements[`technique_${lang}`].value = artwork.technique?.[lang] || "";
  }
  statusNode.textContent = `Editing ${artwork.id}. Image fields can be left empty to keep existing files.`;
}

function collectTranslations(prefix) {
  return Object.fromEntries(LANGS.map(([lang]) => [lang, form.elements[`${prefix}_${lang}`].value.trim()]));
}

function clearPriceFields() {
  for (const [lang] of LANGS) {
    form.elements[`price_${lang}`].value = "";
  }
}

function fillPriceFields(price) {
  for (const [lang] of LANGS) {
    form.elements[`price_${lang}`].value = typeof price === "string" ? price : price?.[lang] || "";
  }
}

function collectPrice() {
  const values = collectTranslations("price");
  const filled = Object.values(values).filter(Boolean);
  if (!filled.length) return "";
  if (filled.every((value) => value === filled[0])) return filled[0];
  return values;
}

function pathsFromTextarea(name) {
  return form.elements[name].value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderThumbs(container, paths) {
  container.innerHTML = paths.length
    ? paths.map((src, index) => `
      <figure class="thumb">
        <img src="${escapeHtml(src)}" alt="">
        <figcaption>${index + 1}</figcaption>
      </figure>
    `).join("")
    : `<p class="empty-thumbs">No images assigned</p>`;
}

function extraJsonFor(artwork) {
  const known = new Set(["id", "title", "description", "technique", "createdAt", "image", "pieces", "history", "price"]);
  const extra = {};
  for (const [key, value] of Object.entries(artwork)) {
    if (!known.has(key)) extra[key] = value;
  }
  return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : "";
}

async function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ name: file.name, dataUrl: reader.result }));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function filesToPayload(fileList) {
  return Promise.all([...fileList].map(fileToPayload));
}

async function submitArtwork(event) {
  event.preventDefault();
  statusNode.textContent = "Saving...";

  const existing = artworks.find((item) => item.id === form.elements.existingId.value);
  const createdMonth = form.elements.createdAt.value;
  const extraJson = form.elements.extraJson.value.trim() ? JSON.parse(form.elements.extraJson.value) : {};
  const artwork = {
    ...(existing || {}),
    ...extraJson,
    id: form.elements.id.value.trim(),
    title: collectTranslations("title"),
    description: collectTranslations("description"),
    technique: collectTranslations("technique"),
    image: form.elements.image.value.trim()
  };

  if (createdMonth) artwork.createdAt = `${createdMonth}-01`;
  else delete artwork.createdAt;

  const price = collectPrice();
  if (price) artwork.price = price;
  else delete artwork.price;

  const piecesPaths = pathsFromTextarea("piecesPaths");
  if (piecesPaths.length) artwork.pieces = piecesPaths;
  else delete artwork.pieces;

  const historyPaths = pathsFromTextarea("historyPaths");
  if (historyPaths.length) artwork.history = historyPaths;
  else delete artwork.history;

  const files = {};
  if (form.elements.main.files[0]) files.main = await fileToPayload(form.elements.main.files[0]);
  if (form.elements.pieces.files.length) files.pieces = await filesToPayload(form.elements.pieces.files);
  if (form.elements.history.files.length) files.history = await filesToPayload(form.elements.history.files);

  const response = await fetch("/api/artworks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ existingId: form.elements.existingId.value, artwork, files })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Save failed");
  statusNode.textContent = `Saved ${result.artwork.id}.`;
  await loadArtworks();
  fillArtwork(result.artwork);
}

async function resetCurrentArtwork() {
  statusNode.textContent = "Resetting...";
  const currentId = form.elements.existingId.value || currentArtwork?.id;
  await loadArtworks();
  const freshArtwork = artworks.find((item) => item.id === currentId);
  if (freshArtwork) {
    fillArtwork(freshArtwork);
    statusNode.textContent = `Reset ${freshArtwork.id}.`;
  } else {
    emptyArtwork();
    statusNode.textContent = "Cleared new artwork form.";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function init() {
  buildLanguageFields();
  buildPriceFields();
  if (!isLocal) {
    warning.hidden = false;
    editor.hidden = true;
    return;
  }

  document.querySelector("[data-new-artwork]").addEventListener("click", emptyArtwork);
  resetButton.addEventListener("click", () => {
    resetCurrentArtwork().catch((error) => {
      statusNode.textContent = error.message;
    });
  });
  listNode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    const artwork = artworks.find((item) => item.id === button.dataset.id);
    if (artwork) fillArtwork(artwork);
  });
  for (const input of [form.elements.image, form.elements.piecesPaths, form.elements.historyPaths]) {
    input.addEventListener("input", () => {
      renderThumbs(mainThumbs, form.elements.image.value.trim() ? [form.elements.image.value.trim()] : []);
      renderThumbs(piecesThumbs, pathsFromTextarea("piecesPaths"));
      renderThumbs(historyThumbs, pathsFromTextarea("historyPaths"));
    });
  }
  form.addEventListener("submit", (event) => {
    submitArtwork(event).catch((error) => {
      statusNode.textContent = error.message;
    });
  });

  await loadArtworks();
  if (artworks[0]) fillArtwork(artworks[0]);
}

init().catch((error) => {
  statusNode.textContent = error.message;
});
