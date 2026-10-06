const $ = (selector) => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const longDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "UTC",
});
const MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");
const dateLabel = (date) =>
  date ? longDate.format(new Date(date + "T12:00:00Z")) : "Sem data";
const badgeLabel = (date) =>
  date
    ? `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`
    : "Sem data";
const initials = (name) =>
  name
    .split(/\s+/)
    .filter((word) => word && !/^(d[aeo]s?|e)$/i.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const seed = (text) =>
  [...String(text)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const avatar = (person) =>
  `<span class="avatar c${seed(person.id) % 4}" aria-hidden="true">${esc(initials(person.name))}</span>`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const size = (bytes) =>
  bytes > 1e9
    ? (bytes / 1e9).toFixed(1).replace(".", ",") + " GB"
    : bytes > 1e6
      ? Math.round(bytes / 1e6) + " MB"
      : Math.max(1, Math.round(bytes / 1e3)) + " KB";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

// Variações do nome para o texto não ficar repetitivo nem formal demais.
let SITE = {};
try {
  SITE = JSON.parse($("#site-settings")?.textContent || "{}");
} catch {}
const ZONE = (SITE.zone_names || "Zona 023, 023ª Zona Eleitoral, Cartório TRE-RJ, Marechal Hermes, Acervo Zona 023")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
while (ZONE.length < 4) ZONE.push(ZONE[0] || "Zona 023");
const UNTITLED = [
  "Registro da Zona 023",
  "Na Zona 023",
  "Momento da Zona 023",
  "TRE Marechal Hermes",
  "Arquivo da 023ª ZE",
];
const pick = (list, key = Math.random() * 1e9) => list[seed(key) % list.length];
const titleOf = (photo) => photo.title || pick(UNTITLED, photo.id);

let photos = [],
  total = 0,
  nextOffset = null,
  selectedPerson = null,
  directoryPeople = [],
  requestNumber = 0,
  order = "newest",
  year = "",
  event = "",
  yearCounts = {},
  allYears = [];
let uploadQueue = [],
  activeIndex = -1,
  selectedPeople = [],
  editingPhoto = null,
  personContext = "directory",
  busy = false,
  currentPhoto = null,
  lastResults = [];
let selecting = false;
const selected = new Map();
const collapsed = new Set();
const tints = new Map();
let peopleRequest = 0,
  searchTimer,
  filterTimer,
  directoryTimer,
  dlPeopleTimer,
  toastTimer,
  installPrompt = null;
let editKeys = {};
try {
  editKeys = JSON.parse(localStorage.getItem("tre023-edit-keys") || "{}");
} catch {
  /* O acervo continua acessível sem armazenamento local. */
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!response.ok)
    throw new Error(data.error || "Não deu certo agora. Tente de novo.");
  return data;
}
// Envio com progresso real: fetch ainda não informa o upload em todos os navegadores.
function sendPhoto(form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) =>
      event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.response)
        : reject(new Error(xhr.response?.error || "Falha no envio."));
    xhr.onerror = () =>
      reject(new Error("Sem conexão. Confira a internet e tente de novo."));
    xhr.send(form);
  });
}
function errorAt(selector, message = "") {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
  if (message && element.closest(".sheet-body"))
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function toast(message, success = false) {
  clearTimeout(toastTimer);
  const element = $("#toast");
  element.hidden = true;
  element.innerHTML =
    (success
      ? '<svg class="toast-check" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="14"/><path d="m8.5 14.5 3.6 3.6 7.4-7.6"/></svg>'
      : "") + `<span>${esc(message)}</span>`;
  void element.offsetWidth;
  element.hidden = false;
  toastTimer = setTimeout(() => (element.hidden = true), 4200);
}
function empty(title, body, action = "") {
  return `<div class="empty"><svg class="empty-art" aria-hidden="true"><use href="#art-empty"/></svg><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;
}
function setOpen(element, open) {
  element.dataset.open = String(open);
  element.inert = !open;
}

/* ---------- Contagem anônima de acessos (painel da equipe) ---------- */
const counted = new Set();
function track(kind, ref) {
  const key = kind + ref;
  if (counted.has(key)) return;
  counted.add(key);
  const body = JSON.stringify({ kind, ref });
  try {
    if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" })))
      fetch("/api/hit", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {}
}

/* ---------- Rotas: início e /baixar ---------- */
function route() {
  const download = location.pathname === "/memorias/baixar";
  $("#view-home").hidden = download;
  $("#view-download").hidden = !download;
  for (const link of $$("[data-link]")) {
    const target = new URL(link.href);
    const current =
      target.pathname === location.pathname && (download || !target.hash);
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.title = download
    ? "Baixar fotos · 023ª Zona Eleitoral"
    : "Memórias da 023ª Zona Eleitoral | Cartório TRE-RJ · Marechal Hermes";
  if (download) loadDownloads();
  track("page", download ? "/memorias/baixar" : "/memorias");
  syncFab();
}
function navigate(href) {
  const url = new URL(href, location.href);
  closeMenu();
  if (url.pathname !== location.pathname || url.hash) {
    history.pushState(null, "", url.pathname + url.search);
    route();
  }
  if (url.hash === "#pessoas") {
    changeTab("people");
    $("#collection").scrollIntoView({ behavior: smooth() });
  } else if (url.hash) $(url.hash)?.scrollIntoView({ behavior: smooth() });
  else scrollTo({ top: 0, behavior: smooth() });
}
const smooth = () => (reduceMotion.matches ? "instant" : "smooth");
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
});

/* ---------- Menu expansível ---------- */
function openMenu(open) {
  setOpen($("#menu"), open);
  $("#menu-button").setAttribute("aria-expanded", String(open));
  $("#menu-button").setAttribute("aria-label", open ? "Fechar menu de navegação" : "Abrir menu de navegação");
  $("#menu-button use").setAttribute("href", open ? "#i-close" : "#i-menu");
  $("#menu-scrim").hidden = !open;
  document.documentElement.classList.toggle("menu-open", open);
}
const closeMenu = () => openMenu(false);
$("#menu-button").onclick = () =>
  openMenu($("#menu").dataset.open !== "true");
$("#menu-scrim").onclick = closeMenu;
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#menu").dataset.open === "true") closeMenu();
});
$("#menu").addEventListener("click", (event) => {
  if (event.target.closest("button")) closeMenu();
});
addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#install-app").hidden = false;
});
$("#install-app").onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $("#install-app").hidden = true;
};

/* ---------- Números ---------- */
function countUp(element, value) {
  const start = Number(element.textContent) || 0;
  if (reduceMotion.matches || start === value) {
    element.textContent = value;
    return;
  }
  const began = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - began) / 800);
    element.textContent = Math.round(start + (value - start) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
let statsData = null;
async function stats() {
  statsData = await api("/api/stats");
  countUp($("#stat-photos"), statsData.photos);
  countUp($("#stat-people"), statsData.people);
  countUp($("#stat-dates"), statsData.dates);
  allYears = statsData.years;
  renderYearNav();
  return statsData;
}

/* ---------- Linha do tempo ---------- */
function hasFilters() {
  return Boolean(
    $("#filter-name").value.trim() ||
      $("#filter-from").value ||
      $("#filter-to").value ||
      selectedPerson ||
      year ||
      event,
  );
}
const yearKey = (photo) => (photo.date ? photo.date.slice(0, 4) : "sem-data");
function photoCard(photo) {
  const people = photo.people;
  const firstNames = people.map((person) => person.name.split(" ")[0]);
  const who = people.length
    ? firstNames.slice(0, 2).join(", ") + (people.length > 2 ? ` +${people.length - 2}` : "")
    : "Ninguém marcado";
  const tint = tints.get(photo.id);
  const eventLine = photo.event ? `<span class="card-event">${esc(photo.event.name)}</span>` : "";
  return `<button class="photo-card" type="button" data-photo="${photo.id}" aria-pressed="${selected.has(photo.id)}"${tint ? ` data-tint="${tint}"` : ""} aria-label="${esc(titleOf(photo))}, ${esc(dateLabel(photo.date))}"><span class="photo-frame"><img src="${photo.thumbnail}" loading="lazy" decoding="async" alt="" width="640" height="640"><span class="glare"></span><span class="badge${photo.date ? "" : " undated"}">${esc(badgeLabel(photo.date))}</span>${people.length ? `<span class="people-count">${icon("people")}${people.length}</span>` : ""}<span class="pick">${icon("check")}</span></span><span class="card-info">${eventLine}<strong>${esc(titleOf(photo))}</strong><span class="card-meta">${people.length ? `<span class="avatar-stack">${people.slice(0, 3).map(avatar).join("")}</span>` : ""}<span>${esc(who)}</span></span></span></button>`;
}
function groupHtml(key) {
  const count = yearCounts[key === "sem-data" ? "" : key] ?? 0;
  const closed = collapsed.has(key);
  return `<section class="year-group${closed ? " collapsed" : ""}" data-year="${key}"><button class="year-head" type="button" aria-expanded="${!closed}"><span class="year-num${key === "sem-data" ? " undated" : ""}">${key === "sem-data" ? "Sem data" : key}</span><span class="year-count">${plural(count, "foto", "fotos")}</span><span class="year-line"></span><svg class="icon chevron" aria-hidden="true"><use href="#i-down"/></svg></button><div class="year-body"${closed ? " inert" : ""}><div class="gallery"></div></div></section>`;
}
function appendCards(list) {
  const gallery = $("#gallery");
  for (const photo of list) {
    const key = yearKey(photo);
    let group = gallery.querySelector(`[data-year="${key}"]`);
    if (!group) {
      gallery.insertAdjacentHTML("beforeend", groupHtml(key));
      group = gallery.lastElementChild;
    }
    group.querySelector(".gallery").insertAdjacentHTML("beforeend", photoCard(photo));
  }
  for (const card of $$(".photo-card[data-tint]", gallery)) {
    card.style.setProperty("--tint", card.dataset.tint);
    card.removeAttribute("data-tint");
  }
  for (const img of $$(".photo-frame:not(.loaded) img", gallery))
    if (img.complete && img.naturalWidth) loaded(img);
}
// Cor média da miniatura vira a cor da borda, da sombra e do fundo do card.
function loaded(img) {
  const frame = img.closest(".photo-frame");
  frame.classList.add("loaded");
  const card = img.closest(".photo-card");
  const id = card?.dataset.photo;
  if (!id || tints.has(id) || !img.naturalWidth) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 6;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(img, 0, 0, 6, 6);
    const data = context.getImageData(0, 0, 6, 6).data;
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    // Escurece um pouco para a sombra não ficar lavada em fotos claras.
    const tint = [r, g, b].map((value) => Math.round((value / n) * 0.82)).join(" ");
    tints.set(id, tint);
    card.style.setProperty("--tint", tint);
  } catch {
    /* sem cor, fica o azul padrão */
  }
}
const skeletons = (count) =>
  `<section class="year-group"><div class="year-head"><span class="year-num">····</span></div><div class="gallery">${Array.from(
    { length: count },
    () =>
      '<div class="photo-card skeleton" aria-hidden="true"><span class="photo-frame"></span><span class="bar"></span><span class="bar"></span></div>',
  ).join("")}</div></section>`;
function summary() {
  const term =
    selectedPerson?.name ||
    $("#filter-name").value.trim() ||
    $("#filter-event").selectedOptions[0]?.dataset.name;
  const count = `<strong>${total}</strong> ${total === 1 ? "foto" : "fotos"}`;
  $("#result-summary").innerHTML = term
    ? `${count} com “${esc(term)}”`
    : year
      ? `${count} ${year === "sem-data" ? "sem data" : "de " + year}`
      : hasFilters()
        ? `${count} no período`
        : `${count} na ${pick(ZONE.slice(0, 3), total)}, ${order === "newest" ? "das mais novas às antigas" : "das antigas às mais novas"}`;
}
function renderYearNav() {
  if (!allYears.length) {
    $("#year-nav").innerHTML = "";
    return;
  }
  $("#year-nav").innerHTML = [
    `<button class="year-chip" type="button" data-year-filter="" aria-pressed="${!year}">Todos</button>`,
    ...allYears.map((item) => {
      const key = item.year || "sem-data";
      return `<button class="year-chip" type="button" data-year-filter="${key}" aria-pressed="${year === key}">${item.year || "Sem data"}<small>${item.count}</small></button>`;
    }),
  ].join("");
}
async function loadPhotos(append = false) {
  const number = ++requestNumber;
  const params = new URLSearchParams({
    name: selectedPerson ? "" : $("#filter-name").value.trim(),
    from: $("#filter-from").value,
    to: $("#filter-to").value,
    order,
    year,
    event,
  });
  if (selectedPerson) params.set("person", selectedPerson.id);
  if (append) params.set("offset", nextOffset);
  $("#gallery").setAttribute("aria-busy", "true");
  $("#load-more").disabled = true;
  if (!append && !photos.length) $("#gallery").innerHTML = skeletons(6);
  try {
    const data = await api("/api/photos?" + params);
    if (number !== requestNumber) return;
    if (data.years)
      yearCounts = Object.fromEntries(data.years.map((item) => [item.year, item.count]));
    total = data.total;
    nextOffset = data.nextOffset;
    if (append) {
      photos = [...photos, ...data.photos];
      appendCards(data.photos);
    } else {
      photos = data.photos;
      $("#gallery").innerHTML = "";
      if (photos.length) appendCards(photos);
      else
        $("#gallery").innerHTML = hasFilters()
          ? empty(
              "Ninguém com esse nome por aqui",
              "Tente só o primeiro nome, outro ano ou outro período.",
              '<button class="btn btn-outline" id="empty-clear" type="button">Limpar busca</button>',
            )
          : empty(
              "O acervo ainda não tem fotos",
              "Tem alguma da Zona 023 no celular? Seja a primeira pessoa a mandar.",
              `<button class="btn btn-primary upload-trigger" type="button">${icon("camera")}Enviar fotos</button>`,
            );
    }
    summary();
    $("#clear-filters").hidden = !hasFilters();
    $("#load-more").hidden = nextOffset === null;
  } catch (error) {
    if (number !== requestNumber) return;
    $("#gallery").innerHTML = empty(
      "Não deu para carregar as fotos",
      error.message,
      '<button class="btn btn-outline" id="retry-gallery" type="button">Tentar de novo</button>',
    );
    $("#result-summary").textContent = "";
    $("#load-more").hidden = true;
  } finally {
    if (number === requestNumber) {
      $("#gallery").setAttribute("aria-busy", "false");
      $("#load-more").disabled = false;
    }
  }
}
$("#gallery").addEventListener(
  "load",
  (event) => event.target.matches?.(".photo-frame img") && loaded(event.target),
  true,
);
$("#gallery").addEventListener(
  "error",
  (event) => event.target.closest?.(".photo-frame")?.classList.add("loaded"),
  true,
);
function toggleGroup(group) {
  const key = group.dataset.year;
  const close = !group.classList.contains("collapsed");
  group.classList.add("animating");
  group.classList.toggle("collapsed", close);
  group.querySelector(".year-head").setAttribute("aria-expanded", String(!close));
  group.querySelector(".year-body").inert = close;
  if (close) collapsed.add(key);
  else collapsed.delete(key);
  setTimeout(() => group.classList.remove("animating"), 460);
}
function clearFilters() {
  $("#search-form").reset();
  selectedPerson = null;
  year = "";
  event = "";
  renderYearNav();
  togglePeriod(false);
  loadPhotos();
}
function togglePeriod(open) {
  setOpen($("#period"), open);
  $("#toggle-period").setAttribute("aria-expanded", String(open));
}
$("#toggle-period").onclick = () =>
  togglePeriod($("#period").dataset.open !== "true");
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  selectedPerson = null;
  document.activeElement?.blur?.();
  loadPhotos();
});
$("#filter-name").addEventListener("input", () => {
  selectedPerson = null;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => loadPhotos(), 280);
});
for (const id of ["#filter-from", "#filter-to"])
  $(id).addEventListener("change", () => loadPhotos());
$("#filter-event").addEventListener("change", () => {
  event = $("#filter-event").value;
  loadPhotos();
});
async function loadEvents() {
  try {
    const data = await api("/api/events");
    $(".event-filter").hidden = !data.events.length;
    $("#filter-event").innerHTML =
      '<option value="">Todos os eventos</option>' +
      data.events
        .map(
          (item) =>
            `<option value="${item.id}" data-name="${esc(item.name)}"${item.id === event ? " selected" : ""}>${esc(item.name)} (${item.photos})</option>`,
        )
        .join("");
  } catch {}
}
function filterEvent(item) {
  event = item.id;
  selectedPerson = null;
  year = "";
  $("#filter-name").value = "";
  renderYearNav();
  const finish = () => {
    loadEvents();
    togglePeriod(true);
    changeTab("gallery");
    loadPhotos();
    $("#collection").scrollIntoView({ behavior: smooth() });
  };
  if ($("#photo-dialog").open) closeDialog("photo-dialog", finish);
  else finish();
}
$("#clear-filters").onclick = clearFilters;
for (const button of $$("[data-order]"))
  button.onclick = () => {
    order = button.dataset.order;
    for (const other of $$("[data-order]"))
      other.setAttribute("aria-pressed", String(other === button));
    loadPhotos();
  };
$("#load-more").onclick = () => loadPhotos(true);
// Rolagem infinita: carrega o próximo lote antes de o fim aparecer.
new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && nextOffset !== null && !$("#load-more").disabled)
      loadPhotos(true);
  },
  { rootMargin: "700px 0px" },
).observe($("#load-more"));

/* ---------- Cards 3D: inclinação e luz seguindo o mouse ---------- */
let tiltCard = null,
  tiltFrame = 0;
$("#gallery").addEventListener("pointermove", (event) => {
  if (!finePointer.matches || reduceMotion.matches || event.pointerType !== "mouse") return;
  const card = event.target.closest(".photo-card:not(.skeleton)");
  if (card !== tiltCard) resetTilt();
  if (!card) return;
  tiltCard = card;
  card.classList.add("tilting");
  cancelAnimationFrame(tiltFrame);
  tiltFrame = requestAnimationFrame(() => {
    const box = card.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width,
      y = (event.clientY - box.top) / box.height;
    card.style.setProperty("--ry", ((x - 0.5) * 10).toFixed(2) + "deg");
    card.style.setProperty("--rx", ((0.5 - y) * 8).toFixed(2) + "deg");
    card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
    card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
  });
});
function resetTilt() {
  if (!tiltCard) return;
  cancelAnimationFrame(tiltFrame);
  tiltCard.classList.remove("tilting");
  for (const name of ["--rx", "--ry"]) tiltCard.style.setProperty(name, "0deg");
  tiltCard = null;
}
$("#gallery").addEventListener("pointerleave", resetTilt);

/* ---------- Seleção para download ---------- */
const MAX_SELECTION = 200;
function setSelecting(on) {
  selecting = on;
  if (!on) {
    selected.clear();
    for (const card of $$(".photo-card[aria-pressed='true']"))
      card.setAttribute("aria-pressed", "false");
  }
  $("#gallery").dataset.selecting = String(on);
  $("#select-mode").setAttribute("aria-pressed", String(on));
  $("#select-mode span").textContent = on ? "Concluir" : "Selecionar";
  syncSelection();
  syncFab();
}
function syncSelection() {
  const count = selected.size;
  setOpen($("#select-bar"), selecting);
  const counter = $("#select-count");
  if (counter.textContent !== String(count)) {
    counter.textContent = count;
    counter.classList.remove("bump");
    void counter.offsetWidth;
    counter.classList.add("bump");
  }
  $("#select-label").textContent = count === 1 ? "selecionada" : "selecionadas";
  const link = $("#select-download");
  link.setAttribute("aria-disabled", String(!count));
  link.href = count
    ? `/api/download.zip?label=selecao&ids=${[...selected.keys()].join(",")}`
    : "#";
}
function toggleSelect(card) {
  const id = card.dataset.photo;
  if (selected.has(id)) selected.delete(id);
  else if (selected.size >= MAX_SELECTION) {
    toast(`Dá para baixar até ${MAX_SELECTION} de uma vez.`);
    return;
  } else selected.set(id, true);
  card.setAttribute("aria-pressed", String(selected.has(id)));
  syncSelection();
}
$("#select-mode").onclick = () => setSelecting(!selecting);
$("#select-cancel").onclick = () => setSelecting(false);
$("#select-all").onclick = () => {
  for (const card of $$(".photo-card[data-photo]")) {
    if (selected.size >= MAX_SELECTION) break;
    selected.set(card.dataset.photo, true);
    card.setAttribute("aria-pressed", "true");
  }
  syncSelection();
};
$("#select-download").addEventListener("click", (event) => {
  if (!selected.size) return event.preventDefault();
  toast(`Preparando o ZIP com ${plural(selected.size, "foto", "fotos")}…`, true);
});

/* ---------- Abas e pessoas ---------- */
function changeTab(which, focus = false) {
  if (location.pathname !== "/memorias/baixar") document.title = which === "people"
    ? "Pessoas do acervo · 023ª Zona Eleitoral"
    : "Memórias da 023ª Zona Eleitoral | Cartório TRE-RJ · Marechal Hermes";
  const people = which === "people";
  $(".tabs").dataset.active = people ? "people" : "gallery";
  for (const [id, active] of [
    ["gallery", !people],
    ["people", people],
  ]) {
    $(`#${id}-tab`).setAttribute("aria-selected", String(active));
    $(`#${id}-tab`).tabIndex = active ? 0 : -1;
    $(`#${id}-panel`).hidden = !active;
  }
  if (people && selecting) setSelecting(false);
  if (focus) $(`#${which}-tab`).focus();
  if (people) loadDirectory();
}
$("#gallery-tab").onclick = () => changeTab("gallery");
$("#people-tab").onclick = () => changeTab("people");
$(".tabs").addEventListener("keydown", (event) => {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  changeTab(
    event.key === "Home"
      ? "gallery"
      : event.key === "End"
        ? "people"
        : $("#gallery-tab").getAttribute("aria-selected") === "true"
          ? "people"
          : "gallery",
    true,
  );
});
async function loadDirectory() {
  const query = $("#directory-search").value.trim();
  $("#directory").setAttribute("aria-busy", "true");
  try {
    const data = await api("/api/people?q=" + encodeURIComponent(query));
    if (query !== $("#directory-search").value.trim()) return;
    directoryPeople = data.people;
    $("#directory").innerHTML = directoryPeople.length
      ? directoryPeople
          .map(
            (person) =>
              `<button class="person-card" type="button" data-directory-person="${person.id}">${avatar(person)}<span><strong>${esc(person.name)}</strong><small>${person.reference ? esc(person.reference) + " · " : ""}${plural(person.photos, "foto", "fotos")}</small></span>${icon("right")}</button>`,
          )
          .join("")
      : empty(
          query ? "Esse nome ainda não está aqui" : "Ninguém cadastrado ainda",
          query
            ? "Confira a grafia ou inclua a pessoa."
            : "Inclua os nomes da equipe para marcar nas fotos.",
          `<button class="btn btn-outline" type="button" id="empty-add-person">${icon("user-plus")}Incluir pessoa</button>`,
        );
  } catch (error) {
    $("#directory").innerHTML = empty(
      "Não deu para carregar os nomes",
      error.message,
      '<button class="btn btn-outline" id="retry-directory" type="button">Tentar de novo</button>',
    );
  } finally {
    $("#directory").setAttribute("aria-busy", "false");
  }
}
$("#directory-search").oninput = () => {
  clearTimeout(directoryTimer);
  directoryTimer = setTimeout(loadDirectory, 200);
};
function filterPerson(person) {
  if (!person) return;
  selectedPerson = person;
  year = "";
  renderYearNav();
  $("#filter-name").value = person.name;
  const finish = () => {
    if (location.pathname !== "/memorias") {
      history.pushState(null, "", "/memorias");
      route();
    }
    changeTab("gallery");
    loadPhotos();
    $("#collection").scrollIntoView({ behavior: smooth() });
  };
  if ($("#photo-dialog").open) closeDialog("photo-dialog", finish);
  else finish();
}

/* ---------- Página de download ---------- */
const zip = (params, label) =>
  `/api/download.zip?${new URLSearchParams({ ...params, label })}`;
async function loadDownloads() {
  try {
    const data = statsData || (await stats());
    $("#dl-all-meta").textContent = data.photos
      ? `${plural(data.photos, "foto", "fotos")} · cerca de ${size(data.bytes)}`
      : "Ainda não há fotos para baixar.";
    $("#dl-all").setAttribute("aria-disabled", String(!data.photos));
    $("#dl-year-list").innerHTML = data.years.length
      ? data.years
          .map((item) => {
            const key = item.year || "sem-data";
            return `<a class="dl-row" href="${zip({ year: key }, item.year || "sem-data")}" download><span><strong>${item.year || "Sem data"}</strong><small>${plural(item.count, "foto", "fotos")} · ${size(item.bytes)}</small></span><span class="dl-go">${icon("download")}</span></a>`;
          })
          .join("")
      : '<p class="hint">Nenhum ano ainda.</p>';
    loadDownloadPeople();
  } catch (error) {
    $("#dl-all-meta").textContent = error.message;
  }
}
async function loadDownloadPeople() {
  const query = $("#dl-person-search").value.trim();
  try {
    const data = await api("/api/people?q=" + encodeURIComponent(query));
    if (query !== $("#dl-person-search").value.trim()) return;
    const people = data.people.filter((person) => person.photos > 0).slice(0, 30);
    $("#dl-person-list").innerHTML = people.length
      ? people
          .map(
            (person) =>
              `<a class="dl-row" href="${zip({ person: person.id }, person.name)}" download><span><strong>${esc(person.name)}</strong><small>${plural(person.photos, "foto", "fotos")}${person.reference ? " · " + esc(person.reference) : ""}</small></span><span class="dl-go">${icon("download")}</span></a>`,
          )
          .join("")
      : `<p class="hint">${query ? "Ninguém com esse nome nas fotos." : "Ninguém marcado ainda."}</p>`;
  } catch (error) {
    $("#dl-person-list").innerHTML = `<p class="hint">${esc(error.message)}</p>`;
  }
}
$("#dl-person-search").oninput = () => {
  clearTimeout(dlPeopleTimer);
  dlPeopleTimer = setTimeout(loadDownloadPeople, 200);
};
for (const toggle of $$(".dl-toggle")) {
  const panel = $("#" + toggle.getAttribute("aria-controls"));
  setOpen(panel, false);
  toggle.onclick = () => {
    const open = panel.dataset.open !== "true";
    setOpen(panel, open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.closest(".dl-card").dataset.open = String(open);
  };
}
$("#dl-period-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const from = $("#dl-from").value,
    to = $("#dl-to").value;
  if (!from || !to || from > to) {
    toast("Confira as datas: a primeira vem antes da segunda.");
    return;
  }
  location.href = zip({ from, to }, `${from}-a-${to}`);
});
$("#view-download").addEventListener("click", (event) => {
  const link = event.target.closest("a[download]");
  if (link && link.getAttribute("aria-disabled") !== "true")
    toast("Preparando o ZIP… o download começa em instantes.", true);
});
$("#dl-pick").onclick = () => {
  history.pushState(null, "", "/memorias");
  route();
  changeTab("gallery");
  setSelecting(true);
  $("#collection").scrollIntoView({ behavior: smooth() });
};

/* ---------- Dialogs com botão Voltar do celular ---------- */
const stack = [];
function openDialog(id, url = location.href) {
  const dialog = $("#" + id);
  if (dialog.open) return;
  closeMenu();
  dialog.showModal();
  stack.push(id);
  history.pushState({ dialog: id }, "", url);
  syncFab();
}
let afterClose = null;
function closeDialog(id, then) {
  if (id === "upload-dialog" && busy) return;
  afterClose = then || null;
  if (stack.at(-1) === id) history.back();
  else {
    $("#" + id).close();
    const index = stack.indexOf(id);
    if (index >= 0) stack.splice(index, 1);
    finishClose(id);
  }
}
function finishClose(id) {
  if (id === "photo-dialog") currentPhoto = null;
  syncFab();
  const callback = afterClose;
  afterClose = null;
  callback?.();
}
addEventListener("popstate", () => {
  const id = stack.at(-1);
  if (!id) {
    route();
    return;
  }
  if (id === "upload-dialog" && busy) {
    history.pushState({ dialog: id }, "", location.href);
    return;
  }
  stack.pop();
  $("#" + id).close();
  finishClose(id);
});
for (const dialog of $$("dialog")) {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dialog.id);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog || busy) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      closeDialog(dialog.id);
  });
}

/* ---------- Botão flutuante ---------- */
let heroVisible = true;
function syncFab() {
  $(".fab").classList.toggle(
    "hide",
    (heroVisible && !$("#view-home").hidden) || stack.length > 0 || selecting,
  );
}
new IntersectionObserver((entries) => {
  heroVisible = entries[0].isIntersecting;
  syncFab();
}).observe($(".hero-actions"));

/* ---------- Envio ---------- */
function captureMetadata() {
  if (editingPhoto || !uploadQueue[activeIndex]) return;
  uploadQueue[activeIndex].metadata = {
    date: $("#photo-date").value,
    title: $("#photo-title").value,
    description: $("#photo-description").value,
    people: [...selectedPeople],
  };
  markThumb(activeIndex);
}
const filled = (item) => Boolean(item.metadata.date || item.metadata.people.length);
function markThumb(index) {
  const badge = document.querySelector(`[data-thumb="${index}"] .num`);
  if (!badge) return;
  const done = filled(uploadQueue[index]);
  if (badge.classList.contains("done") === done) return;
  badge.classList.toggle("done", done);
  badge.innerHTML = done ? icon("check") : String(index + 1);
}
function renderChips() {
  $("#selected-people").innerHTML = selectedPeople
    .map(
      (person) =>
        `<button type="button" class="chip" data-remove-person="${person.id}" aria-label="Tirar ${esc(person.name)} desta foto">${esc(person.name)}${person.reference ? ` <small>${esc(person.reference)}</small>` : ""}${icon("close")}</button>`,
    )
    .join("");
}
function renderQueue() {
  $("#file-list").innerHTML = uploadQueue
    .map(
      (item, index) =>
        `<div class="thumb${index === activeIndex ? " active" : ""}" data-thumb="${index}" role="listitem"><button type="button" data-file="${index}" aria-label="Foto ${index + 1}: ${esc(item.file.name)}" aria-current="${index === activeIndex}"><img src="${item.url}" alt=""></button><span class="num${filled(item) ? " done" : ""}">${filled(item) ? icon("check") : index + 1}</span><button type="button" class="remove" data-remove-file="${index}" aria-label="Tirar ${esc(item.file.name)} do envio">${icon("close")}</button></div>`,
    )
    .join("");
  const has = uploadQueue.length > 0;
  $("#queue").hidden = !has;
  $("#editor").hidden = !has;
  $("#upload-extra").hidden = !has;
  $("#dropzone").classList.toggle("compact", has);
  $("#dropzone strong").textContent = has ? "Mais fotos" : "Escolher fotos";
  $("#apply-all").hidden = uploadQueue.length < 2;
  $("#submit-upload").textContent = has
    ? uploadQueue.length === 1
      ? "Publicar foto"
      : `Publicar ${uploadQueue.length} fotos`
    : "Publicar";
  $("#submit-upload").disabled = !has;
}
function selectFile(index) {
  captureMetadata();
  activeIndex = Math.min(index, uploadQueue.length - 1);
  const item = uploadQueue[activeIndex];
  renderQueue();
  if (!item) return;
  $("#photo-date").value = item.metadata.date;
  $("#photo-title").value = item.metadata.title;
  $("#photo-description").value = item.metadata.description;
  $("#more-details").open = Boolean(item.metadata.title || item.metadata.description);
  selectedPeople = [...item.metadata.people];
  $("#file-preview").src = item.url;
  $("#file-hint").textContent = `Foto ${activeIndex + 1} de ${uploadQueue.length}`;
  $("#file-hint").hidden = uploadQueue.length < 2;
  $("#person-search").value = "";
  renderChips();
  searchPeople();
  document
    .querySelector(`[data-thumb="${activeIndex}"]`)
    ?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function releaseQueue() {
  for (const item of uploadQueue) URL.revokeObjectURL(item.url);
  uploadQueue = [];
}
function prepareDialog(edit = null) {
  errorAt("#upload-error");
  editingPhoto = edit;
  $("#upload-form").reset();
  $("#upload-progress").hidden = true;
  $("#upload-kicker").textContent = edit ? titleOf(edit) : pick(ZONE.slice(0, 4));
  $("#upload-title").textContent = edit ? "Corrigir dados" : "Enviar fotos";
  $("#dropzone").hidden = Boolean(edit);
  $("#queue").hidden = Boolean(edit);
  $("#upload-extra").hidden = true;
  $("#apply-all").hidden = true;
  if (edit) {
    $("#editor").hidden = false;
    $("#photo-date").value = edit.date;
    $("#photo-title").value = edit.title;
    $("#photo-description").value = edit.description;
    $("#more-details").open = true;
    selectedPeople = [...edit.people];
    $("#file-preview").src = edit.view || edit.src;
    $("#file-hint").hidden = true;
    $("#submit-upload").textContent = "Salvar";
    $("#submit-upload").disabled = false;
    renderChips();
    searchPeople();
  } else {
    releaseQueue();
    activeIndex = -1;
    selectedPeople = [];
    $("#more-details").open = false;
    try {
      $("#author").value = localStorage.getItem("tre023-author") || "";
    } catch {}
    renderQueue();
  }
  openDialog("upload-dialog");
}
function addFiles(fileList) {
  captureMetadata();
  const first = uploadQueue.length;
  const accepted = [...fileList].filter(
    (file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      file.size &&
      file.size <= 25 * 1024 * 1024,
  );
  const room = Math.max(0, 20 - first);
  for (const file of accepted.slice(0, room))
    uploadQueue.push({
      file,
      url: URL.createObjectURL(file),
      metadata: { date: "", title: "", description: "", people: [] },
    });
  errorAt(
    "#upload-error",
    accepted.length !== fileList.length
      ? "Alguns arquivos ficaram de fora: só JPG, PNG ou WebP de até 25 MB."
      : accepted.length > room
        ? "Cabem 20 fotos por envio. Mande o resto em seguida."
        : "",
  );
  if (uploadQueue.length > first) selectFile(first);
  $("#file-input").value = "";
}
$("#file-input").onchange = (event) => addFiles(event.target.files);
$("#dropzone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#dropzone").classList.add("dragging");
});
$("#dropzone").addEventListener("dragleave", () =>
  $("#dropzone").classList.remove("dragging"),
);
$("#dropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("#dropzone").classList.remove("dragging");
  if (!busy) addFiles(event.dataTransfer.files);
});
for (const id of ["photo-date", "photo-title", "photo-description"])
  $("#" + id).addEventListener("input", captureMetadata);
$("#apply-all").onclick = () => {
  captureMetadata();
  const { date, people } = uploadQueue[activeIndex].metadata;
  uploadQueue.forEach((item, index) => {
    item.metadata.date = date;
    item.metadata.people = [...people];
    markThumb(index);
  });
  toast(`Data e pessoas aplicadas nas ${uploadQueue.length} fotos.`, true);
};

async function searchPeople() {
  const number = ++peopleRequest;
  const query = $("#person-search").value.trim();
  try {
    const data = await api("/api/people?q=" + encodeURIComponent(query));
    if (number !== peopleRequest) return;
    lastResults = data.people;
    const chosen = (person) => selectedPeople.some((item) => item.id === person.id);
    const rows = data.people
      .slice(0, query ? 6 : 4)
      .map(
        (person) =>
          `<button type="button" class="person-result" data-select-person="${person.id}" ${chosen(person) ? "disabled" : ""}>${avatar(person)}<span>${esc(person.name)}${person.reference ? `<small>${esc(person.reference)}</small>` : ""}</span>${icon(chosen(person) ? "check" : "plus")}</button>`,
      );
    const exact = data.people.some(
      (person) => person.name.toLowerCase() === query.toLowerCase(),
    );
    if (query && !exact)
      rows.push(
        `<button type="button" class="person-result new" id="add-person">${icon("user-plus")}<span>Incluir “${esc(query)}”</span></button>`,
      );
    else if (!query && !data.people.length)
      rows.push(
        `<button type="button" class="person-result new" id="add-person">${icon("user-plus")}<span>Incluir a primeira pessoa</span></button>`,
      );
    $("#person-results").innerHTML = rows.join("");
  } catch (error) {
    $("#person-results").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#person-search").oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchPeople, 150);
};
$("#person-search").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  $("#person-results button:not(:disabled)")?.click();
});
function addPerson(context) {
  personContext = context;
  $("#person-form").reset();
  if (context === "upload") $("#person-name").value = $("#person-search").value.trim();
  errorAt("#person-error");
  openDialog("person-dialog");
  setTimeout(
    () =>
      $(
        context === "upload" && $("#person-name").value
          ? "#person-reference"
          : "#person-name",
      ).focus(),
    60,
  );
}
$("#directory-add").onclick = () => addPerson("directory");
function choose(person) {
  if (!selectedPeople.some((item) => item.id === person.id)) selectedPeople.push(person);
  captureMetadata();
  renderChips();
  $("#person-search").value = "";
  searchPeople();
}
$("#person-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("#person-name").value.trim()) {
    errorAt("#person-error", "Escreva o nome da pessoa.");
    $("#person-name").focus();
    return;
  }
  $("#save-person").disabled = true;
  errorAt("#person-error");
  try {
    const data = await api("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#person-name").value,
        reference: $("#person-reference").value,
      }),
    });
    closeDialog("person-dialog", () => {
      if (personContext === "upload") choose(data.person);
    });
    toast(
      data.reused
        ? `${data.person.name} já estava na lista. Marcado!`
        : `${data.person.name} entrou na lista da ${pick(ZONE.slice(0, 3))}.`,
      true,
    );
    await Promise.all([
      stats(),
      $("#people-panel").hidden ? null : loadDirectory(),
    ]);
  } catch (error) {
    errorAt("#person-error", error.message);
  } finally {
    $("#save-person").disabled = false;
  }
});
function setBusy(value) {
  busy = value;
  for (const control of $$("button,input,textarea", $("#upload-dialog")))
    control.disabled = value;
  if (!value) searchPeople();
}
function rememberKey(id, key) {
  editKeys[id] = key;
  try {
    localStorage.setItem("tre023-edit-keys", JSON.stringify(editKeys));
  } catch {
    /* edição vale só enquanto a página estiver aberta */
  }
}
function progress(text, value) {
  $("#upload-progress").hidden = false;
  $("#upload-progress-text").textContent = text;
  $("#upload-progress-bar").value = value;
}
$("#upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#upload-error");
  if (!editingPhoto) {
    if (!uploadQueue.length) return errorAt("#upload-error", "Escolha ao menos uma foto.");
    if (!$("#public-confirm").checked) {
      errorAt("#upload-error", "Marque a confirmação para publicar.");
      $("#public-confirm").focus();
      return;
    }
  }
  setBusy(true);
  try {
    if (editingPhoto) {
      progress("Salvando…", 60);
      const data = await api("/api/photos/" + editingPhoto.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Edit-Key": editKeys[editingPhoto.id],
        },
        body: JSON.stringify({
          date: $("#photo-date").value,
          title: $("#photo-title").value,
          description: $("#photo-description").value,
          people: selectedPeople.map((person) => person.id),
        }),
      });
      setBusy(false);
      const updated = data.photo;
      closeDialog("upload-dialog", () => showPhoto(updated));
      editingPhoto = null;
      toast("Dados corrigidos.", true);
    } else {
      captureMetadata();
      const count = uploadQueue.length,
        failed = [];
      let done = 0,
        failure = "";
      const author = $("#author").value;
      try {
        localStorage.setItem("tre023-author", author);
      } catch {}
      for (const [index, item] of uploadQueue.entries()) {
        const label = count > 1 ? `Enviando ${index + 1} de ${count}…` : "Enviando…";
        progress(label, (index / count) * 100);
        const form = new FormData();
        form.set("photo", item.file);
        form.set("author", author);
        form.set("public", "true");
        form.set(
          "metadata",
          JSON.stringify({
            ...item.metadata,
            people: item.metadata.people.map((person) => person.id),
          }),
        );
        try {
          const data = await sendPhoto(form, (part) =>
            progress(label, ((index + part) / count) * 100),
          );
          rememberKey(data.photo.id, data.editKey);
          URL.revokeObjectURL(item.url);
          done++;
        } catch (error) {
          failed.push(item);
          failure = error.message;
        }
      }
      uploadQueue = failed;
      activeIndex = -1;
      setBusy(false);
      if (failed.length) {
        selectFile(0);
        $("#upload-progress").hidden = true;
        errorAt(
          "#upload-error",
          `${done} de ${count} publicadas. ${failure} As que faltam continuam aqui.`,
        );
      } else {
        closeDialog("upload-dialog");
        toast(
          done === 1
            ? `Foto na ${pick(ZONE.slice(0, 3))}! Valeu.`
            : `${done} fotos na ${pick(ZONE.slice(0, 3))}! Valeu.`,
          true,
        );
      }
    }
    statsData = null;
    await Promise.all([loadPhotos(), stats()]);
  } catch (error) {
    $("#upload-progress").hidden = true;
    errorAt("#upload-error", error.message);
  } finally {
    setBusy(false);
  }
});

/* ---------- Visualizador ---------- */
function photoUrl(id) {
  const url = new URL(location.href);
  url.searchParams.set("photo", id);
  return url;
}
const viewCache = new Set();
function preload(photo) {
  if (!photo || viewCache.has(photo.view)) return;
  const image = new Image();
  image.onload = () => viewCache.add(photo.view);
  image.src = photo.view;
}
// Mostra a miniatura (já em cache) na hora e troca pela versão de tela quando chegar.
function setViewerImage(photo, direction = 0) {
  const image = $("#detail-image");
  const apply = () => {
    image.classList.remove("out-left", "out-right");
    if (viewCache.has(photo.view)) {
      image.src = photo.view;
      image.classList.remove("lowres");
      return;
    }
    image.src = photo.thumbnail;
    image.classList.add("lowres");
    const full = new Image();
    full.onload = () => {
      viewCache.add(photo.view);
      if (currentPhoto?.id !== photo.id) return;
      image.src = photo.view;
      image.classList.remove("lowres");
    };
    full.src = photo.view;
  };
  if (direction && !reduceMotion.matches) {
    image.classList.add(direction > 0 ? "out-left" : "out-right");
    setTimeout(apply, 140);
  } else apply();
}
function showPhoto(photo, direction = 0) {
  if (!photo) return;
  currentPhoto = photo;
  const index = photos.findIndex((item) => item.id === photo.id);
  $("#detail-position").textContent =
    index >= 0 && total > 1 ? `${index + 1} de ${total}` : pick(ZONE, photo.id);
  setViewerImage(photo, direction);
  $("#detail-image").alt = photo.title || "Foto do acervo da Zona 023";
  $("#detail-date").innerHTML = `${icon("calendar")}${esc(dateLabel(photo.date))}`;
  $("#detail-date").classList.toggle("undated", !photo.date);
  $("#detail-title").textContent = titleOf(photo);
  $("#detail-event").hidden = !photo.event;
  if (photo.event)
    $("#detail-event").innerHTML = `${icon("timeline")}${esc(photo.event.name)}`;
  track("photo", photo.id);
  $("#detail-description").textContent = photo.description;
  $("#detail-people").innerHTML = photo.people.length
    ? photo.people
        .map(
          (person) =>
            `<button class="chip chip-link" type="button" data-detail-person="${person.id}">${avatar(person)}${esc(person.name)}${person.reference ? ` <small>${esc(person.reference)}</small>` : ""}</button>`,
        )
        .join("")
    : '<p class="hint">Ninguém marcado ainda.</p>';
  $("#detail-author").textContent = photo.author ? "Enviada por " + photo.author : "";
  $("#detail-author").hidden = !photo.author;
  $("#detail-download").href = photo.src;
  $("#detail-download").download =
    `zon23-${photo.date || "sem-data"}-${photo.id.slice(0, 8)}.${photo.src.split(".").pop()}`;
  $("#detail-edit").hidden = !editKeys[photo.id];
  $("#previous-photo").disabled = index <= 0;
  $("#next-photo").disabled = index < 0 || index >= photos.length - 1;
  preload(photos[index + 1]);
  preload(photos[index - 1]);
  if ($("#photo-dialog").open)
    history.replaceState({ dialog: "photo-dialog" }, "", photoUrl(photo.id));
  else openDialog("photo-dialog", photoUrl(photo.id));
  if (index >= photos.length - 3 && nextOffset !== null) loadPhotos(true);
}
// Card "expande" até o visualizador (View Transitions, quando o navegador tem).
function openFromCard(card, photo) {
  const thumb = card.querySelector("img");
  if (!document.startViewTransition || reduceMotion.matches || !thumb?.complete) {
    showPhoto(photo);
    return;
  }
  resetTilt();
  thumb.style.viewTransitionName = "photo-hero";
  const transition = document.startViewTransition(() => {
    thumb.style.viewTransitionName = "";
    $("#detail-image").style.viewTransitionName = "photo-hero";
    showPhoto(photo);
  });
  transition.finished.finally(() => ($("#detail-image").style.viewTransitionName = ""));
}
function movePhoto(delta) {
  const index = photos.findIndex((photo) => photo.id === currentPhoto?.id);
  if (photos[index + delta]) showPhoto(photos[index + delta], delta);
}
$("#previous-photo").onclick = () => movePhoto(-1);
$("#next-photo").onclick = () => movePhoto(1);
$("#photo-dialog").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") movePhoto(-1);
  if (event.key === "ArrowRight") movePhoto(1);
});
// Deslizar para os lados troca de foto no celular.
let touchStart = null;
$("#viewer-stage").addEventListener(
  "touchstart",
  (event) => {
    touchStart =
      event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
  },
  { passive: true },
);
$("#viewer-stage").addEventListener(
  "touchend",
  (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x,
      dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
      movePhoto(dx < 0 ? 1 : -1);
  },
  { passive: true },
);
$("#detail-share").onclick = async () => {
  const url = photoUrl(currentPhoto.id).href;
  try {
    if (navigator.share) await navigator.share({ title: titleOf(currentPhoto), url });
    else {
      await navigator.clipboard.writeText(url);
      toast("Link copiado.", true);
    }
  } catch {
    /* compartilhamento cancelado */
  }
};
$("#detail-event").onclick = () => currentPhoto?.event && filterEvent(currentPhoto.event);
$("#detail-edit").onclick = () => {
  const photo = currentPhoto;
  closeDialog("photo-dialog", () => prepareDialog(photo));
};

/* ---------- Cliques delegados ---------- */
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.close) closeDialog(button.dataset.close);
  else if (button.classList.contains("upload-trigger")) prepareDialog();
  else if (button.dataset.photo) {
    if (selecting) toggleSelect(button);
    else
      openFromCard(
        button,
        photos.find((photo) => photo.id === button.dataset.photo),
      );
  } else if (button.classList.contains("year-head"))
    toggleGroup(button.closest(".year-group"));
  else if (button.dataset.yearFilter !== undefined) {
    year = button.dataset.yearFilter;
    selectedPerson = null;
    $("#filter-name").value = "";
    renderYearNav();
    button.scrollIntoView({ inline: "center", block: "nearest", behavior: smooth() });
    loadPhotos();
  } else if (button.dataset.directoryPerson)
    filterPerson(
      directoryPeople.find((person) => person.id === button.dataset.directoryPerson),
    );
  else if (button.dataset.detailPerson)
    filterPerson(
      currentPhoto.people.find((person) => person.id === button.dataset.detailPerson),
    );
  else if (button.dataset.selectPerson) {
    const person = lastResults.find((item) => item.id === button.dataset.selectPerson);
    if (person) choose(person);
  } else if (button.dataset.removePerson) {
    selectedPeople = selectedPeople.filter(
      (person) => person.id !== button.dataset.removePerson,
    );
    captureMetadata();
    renderChips();
    searchPeople();
  } else if (button.dataset.file !== undefined) selectFile(Number(button.dataset.file));
  else if (button.dataset.removeFile !== undefined) {
    captureMetadata();
    const [removed] = uploadQueue.splice(Number(button.dataset.removeFile), 1);
    URL.revokeObjectURL(removed.url);
    activeIndex = -1;
    if (uploadQueue.length) selectFile(0);
    else renderQueue();
  } else if (button.id === "add-person") addPerson("upload");
  else if (button.id === "empty-add-person") addPerson("directory");
  else if (button.id === "empty-clear") clearFilters();
  else if (button.id === "retry-gallery") loadPhotos();
  else if (button.id === "retry-directory") loadDirectory();
});

/* ---------- Início ---------- */
(async () => {
  setOpen($("#menu"), false);
  setOpen($("#period"), false);
  const url = new URL(location.href);
  const requestedPhoto = url.searchParams.get("photo");
  if (requestedPhoto) {
    url.searchParams.delete("photo");
    history.replaceState(null, "", url);
  }
  route();
  await Promise.all([loadPhotos(), stats().catch(() => {}), loadEvents()]);
  if (location.hash === "#pessoas") changeTab("people");
  if (requestedPhoto) {
    try {
      const data = await api("/api/photos/" + encodeURIComponent(requestedPhoto));
      showPhoto(data.photo);
    } catch (error) {
      toast(error.message);
    }
  }
})();
