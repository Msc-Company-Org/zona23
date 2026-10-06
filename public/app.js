const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const dateLabel = (date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const photoIcon =
  '<svg class="empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="6"/><circle cx="17" cy="17" r="4"/><path d="m7 34 11-11 7 7 6-6 10 10"/></svg>';
let photos = [],
  nextOffset = null,
  selectedPerson = null,
  directoryPeople = [],
  requestNumber = 0;
let uploadQueue = [],
  activeIndex = 0,
  selectedPeople = [],
  editingPhoto = null,
  personContext = "directory",
  busy = false,
  currentPhoto = null;
let peopleRequest = 0,
  searchTimer,
  directoryTimer,
  toastTimer,
  previewUrl;
let editKeys = {};
try {
  editKeys = JSON.parse(localStorage.getItem("tre023-edit-keys") || "{}");
} catch {
  /* O acervo continua acessível sem armazenamento local. */
}
async function api(path, options = {}) {
  const response = await fetch(path, options),
    data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
function errorAt(selector, message = "") {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
}
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4200);
}
function empty(title, body, action = "") {
  return `<div class="empty">${photoIcon}<h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;
}
async function stats() {
  const data = await api("/api/stats");
  $("#stat-photos").textContent = data.photos;
  $("#stat-people").textContent = data.people;
  $("#stat-dates").textContent = data.dates;
}
function hasFilters() {
  return Boolean(
    $("#filter-name").value ||
      $("#filter-from").value ||
      $("#filter-to").value ||
      selectedPerson,
  );
}
function photoCard(photo) {
  const names = photo.people.map((person) => person.name).join(", ");
  return `<button class="photo-card" data-photo="${photo.id}" aria-label="${esc(photo.title || "Fotografia")} · ${esc(dateLabel(photo.date))}"><img src="${photo.thumbnail}" loading="lazy" decoding="async" alt="${esc(photo.title || (names ? "Fotografia com " + names : "Registro do acervo"))}"><span class="card-info"><time datetime="${photo.date}">${esc(dateLabel(photo.date))}</time><strong>${esc(photo.title || "Registro da Zona 23")}</strong><small>${esc(names || "Pessoas ainda não identificadas")}</small></span></button>`;
}
function renderGallery(total) {
  $("#gallery").innerHTML = photos.length
    ? photos.map(photoCard).join("")
    : hasFilters()
      ? empty(
          "Nenhuma foto encontrada",
          "Experimente outro nome ou amplie o período.",
          '<button class="text-link" id="empty-clear">Limpar filtros</button>',
        )
      : empty(
          "Nenhuma foto cadastrada",
          "",
          '<button class="button primary upload-trigger">+ Enviar fotos</button>',
        );
  $("#result-summary").textContent =
    `${total} ${total === 1 ? "fotografia" : "fotografias"}${selectedPerson ? " · " + selectedPerson.name : hasFilters() ? (total === 1 ? " encontrada" : " encontradas") : " no acervo"}`;
  $("#clear-filters").hidden = !hasFilters();
  $("#load-more").hidden = nextOffset === null;
}
async function loadPhotos(append = false) {
  const number = ++requestNumber;
  const params = new URLSearchParams({
    name: $("#filter-name").value.trim(),
    from: $("#filter-from").value,
    to: $("#filter-to").value,
    order: $("#sort").value,
  });
  if (selectedPerson) params.set("person", selectedPerson.id);
  if (append) params.set("offset", nextOffset);
  $("#gallery").setAttribute("aria-busy", "true");
  $("#load-more").disabled = true;
  if (!append) $("#result-summary").textContent = "Buscando fotografias…";
  try {
    const data = await api("/api/photos?" + params);
    if (number !== requestNumber) return;
    photos = append ? [...photos, ...data.photos] : data.photos;
    nextOffset = data.nextOffset;
    renderGallery(data.total);
  } catch (error) {
    if (number !== requestNumber) return;
    $("#gallery").innerHTML = empty(
      "Não foi possível carregar o acervo",
      error.message,
      '<button class="text-link" id="retry-gallery">Tentar novamente</button>',
    );
    $("#result-summary").textContent = "A consulta não foi concluída.";
    $("#load-more").hidden = true;
    $("#clear-filters").hidden = !hasFilters();
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
  loadPhotos();
}
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  selectedPerson = null;
  loadPhotos();
});
$("#filter-name").addEventListener("input", () => {
  selectedPerson = null;
});
$("#clear-filters").onclick = clearFilters;
$("#sort").onchange = () => loadPhotos();
$("#load-more").onclick = () => loadPhotos(true);

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
  if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
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
  }
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
              `<button class="person-card" data-directory-person="${person.id}"><span class="avatar" aria-hidden="true">${esc(initials(person.name))}</span><span><strong>${esc(person.name)}</strong>${person.reference ? `<small>${esc(person.reference)}</small>` : ""}<small>${person.photos} ${person.photos === 1 ? "foto" : "fotos"} · Ver no acervo</small></span></button>`,
          )
          .join("")
      : empty(
          query ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada",
          query ? "Busque outro nome ou cadastre uma pessoa." : "",
        );
  } catch (error) {
    $("#directory").innerHTML = empty(
      "Não foi possível consultar as pessoas",
      error.message,
      '<button class="text-link" id="retry-directory">Tentar novamente</button>',
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
  selectedPerson = person;
  $("#filter-name").value = person.name;
  if ($("#photo-dialog").open) closeDialog("photo-dialog");
  changeTab("gallery");
  loadPhotos();
  $("#collection").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}

function closeDialog(id) {
  if (id === "upload-dialog" && busy) return;
  $("#" + id).close();
  if (id === "photo-dialog") {
    const url = new URL(location.href);
    url.searchParams.delete("photo");
    history.replaceState(null, "", url);
  }
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !busy) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        closeDialog(dialog.id);
    }
  });
}
$("#upload-dialog").addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
function captureMetadata() {
  if (!editingPhoto && uploadQueue[activeIndex])
    uploadQueue[activeIndex].metadata = {
      date: $("#photo-date").value,
      title: $("#photo-title").value,
      description: $("#photo-description").value,
      people: [...selectedPeople],
    };
}
function renderChips() {
  $("#selected-people").innerHTML = selectedPeople
    .map(
      (person) =>
        `<button type="button" class="chip" data-remove-person="${person.id}" aria-label="Remover ${esc(person.name)} desta foto">${esc(person.name)}${person.reference ? " · " + esc(person.reference) : ""}<span aria-hidden="true">×</span></button>`,
    )
    .join("");
  $("#no-people-hint").hidden = Boolean(selectedPeople.length);
}
function renderFileList() {
  $("#file-list").innerHTML = uploadQueue
    .map(
      (item, index) =>
        `<div class="file-row"><button type="button" data-file="${index}" class="${index === activeIndex ? "active" : ""}" aria-current="${index === activeIndex ? "true" : "false"}">${index + 1}. ${esc(item.file.name)}</button><button type="button" data-remove-file="${index}" aria-label="Remover ${esc(item.file.name)} do envio">×</button></div>`,
    )
    .join("");
}
function selectFile(index) {
  captureMetadata();
  activeIndex = index;
  const item = uploadQueue[index];
  if (!item) {
    $("#file-preview").hidden = true;
    $("#file-hint").textContent =
      "Selecione uma foto para preencher as informações.";
    selectedPeople = [];
    $("#photo-date").value = "";
    $("#photo-title").value = "";
    $("#photo-description").value = "";
    renderChips();
    renderFileList();
    return;
  }
  $("#photo-date").value = item.metadata.date;
  $("#photo-title").value = item.metadata.title;
  $("#photo-description").value = item.metadata.description;
  selectedPeople = [...item.metadata.people];
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(item.file);
  $("#file-preview").src = previewUrl;
  $("#file-preview").hidden = false;
  $("#file-hint").textContent =
    `Foto ${index + 1} de ${uploadQueue.length} · Informe a data e as pessoas desta foto.`;
  $("#person-search").value = "";
  renderChips();
  renderFileList();
  searchPeople();
}
function prepareDialog(edit = null) {
  errorAt("#upload-error");
  editingPhoto = edit;
  $("#upload-form").reset();
  $("#upload-progress").hidden = true;
  $("#upload-title").textContent = edit
    ? "Editar informações da foto"
    : "Enviar fotos";
  $("#submit-upload").textContent = edit
    ? "Salvar alterações"
    : "Publicar no acervo";
  $("#dropzone").hidden = Boolean(edit);
  $("#file-list").hidden = Boolean(edit);
  $(".upload-bottom>label:first-child").hidden = Boolean(edit);
  $(".check").hidden = Boolean(edit);
  $("#public-confirm").required = !edit;
  if (edit) {
    $("#photo-date").value = edit.date;
    $("#photo-title").value = edit.title;
    $("#photo-description").value = edit.description;
    selectedPeople = [...edit.people];
    $("#file-preview").src = edit.src;
    $("#file-preview").hidden = false;
    $("#file-hint").textContent =
      "Corrija a data, o título ou as pessoas identificadas.";
    renderChips();
    searchPeople();
  } else {
    try {
      $("#author").value = localStorage.getItem("tre023-author") || "";
    } catch {}
    activeIndex = -1;
    selectFile(0);
  }
  $("#upload-dialog").showModal();
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
      metadata: { date: "", title: "", description: "", people: [] },
    });
  errorAt(
    "#upload-error",
    accepted.length !== fileList.length
      ? "Alguns arquivos não foram incluídos. Use JPG, PNG ou WebP de até 25 MB."
      : accepted.length > room
        ? "Envie até 20 fotos por vez. Os demais arquivos podem ir em outro envio."
        : "",
  );
  if (uploadQueue.length) selectFile(Math.min(first, uploadQueue.length - 1));
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
async function searchPeople() {
  const number = ++peopleRequest;
  try {
    const data = await api(
      "/api/people?q=" + encodeURIComponent($("#person-search").value.trim()),
    );
    if (number !== peopleRequest) return;
    $("#person-results").innerHTML =
      data.people
        .slice(0, 6)
        .map(
          (person) =>
            `<button type="button" class="person-result" data-select-person="${person.id}" ${selectedPeople.some((item) => item.id === person.id) ? "disabled" : ""}>${esc(person.name)}${person.reference ? `<small>${esc(person.reference)}</small>` : ""}${selectedPeople.some((item) => item.id === person.id) ? "<small>Selecionada</small>" : ""}</button>`,
        )
        .join("") ||
      '<p class="hint">Nenhuma pessoa encontrada. Você pode cadastrar o nome abaixo.</p>';
    $("#person-results").people = data.people;
  } catch (error) {
    $("#person-results").innerHTML =
      `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#person-search").oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchPeople, 150);
};
function addPerson(context) {
  personContext = context;
  $("#person-form").reset();
  if (context === "upload") $("#person-name").value = $("#person-search").value;
  errorAt("#person-error");
  $("#person-dialog").showModal();
}
$("#directory-add").onclick = () => addPerson("directory");
$("#add-person").onclick = () => addPerson("upload");
$("#person-form").addEventListener("submit", async (event) => {
  event.preventDefault();
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
    if (
      personContext === "upload" &&
      !selectedPeople.some((person) => person.id === data.person.id)
    ) {
      selectedPeople.push(data.person);
      captureMetadata();
      renderChips();
      $("#person-search").value = "";
      searchPeople();
    }
    closeDialog("person-dialog");
    toast(
      data.reused
        ? "Pessoa já cadastrada. Nome reutilizado."
        : "Pessoa cadastrada. Você pode reutilizar este nome.",
    );
    await Promise.all([
      stats(),
      $("#people-panel").hidden ? Promise.resolve() : loadDirectory(),
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
  if (!value)
    for (const button of $("#person-results").querySelectorAll(
      "[data-select-person]",
    ))
      button.disabled = selectedPeople.some(
        (person) => person.id === button.dataset.selectPerson,
      );
}
function rememberKey(id, key) {
  editKeys[id] = key;
  try {
    localStorage.setItem("tre023-edit-keys", JSON.stringify(editKeys));
  } catch {
    toast(
      "Foto publicada. A edição ficará disponível enquanto esta página estiver aberta.",
    );
  }
}
$("#upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#upload-error");
  if (!editingPhoto && !uploadQueue.length) {
    errorAt("#upload-error", "Selecione ao menos uma foto.");
    return;
  }
  if (!editingPhoto) {
    captureMetadata();
    const missing = uploadQueue.findIndex((item) => !item.metadata.date);
    if (missing >= 0) {
      selectFile(missing);
      errorAt("#upload-error", `Informe a data da foto ${missing + 1}.`);
      $("#photo-date").focus();
      return;
    }
  }
  setBusy(true);
  $("#upload-progress").hidden = false;
  try {
    if (editingPhoto) {
      $("#upload-progress").textContent = "Salvando informações…";
      await api("/api/photos/" + editingPhoto.id, {
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
      closeDialog("upload-dialog");
      editingPhoto = null;
      toast("Informações atualizadas.");
    } else {
      const total = uploadQueue.length,
        failed = [];
      let successes = 0,
        failure = "";
      const author = $("#author").value;
      try {
        localStorage.setItem("tre023-author", author);
      } catch {}
      for (const [index, item] of uploadQueue.entries()) {
        $("#upload-progress").textContent =
          `Publicando foto ${index + 1} de ${total}…`;
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
          const data = await api("/api/photos", { method: "POST", body: form });
          rememberKey(data.photo.id, data.editKey);
          successes++;
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
        errorAt(
          "#upload-error",
          `${successes} de ${total} fotos publicadas. ${failure} As fotos pendentes continuam neste formulário.`,
        );
        $("#upload-progress").textContent =
          "Você pode corrigir e tentar novamente.";
      } else {
        closeDialog("upload-dialog");
        toast(
          `${successes === 1 ? "Foto publicada" : successes + " fotos publicadas"} no acervo.`,
        );
      }
    }
    await Promise.all([loadPhotos(), stats()]);
  } catch (error) {
    errorAt("#upload-error", error.message);
  } finally {
    setBusy(false);
  }
});

function showPhoto(photo) {
  currentPhoto = photo;
  const index = photos.findIndex((item) => item.id === photo.id);
  $("#detail-position").textContent =
    index >= 0
      ? `Fotografia ${index + 1} de ${photos.length}`
      : "Fotografia do acervo";
  $("#detail-image").src = photo.src;
  $("#detail-image").alt = photo.title || "Fotografia do acervo da Zona 23";
  $("#detail-date").textContent = dateLabel(photo.date);
  $("#detail-title").textContent = photo.title || "Registro da Zona 23";
  $("#detail-description").textContent = photo.description;
  $("#detail-people").innerHTML = photo.people.length
    ? photo.people
        .map(
          (person) =>
            `<button class="chip" data-detail-person="${person.id}">${esc(person.name)}${person.reference ? " · " + esc(person.reference) : ""}</button>`,
        )
        .join("")
    : '<p class="hint">Pessoas ainda não identificadas.</p>';
  $("#detail-author").textContent = photo.author
    ? "Compartilhada por " + photo.author
    : "Compartilhada com o acervo";
  $("#detail-download").href = photo.src;
  $("#detail-download").download =
    `zona-23-${photo.date}-${photo.id.slice(0, 8)}.${photo.src.split(".").pop()}`;
  $("#detail-edit").hidden = !editKeys[photo.id];
  $("#edit-hint").hidden = !editKeys[photo.id];
  $("#previous-photo").disabled = index <= 0;
  $("#next-photo").disabled = index < 0 || index >= photos.length - 1;
  const url = new URL(location.href);
  url.searchParams.set("photo", photo.id);
  history.replaceState(null, "", url);
  if (!$("#photo-dialog").open) $("#photo-dialog").showModal();
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
$("#photo-dialog").addEventListener("cancel", () => {
  const url = new URL(location.href);
  url.searchParams.delete("photo");
  history.replaceState(null, "", url);
});
$("#detail-edit").onclick = () => {
  const photo = currentPhoto;
  closeDialog("photo-dialog");
  prepareDialog(photo);
};
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.close) closeDialog(button.dataset.close);
  else if (button.classList.contains("upload-trigger")) prepareDialog();
  else if (button.dataset.photo)
    showPhoto(photos.find((photo) => photo.id === button.dataset.photo));
  else if (button.dataset.directoryPerson)
    filterPerson(
      directoryPeople.find(
        (person) => person.id === button.dataset.directoryPerson,
      ),
    );
  else if (button.dataset.detailPerson)
    filterPerson(
      currentPhoto.people.find(
        (person) => person.id === button.dataset.detailPerson,
      ),
    );
  else if (button.dataset.selectPerson) {
    const person = $("#person-results").people.find(
      (person) => person.id === button.dataset.selectPerson,
    );
    if (person && !selectedPeople.some((item) => item.id === person.id))
      selectedPeople.push(person);
    captureMetadata();
    renderChips();
    searchPeople();
  } else if (button.dataset.removePerson) {
    selectedPeople = selectedPeople.filter(
      (person) => person.id !== button.dataset.removePerson,
    );
    captureMetadata();
    renderChips();
    searchPeople();
  } else if (button.dataset.file !== undefined)
    selectFile(Number(button.dataset.file));
  else if (button.dataset.removeFile !== undefined) {
    captureMetadata();
    uploadQueue.splice(Number(button.dataset.removeFile), 1);
    activeIndex = -1;
    selectFile(0);
  } else if (button.id === "empty-clear") clearFilters();
  else if (button.id === "retry-gallery") loadPhotos();
  else if (button.id === "retry-directory") loadDirectory();
});
(async () => {
  const requestedPhoto = new URL(location.href).searchParams.get("photo");
  await Promise.all([
    loadPhotos(),
    stats().catch(() => {
      $("#stat-photos").textContent = "—";
      $("#stat-people").textContent = "—";
      $("#stat-dates").textContent = "—";
    }),
  ]);
  if (requestedPhoto) {
    try {
      const data = await api(
        "/api/photos/" + encodeURIComponent(requestedPhoto),
      );
      showPhoto(data.photo);
    } catch (error) {
      toast(error.message);
    }
  }
})();
