const $ = (selector) => document.querySelector(selector);
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
    ? `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
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
const avatar = (person, extra = "") =>
  `<span class="avatar c${seed(person.id) % 4} ${extra}" aria-hidden="true">${esc(initials(person.name))}</span>`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Variações do nome para o texto não ficar repetitivo nem formal demais.
const ZONE = ["Zona 23", "Zon23", "Zona 023", "TRE Marechal Hermes", "23ª ZE"];
const UNTITLED = [
  "Registro da Zon23",
  "Na Zona 023",
  "Momento da Zona 23",
  "TRE Marechal Hermes",
  "Arquivo da 23ª ZE",
];
const pick = (list, key = Math.random() * 1e9) => list[seed(key) % list.length];
const titleOf = (photo) => photo.title || pick(UNTITLED, photo.id);

let photos = [],
  total = 0,
  nextOffset = null,
  selectedPerson = null,
  directoryPeople = [],
  requestNumber = 0,
  order = "newest";
let uploadQueue = [],
  activeIndex = -1,
  selectedPeople = [],
  editingPhoto = null,
  personContext = "directory",
  busy = false,
  currentPhoto = null,
  lastResults = [];
let peopleRequest = 0,
  searchTimer,
  filterTimer,
  directoryTimer,
  toastTimer;
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
function toast(message) {
  clearTimeout(toastTimer);
  const element = $("#toast");
  element.hidden = true;
  element.textContent = message;
  void element.offsetWidth;
  element.hidden = false;
  toastTimer = setTimeout(() => (element.hidden = true), 4200);
}
function empty(title, body, action = "") {
  return `<div class="empty"><svg class="empty-art" aria-hidden="true"><use href="#art-empty"/></svg><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;
}

/* ---------- Números ---------- */
function countUp(element, value) {
  const start = Number(element.textContent) || 0;
  if (reduceMotion.matches || start === value) {
    element.textContent = value;
    return;
  }
  const began = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - began) / 700);
    element.textContent = Math.round(start + (value - start) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
async function stats() {
  const data = await api("/api/stats");
  countUp($("#stat-photos"), data.photos);
  countUp($("#stat-people"), data.people);
  countUp($("#stat-dates"), data.dates);
}

/* ---------- Galeria ---------- */
function hasFilters() {
  return Boolean(
    $("#filter-name").value.trim() ||
      $("#filter-from").value ||
      $("#filter-to").value ||
      selectedPerson,
  );
}
function photoCard(photo, index = 0) {
  const names = photo.people.map((person) => person.name.split(" ")[0]);
  const who = names.length
    ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "")
    : "Ninguém marcado ainda";
  return `<button class="photo-card" data-photo="${photo.id}" aria-label="${esc(titleOf(photo))}, ${esc(dateLabel(photo.date))}"><span class="photo-frame"><img src="${photo.thumbnail}" loading="${index < 6 ? "eager" : "lazy"}" decoding="async" alt="" width="640" height="800"><span class="badge${photo.date ? "" : " undated"}">${esc(badgeLabel(photo.date))}</span>${photo.people.length ? `<span class="people-count">${icon("people")}${photo.people.length}</span>` : ""}</span><span class="card-info"><strong>${esc(titleOf(photo))}</strong><small>${esc(who)}</small></span></button>`;
}
const skeletons = (count) =>
  Array.from(
    { length: count },
    () =>
      '<div class="photo-card skeleton" aria-hidden="true"><span class="photo-frame"></span><span class="bar"></span><span class="bar"></span></div>',
  ).join("");
function summary() {
  const term = selectedPerson?.name || $("#filter-name").value.trim();
  const count = `<strong>${total}</strong> ${total === 1 ? "foto" : "fotos"}`;
  $("#result-summary").innerHTML = term
    ? `${count} com “${esc(term)}”`
    : hasFilters()
      ? `${count} no período`
      : `${count} na ${pick(ZONE.slice(0, 3), total)}`;
}
function renderGallery(append = false, previous = 0) {
  const gallery = $("#gallery");
  if (append)
    gallery.insertAdjacentHTML(
      "beforeend",
      photos
        .slice(previous)
        .map((photo, index) => photoCard(photo, index))
        .join(""),
    );
  else
    gallery.innerHTML = photos.length
      ? photos.map(photoCard).join("")
      : hasFilters()
        ? empty(
            "Ninguém com esse nome por aqui",
            "Tente só o primeiro nome ou mude o período.",
            '<button class="btn btn-outline" id="empty-clear" type="button">Limpar busca</button>',
          )
        : empty(
            "A Zon23 ainda está sem fotos",
            "Tem alguma da Zona 23 no celular? Seja a primeira pessoa a mandar.",
            `<button class="btn btn-primary upload-trigger" type="button">${icon("camera")}Mandar fotos</button>`,
          );
  for (const img of gallery.querySelectorAll(".photo-frame:not(.loaded) img"))
    if (img.complete && img.naturalWidth) img.parentElement.classList.add("loaded");
  summary();
  $("#clear-filters").hidden = !hasFilters();
  $("#load-more").hidden = nextOffset === null;
}
$("#gallery").addEventListener(
  "load",
  (event) => event.target.closest?.(".photo-frame")?.classList.add("loaded"),
  true,
);
$("#gallery").addEventListener(
  "error",
  (event) => event.target.closest?.(".photo-frame")?.classList.add("loaded"),
  true,
);
async function loadPhotos(append = false) {
  const number = ++requestNumber;
  const params = new URLSearchParams({
    name: selectedPerson ? "" : $("#filter-name").value.trim(),
    from: $("#filter-from").value,
    to: $("#filter-to").value,
    order,
  });
  if (selectedPerson) params.set("person", selectedPerson.id);
  if (append) params.set("offset", nextOffset);
  $("#gallery").setAttribute("aria-busy", "true");
  $("#load-more").disabled = true;
  if (!append && !photos.length) $("#gallery").innerHTML = skeletons(8);
  try {
    const data = await api("/api/photos?" + params);
    if (number !== requestNumber) return;
    const previous = photos.length;
    photos = append ? [...photos, ...data.photos] : data.photos;
    total = data.total;
    nextOffset = data.nextOffset;
    renderGallery(append, previous);
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
function clearFilters() {
  $("#search-form").reset();
  selectedPerson = null;
  togglePeriod(false);
  loadPhotos();
}
function togglePeriod(open) {
  $("#period").hidden = !open;
  $("#toggle-period").setAttribute("aria-expanded", String(open));
}
$("#toggle-period").onclick = () => {
  const open = $("#period").hidden;
  togglePeriod(open);
  if (open) $("#filter-from").focus();
};
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
$("#clear-filters").onclick = clearFilters;
for (const button of document.querySelectorAll("[data-order]"))
  button.onclick = () => {
    order = button.dataset.order;
    for (const other of document.querySelectorAll("[data-order]"))
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
  { rootMargin: "600px 0px" },
).observe($("#load-more"));

/* ---------- Abas e pessoas ---------- */
function changeTab(which, focus = false) {
  const people = which === "people";
  for (const [id, active] of [
    ["gallery", !people],
    ["people", people],
  ]) {
    $(`#${id}-tab`).setAttribute("aria-selected", String(active));
    $(`#${id}-tab`).tabIndex = active ? 0 : -1;
    $(`#${id}-panel`).hidden = !active;
  }
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
  $("#filter-name").value = person.name;
  const finish = () => {
    changeTab("gallery");
    loadPhotos();
    $("#collection").scrollIntoView({
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  };
  if ($("#photo-dialog").open) closeDialog("photo-dialog", finish);
  else finish();
}

/* ---------- Dialogs com botão Voltar do celular ---------- */
const stack = [];
function openDialog(id, url = location.href) {
  const dialog = $("#" + id);
  if (dialog.open) return;
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
  if (!id) return;
  if (id === "upload-dialog" && busy) {
    history.pushState({ dialog: id }, "", location.href);
    return;
  }
  stack.pop();
  $("#" + id).close();
  finishClose(id);
});
for (const dialog of document.querySelectorAll("dialog")) {
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
  $(".fab").classList.toggle("hide", heroVisible || stack.length > 0);
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
  selectedPeople = [...item.metadata.people];
  $("#file-preview").src = item.url;
  $("#file-hint").textContent =
    uploadQueue.length > 1
      ? `Foto ${activeIndex + 1} de ${uploadQueue.length}`
      : "";
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
  $("#upload-title").textContent = edit ? "Corrigir dados" : "Mandar fotos";
  $("#dropzone").hidden = Boolean(edit);
  $("#queue").hidden = Boolean(edit);
  $("#upload-extra").hidden = true;
  $("#apply-all").hidden = true;
  if (edit) {
    $("#editor").hidden = false;
    $("#photo-date").value = edit.date;
    $("#photo-title").value = edit.title;
    $("#photo-description").value = edit.description;
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
  toast(
    `Data e pessoas aplicadas nas ${uploadQueue.length} fotos.`,
  );
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
  setTimeout(() => $(context === "upload" && $("#person-name").value ? "#person-reference" : "#person-name").focus(), 50);
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
  for (const control of $("#upload-dialog").querySelectorAll(
    "button,input,textarea",
  ))
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
      toast("Dados corrigidos.");
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
        );
      }
    }
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
function preload(photo) {
  if (photo) new Image().src = photo.view;
}
function showPhoto(photo) {
  if (!photo) return;
  currentPhoto = photo;
  const index = photos.findIndex((item) => item.id === photo.id);
  $("#detail-position").textContent =
    index >= 0 && total > 1 ? `${index + 1} de ${total}` : pick(ZONE, photo.id);
  const image = $("#detail-image");
  if ($("#photo-dialog").open && !reduceMotion.matches) {
    image.classList.add("swap");
    image.onload = () => image.classList.remove("swap");
  }
  image.src = photo.view || photo.src;
  image.alt = photo.title || "Foto do acervo da Zona 23";
  $("#detail-date").textContent = dateLabel(photo.date);
  $("#detail-date").classList.toggle("undated", !photo.date);
  $("#detail-title").textContent = titleOf(photo);
  $("#detail-description").textContent = photo.description;
  $("#detail-people").innerHTML = photo.people.length
    ? photo.people
        .map(
          (person) =>
            `<button class="chip chip-link" type="button" data-detail-person="${person.id}">${esc(person.name)}${person.reference ? ` <small>${esc(person.reference)}</small>` : ""}</button>`,
        )
        .join("")
    : '<p class="hint">Ninguém marcado ainda.</p>';
  $("#detail-author").textContent = photo.author
    ? "Enviada por " + photo.author
    : "";
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
function movePhoto(delta) {
  const index = photos.findIndex((photo) => photo.id === currentPhoto?.id);
  if (photos[index + delta]) showPhoto(photos[index + delta]);
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
    if (navigator.share)
      await navigator.share({ title: titleOf(currentPhoto), url });
    else {
      await navigator.clipboard.writeText(url);
      toast("Link copiado.");
    }
  } catch {
    /* compartilhamento cancelado */
  }
};
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
  else if (button.dataset.photo)
    showPhoto(photos.find((photo) => photo.id === button.dataset.photo));
  else if (button.dataset.directoryPerson)
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
  const url = new URL(location.href);
  const requestedPhoto = url.searchParams.get("photo");
  if (requestedPhoto) {
    url.searchParams.delete("photo");
    history.replaceState(null, "", url);
  }
  await Promise.all([loadPhotos(), stats().catch(() => {})]);
  if (requestedPhoto) {
    try {
      const data = await api("/api/photos/" + encodeURIComponent(requestedPhoto));
      showPhoto(data.photo);
    } catch (error) {
      toast(error.message);
    }
  }
})();
