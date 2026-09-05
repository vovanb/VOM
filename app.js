const DEFAULT_LANG = "uk";
const RTL_LANGS = new Set(["he"]);
const LANGS = ["uk", "he", "ru", "en"];

let site = null;
let artworks = [];
let currentLang = DEFAULT_LANG;
let historyAutoScrollTimer = null;
let historyFrameTimer = null;

const nodes = {
  gallery: document.querySelector("[data-gallery]"),
  aboutText: document.querySelector("[data-about-text]"),
  contactLinks: document.querySelector("[data-contact-links]"),
  footer: document.querySelector("[data-footer]"),
  languageSelect: document.querySelector("[data-language-select]"),
  navToggle: document.querySelector("[data-nav-toggle]"),
  navPanel: document.querySelector("[data-nav-panel]"),
  dialog: document.querySelector("[data-art-dialog]"),
  dialogClose: document.querySelector("[data-dialog-close]"),
  artDetail: document.querySelector("[data-art-detail]")
};

function translate(value, lang = currentLang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value[DEFAULT_LANG] || value.en || Object.values(value)[0] || "";
}

function text(key) {
  return translate(site?.ui?.[key]);
}

function artworkPrice(artwork) {
  return translate(artwork.price);
}

function formatArtworkDate(artwork) {
  if (!artwork.createdAt) return "";
  const date = new Date(`${artwork.createdAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return artwork.createdAt;
  const locale = currentLang === "he" ? "he-IL" : currentLang === "ru" ? "ru-RU" : currentLang === "en" ? "en-US" : "uk-UA";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
}

function setLanguage(lang) {
  currentLang = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  localStorage.setItem("artGalleryLanguage", currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = RTL_LANGS.has(currentLang) ? "rtl" : "ltr";
  document.body.dir = document.documentElement.dir;
  nodes.languageSelect.value = currentLang;
  renderPage();
}

function updateMeta() {
  const seo = site.seo || {};
  const title = translate(seo.title);
  const description = translate(seo.description);
  const siteUrl = site.siteUrl || window.location.href.split("#")[0];
  const preview = new URL(seo.previewImage || "assets/social-preview.jpg", siteUrl).href;

  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", siteUrl);
  setMeta("property", "og:image", preview);
  setMeta("property", "og:locale", currentLang === "he" ? "he_IL" : currentLang === "ru" ? "ru_RU" : currentLang === "en" ? "en_US" : "uk_UA");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", preview);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", siteUrl);
}

function setMeta(attribute, key, content) {
  const node = document.querySelector(`meta[${attribute}="${key}"]`);
  if (node) node.setAttribute("content", content);
}

function renderPage() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  updateMeta();
  renderGallery();
  renderAbout();
  renderContact();
  nodes.footer.textContent = `${new Date().getFullYear()} ${translate(site.artistName)}. ${text("footerText")}`;
}

function renderGallery() {
  nodes.gallery.innerHTML = "";
  artworks.forEach((artwork) => {
    const card = document.createElement("article");
    card.className = "art-card";
    const price = artworkPrice(artwork) ? `<span class="pill">${escapeHtml(artworkPrice(artwork))}</span>` : "";
    const history = Array.isArray(artwork.history) && artwork.history.length;
    card.innerHTML = `
      <a class="art-image-button" href="${escapeAttribute(artworkUrl(artwork.id))}" data-artwork-id="${escapeHtml(artwork.id)}">
        <img src="${escapeAttribute(artwork.image)}" alt="${escapeAttribute(translate(artwork.title))}" loading="lazy">
      </a>
      <div class="art-card-body">
        <h3>${escapeHtml(translate(artwork.title))}</h3>
        <p>${escapeHtml(translate(artwork.description))}</p>
        <div class="meta-row">
          <span class="pill">${escapeHtml(translate(artwork.technique))}</span>
          ${artwork.createdAt ? `<span class="pill">${escapeHtml(formatArtworkDate(artwork))}</span>` : ""}
          ${price}
        </div>
        <div class="card-actions">
          <a class="card-action primary" href="${escapeAttribute(artworkUrl(artwork.id))}" data-artwork-id="${escapeHtml(artwork.id)}">${escapeHtml(text("viewDetails"))}</a>
          ${history
            ? `<a class="card-action secondary" href="${escapeAttribute(artworkHistoryUrl(artwork.id))}" data-history-id="${escapeHtml(artwork.id)}">${escapeHtml(text("viewHistory"))}</a>`
            : `<span class="card-action secondary is-disabled" aria-disabled="true">${escapeHtml(text("noHistory"))}</span>`}
        </div>
      </div>
    `;
    nodes.gallery.append(card);
  });
}

function renderAbout() {
  const paragraphs = translate(site.about)
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  nodes.aboutText.innerHTML = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function renderContact() {
  nodes.contactLinks.innerHTML = "";
  (site.contact || []).forEach((contact) => {
    const link = document.createElement("a");
    link.className = contact.icon ? `final-icon-button final-${contact.icon}` : "button secondary";
    link.href = contact.href;
    link.target = contact.href.startsWith("http") ? "_blank" : "";
    link.rel = contact.href.startsWith("http") ? "noopener noreferrer" : "";
    link.setAttribute("aria-label", translate(contact.label));
    link.innerHTML = iconSvg(contact.icon) || `<span>${escapeHtml(translate(contact.label))}</span>`;
    nodes.contactLinks.append(link);
  });
}

function artworkUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("lang", currentLang);
  url.searchParams.set("artwork", id);
  url.searchParams.delete("history");
  url.hash = "";
  return url.href;
}

function artworkHistoryUrl(id) {
  const url = new URL(artworkUrl(id));
  url.searchParams.set("history", "1");
  return url.href;
}

function whatsappShareUrl(artwork) {
  const message = `${text("shareMessage")} ${translate(artwork.title)} - ${artworkUrl(artwork.id)}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function openArtwork(id, options = {}) {
  const artwork = artworks.find((item) => item.id === id);
  if (!artwork) return;

  if (!options.fromUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", currentLang);
    url.searchParams.set("artwork", artwork.id);
    if (options.focusHistory) url.searchParams.set("history", "1");
    else url.searchParams.delete("history");
    history.replaceState(null, "", url);
  }

  const priceBlock = artwork.price
    ? `<div><dt>${escapeHtml(text("priceLabel"))}</dt><dd>${escapeHtml(artworkPrice(artwork))}</dd></div>`
    : "";
  const dateBlock = artwork.createdAt
    ? `<div><dt>${escapeHtml(text("dateLabel"))}</dt><dd>${escapeHtml(formatArtworkDate(artwork))}</dd></div>`
    : "";
  const pieces = Array.isArray(artwork.pieces) ? artwork.pieces : [];
  const piecesBlock = pieces.length
    ? `
      <section class="pieces-section" aria-labelledby="pieces-title">
        <h3 id="pieces-title">${escapeHtml(text("piecesTitle"))}</h3>
        <div class="pieces-grid" style="--piece-count: ${pieces.length}">
          ${pieces.map((src, index) => `
            <figure>
              <img src="${escapeAttribute(src)}" alt="${escapeAttribute(`${text("pieceLabel")} ${index + 1}`)}" loading="lazy">
              <figcaption>${escapeHtml(text("pieceLabel"))} ${index + 1}</figcaption>
            </figure>
          `).join("")}
        </div>
      </section>`
    : "";
  const historyFrames = Array.isArray(artwork.history) ? artwork.history : [];
  const historyBlock = historyFrames.length
    ? `
      <section class="history-section" aria-labelledby="history-title">
        <div class="history-head">
          <h3 id="history-title">${escapeHtml(text("historyTitle"))}</h3>
          <div class="history-controls">
            <button class="icon-button animation-button" type="button" data-history-play aria-label="${escapeAttribute(text("playHistoryAnimation"))}" aria-pressed="false">
              ${iconSvg("animation")}
            </button>
            <button class="icon-button" type="button" data-slide-prev aria-label="${escapeAttribute(text("previous"))}">&#8592;</button>
            <button class="icon-button" type="button" data-slide-next aria-label="${escapeAttribute(text("next"))}">&#8594;</button>
          </div>
        </div>
        <figure class="history-stage" data-history-stage>
          <img src="${escapeAttribute(historyFrames[0])}" alt="${escapeAttribute(`${text("stepLabel")} 1`)}" data-history-stage-image>
          <figcaption data-history-stage-caption>${escapeHtml(text("stepLabel"))} 1 / ${historyFrames.length}</figcaption>
        </figure>
        <div class="history-track" data-history-track>
          ${historyFrames.map((src, index) => `
            <figure>
              <img src="${escapeAttribute(src)}" alt="${escapeAttribute(`${text("stepLabel")} ${index + 1}`)}" loading="lazy">
              <figcaption>${escapeHtml(text("stepLabel"))} ${index + 1}</figcaption>
            </figure>
          `).join("")}
        </div>
      </section>`
    : "";

  nodes.artDetail.innerHTML = `
    <div class="detail-grid">
      <img class="detail-image" src="${escapeAttribute(artwork.image)}" alt="${escapeAttribute(translate(artwork.title))}">
      <div class="detail-copy">
        <p class="eyebrow">${escapeHtml(text("artworkEyebrow"))}</p>
        <h2 id="dialog-title">${escapeHtml(translate(artwork.title))}</h2>
        <p>${escapeHtml(translate(artwork.description))}</p>
        <dl class="detail-list">
          <div><dt>${escapeHtml(text("techniqueLabel"))}</dt><dd>${escapeHtml(translate(artwork.technique))}</dd></div>
          ${dateBlock}
          ${priceBlock}
        </dl>
        <div class="detail-actions">
          <a class="button primary" href="#contact" data-dialog-contact>${escapeHtml(text("contactAboutArtwork"))}</a>
          <a class="final-icon-button final-whatsapp" href="${escapeAttribute(whatsappShareUrl(artwork))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttribute(text("shareWhatsapp"))}">
            ${iconSvg("whatsapp")}
          </a>
        </div>
      </div>
    </div>
    ${piecesBlock}
    ${historyBlock}
  `;

  nodes.artDetail.querySelector("[data-dialog-contact]")?.addEventListener("click", closeArtwork);
  setupHistoryControls();
  if (typeof nodes.dialog.showModal === "function") {
    nodes.dialog.showModal();
  } else {
    nodes.dialog.setAttribute("open", "");
  }
  if (options.focusHistory) {
    window.setTimeout(scrollDialogToHistory, 120);
  }
}

function closeArtwork() {
  stopHistoryAutoScroll();
  stopHistoryFrameAnimation();
  nodes.dialog.close();
  const url = new URL(window.location.href);
  url.searchParams.delete("artwork");
  url.searchParams.delete("history");
  history.replaceState(null, "", url);
}

function setupHistoryControls() {
  stopHistoryAutoScroll();
  stopHistoryFrameAnimation();
  const track = nodes.artDetail.querySelector("[data-history-track]");
  if (!track) return;
  const frames = [...track.querySelectorAll("img")].map((image) => image.getAttribute("src"));
  let activeFrame = 0;
  const step = () => Math.max(220, Math.floor(track.clientWidth * 0.75));

  const showFrame = (index) => {
    if (!frames.length) return;
    activeFrame = (index + frames.length) % frames.length;
    const stage = nodes.artDetail.querySelector("[data-history-stage]");
    const stageImage = nodes.artDetail.querySelector("[data-history-stage-image]");
    const stageCaption = nodes.artDetail.querySelector("[data-history-stage-caption]");
    if (!stage || !stageImage || !stageCaption) return;

    stage.classList.remove("is-animating");
    stageImage.src = frames[activeFrame];
    stageImage.alt = `${text("stepLabel")} ${activeFrame + 1}`;
    stageCaption.textContent = `${text("stepLabel")} ${activeFrame + 1} / ${frames.length}`;
    void stage.offsetWidth;
    window.requestAnimationFrame(() => stage.classList.add("is-animating"));
  };

  nodes.artDetail.querySelector("[data-slide-prev]")?.addEventListener("click", () => {
    stopHistoryAutoScroll();
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });
  nodes.artDetail.querySelector("[data-slide-next]")?.addEventListener("click", () => {
    stopHistoryAutoScroll();
    track.scrollBy({ left: step(), behavior: "smooth" });
  });
  nodes.artDetail.querySelector("[data-history-play]")?.addEventListener("click", (event) => {
    stopHistoryAutoScroll();
    toggleHistoryFrameAnimation(event.currentTarget, () => showFrame(activeFrame + 1));
  });
  track.addEventListener("click", (event) => {
    const figure = event.target.closest("figure");
    if (!figure) return;
    stopHistoryFrameAnimation();
    showFrame([...track.querySelectorAll("figure")].indexOf(figure));
  });
  showFrame(0);
  startHistoryAutoScroll(track, step);
}

function startHistoryAutoScroll(track, step) {
  window.setTimeout(() => {
    if (!historyAutoScrollTimer) return;
    track.scrollBy({ left: step(), behavior: "smooth" });
  }, 650);
  historyAutoScrollTimer = window.setInterval(() => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return;
    const nextLeft = track.scrollLeft + step();
    track.scrollTo({ left: nextLeft >= maxScroll - 8 ? 0 : nextLeft, behavior: "smooth" });
  }, 2600);
  track.addEventListener("pointerdown", stopHistoryAutoScroll, { once: true });
  track.addEventListener("wheel", stopHistoryAutoScroll, { once: true });
}

function stopHistoryAutoScroll() {
  if (!historyAutoScrollTimer) return;
  window.clearInterval(historyAutoScrollTimer);
  historyAutoScrollTimer = null;
}

function toggleHistoryFrameAnimation(button, showNextFrame) {
  if (historyFrameTimer) {
    stopHistoryFrameAnimation();
    return;
  }
  button.setAttribute("aria-pressed", "true");
  button.classList.add("is-playing");
  showNextFrame();
  historyFrameTimer = window.setInterval(showNextFrame, 1200);
}

function stopHistoryFrameAnimation() {
  if (historyFrameTimer) {
    window.clearInterval(historyFrameTimer);
    historyFrameTimer = null;
  }
  const button = nodes.artDetail.querySelector("[data-history-play]");
  button?.setAttribute("aria-pressed", "false");
  button?.classList.remove("is-playing");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function scrollDialogToHistory() {
  const historySection = nodes.artDetail.querySelector(".history-section");
  if (!historySection) return;
  const top = Math.max(0, historySection.offsetTop - 16);
  nodes.dialog.scrollTo({ top, behavior: "smooth" });
}

function iconSvg(icon) {
  if (icon === "whatsapp") {
    return `
      <svg class="whatsapp-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 3.2A12.6 12.6 0 0 0 5.2 22.3L3.8 28l5.9-1.5A12.6 12.6 0 1 0 16 3.2Zm0 2.4a10.2 10.2 0 0 1 8.7 15.5 10.2 10.2 0 0 1-13.8 3.4l-.4-.2-3.2.8.8-3.1-.3-.5A10.2 10.2 0 0 1 16 5.6Zm-4.1 5.4c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.3-.1-.1-.2-.2-.5-.4l-1.8-.9c-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.5-.7-.5h-.4Z"></path>
      </svg>
    `;
  }
  if (icon === "email") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 3.2V17h16V8.2l-7.4 5.1a1 1 0 0 1-1.1 0L4 8.2Zm1.2-1.2 6.8 4.7L18.8 7H5.2Z"></path>
      </svg>
    `;
  }
  if (icon === "animation") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 12.5v-7Zm2.5-.6a.6.6 0 0 0-.6.6v7c0 .3.3.6.6.6h7c.3 0 .6-.3.6-.6v-7a.6.6 0 0 0-.6-.6h-7Zm2.3 2.2a.8.8 0 0 1 .8 0l3.1 1.8a.8.8 0 0 1 0 1.4l-3.1 1.8a.8.8 0 0 1-1.2-.7V7.8c0-.6.6-.9 1.2-.7ZM18 8.1c.5 0 .9.4.9.9v6.4a3.5 3.5 0 0 1-3.5 3.5H9c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h6.4c.9 0 1.7-.8 1.7-1.7V9c0-.5.4-.9.9-.9Zm3 3.1c.5 0 .9.4.9.9v4.3a5.5 5.5 0 0 1-5.5 5.5h-4.3c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h4.3a3.7 3.7 0 0 0 3.7-3.7v-4.3c0-.5.4-.9.9-.9Z"></path>
      </svg>
    `;
  }
  return "";
}

async function init() {
  const [siteResponse, artworksResponse] = await Promise.all([
    fetch("assets/site.json"),
    fetch("assets/artworks.json")
  ]);
  site = await siteResponse.json();
  artworks = await artworksResponse.json();

  const urlLanguage = new URLSearchParams(window.location.search).get("lang");
  const savedLanguage = localStorage.getItem("artGalleryLanguage");
  const initialLanguage = LANGS.includes(urlLanguage) ? urlLanguage : savedLanguage || DEFAULT_LANG;

  nodes.languageSelect.addEventListener("change", (event) => setLanguage(event.target.value));
  nodes.navToggle.addEventListener("click", () => {
    const expanded = nodes.navToggle.getAttribute("aria-expanded") === "true";
    nodes.navToggle.setAttribute("aria-expanded", String(!expanded));
    nodes.navPanel.classList.toggle("is-open", !expanded);
  });
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    link.addEventListener("click", () => {
      nodes.navPanel.classList.remove("is-open");
      nodes.navToggle.setAttribute("aria-expanded", "false");
    });
  });
  nodes.dialogClose.addEventListener("click", closeArtwork);
  nodes.dialog.addEventListener("click", (event) => {
    if (event.target === nodes.dialog) closeArtwork();
  });
  nodes.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeArtwork();
  });

  setLanguage(initialLanguage);
  const params = new URLSearchParams(window.location.search);
  const artworkFromUrl = params.get("artwork");
  if (artworkFromUrl) openArtwork(artworkFromUrl, { fromUrl: true, focusHistory: params.get("history") === "1" });
}

init().catch((error) => {
  console.error(error);
  nodes.gallery.innerHTML = "<p>Unable to load gallery content.</p>";
});
