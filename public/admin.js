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
const MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");
const shortDate = (date) =>
  date ? `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` : "Sem data";
const dayLabel = (date) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const number = (value) => new Intl.NumberFormat("pt-BR").format(value || 0);
const size = (bytes) =>
  bytes > 1e9
    ? (bytes / 1e9).toFixed(1).replace(".", ",") + " GB"
    : bytes > 1e6
      ? Math.round(bytes / 1e6) + " MB"
      : Math.max(0, Math.round(bytes / 1e3)) + " KB";
const seed = (text) =>
  [...String(text)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const initials = (name) =>
  name
    .split(/\s+/)
    .filter((word) => word && !/^(d[aeo]s?|e)$/i.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const avatar = (person) =>
  `<span class="avatar c${seed(person.id) % 4}" aria-hidden="true">${esc(initials(person.name))}</span>`;

let me = null,
  section = "painel",
  days = 30,
  metric = "photos",
  dashboard = null,
  photos = [],
  photoOffset = null,
  events = [],
  people = [],
  editing = null,
  editingPeople = [],
  editingEvent = null,
  editingPerson = null,
  settingsFields = {},
  toastTimer,
  photoRequest = 0;
const selected = new Set();

async function api(path, options = {}) {
  const init = { ...options, headers: { ...(options.headers || {}) } };
  if (init.body && typeof init.body !== "string") {
    init.body = JSON.stringify(init.body);
    init.headers["Content-Type"] = "application/json";
  }
  const response = await fetch(path, init);
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (response.status === 401 && !path.endsWith("/login")) {
    showLogin();
    throw new Error(data.error || "Sessão encerrada.");
  }
  if (!response.ok) throw new Error(data.error || "Não deu certo. Tente de novo.");
  return data;
}
function errorAt(selector, message = "") {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
}
function toast(message, success = true) {
  clearTimeout(toastTimer);
  const element = $("#toast");
  element.hidden = true;
  element.innerHTML =
    (success
      ? '<svg class="toast-check" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="14"/><path d="m8.5 14.5 3.6 3.6 7.4-7.6"/></svg>'
      : "") + `<span>${esc(message)}</span>`;
  void element.offsetWidth;
  element.hidden = false;
  toastTimer = setTimeout(() => (element.hidden = true), 3600);
}
function confirmBox(title, text, ok = "Excluir") {
  $("#cf-title").textContent = title;
  $("#cf-text").textContent = text;
  $("#cf-ok").textContent = ok;
  const dialog = $("#confirm-dialog");
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "yes"), {
      once: true,
    }),
  );
}
for (const dialog of $$("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) dialog.close();
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  });
}

/* ---------- Sessão ---------- */
function showView(id) {
  for (const view of ["login-view", "password-view", "app-view"])
    $("#" + view).hidden = view !== id;
}
function showLogin() {
  showView("login-view");
  setTimeout(() => $("#login-user").focus(), 50);
}
async function boot() {
  try {
    const data = await api("/api/admin/me");
    me = data.user;
    enter();
  } catch {
    showLogin();
  }
}
function enter() {
  if (me.mustChange) {
    showView("password-view");
    setTimeout(() => $("#first-current").focus(), 50);
    return;
  }
  showView("app-view");
  $("#account-user").textContent = `Conectado como ${me.username}.`;
  go(location.hash.slice(1) || "painel");
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#login-error");
  const button = event.submitter;
  button.disabled = true;
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: { username: $("#login-user").value, password: $("#login-pass").value },
    });
    me = data.user;
    $("#login-pass").value = "";
    if (me.mustChange) $("#first-current").value = "";
    enter();
  } catch (error) {
    errorAt("#login-error", error.message);
  } finally {
    button.disabled = false;
  }
});
async function changePassword(current, next, repeat, errorSelector) {
  if (next !== repeat) throw new Error("As duas senhas novas não são iguais.");
  await api("/api/admin/password", { method: "POST", body: { current, next } });
}
$("#first-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#first-error");
  try {
    await changePassword(
      $("#first-current").value,
      $("#first-next").value,
      $("#first-repeat").value,
    );
    me.mustChange = false;
    event.target.reset();
    toast("Senha criada. Bem-vindo à área da equipe.");
    enter();
  } catch (error) {
    errorAt("#first-error", error.message);
  }
});
$("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#pw-error");
  try {
    await changePassword($("#pw-current").value, $("#pw-next").value, $("#pw-repeat").value);
    event.target.reset();
    toast("Senha trocada.");
  } catch (error) {
    errorAt("#pw-error", error.message);
  }
});
for (const button of $$(".logout"))
  button.onclick = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    me = null;
    showLogin();
  };

/* ---------- Navegação ---------- */
function go(name) {
  if (!$("#" + name)?.classList.contains("a-section")) name = "painel";
  section = name;
  for (const item of $$(".a-section")) item.hidden = item.id !== name;
  for (const button of $$("[data-section]"))
    if (button.dataset.section === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  history.replaceState(null, "", "#" + name);
  scrollTo({ top: 0 });
  clearSelection();
  ({
    painel: loadDashboard,
    fotos: loadPhotosSection,
    eventos: loadEvents,
    pessoas: loadPeople,
    textos: loadSettings,
    conta: () => {},
  })[name]();
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-section],[data-go]");
  if (target) go(target.dataset.section || target.dataset.go);
});

/* ---------- Painel ---------- */
const METRICS = {
  photos: { title: "Fotos vistas por dia", unit: ["foto vista", "fotos vistas"] },
  pages: { title: "Visitas ao site por dia", unit: ["visita", "visitas"] },
  downloads: { title: "Downloads por dia", unit: ["download", "downloads"] },
  uploads: { title: "Fotos recebidas por dia", unit: ["foto recebida", "fotos recebidas"] },
};
async function loadDashboard() {
  try {
    dashboard = await api("/api/admin/dashboard?days=" + days);
    renderDashboard();
  } catch (error) {
    $("#kpis").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function renderDashboard() {
  const t = dashboard.totals;
  const kpi = (name, value, label, hero = false) =>
    `<div class="kpi${hero ? " hero" : ""}"><span class="kpi-icon">${icon(name)}</span><strong>${value}</strong><span>${label}</span></div>`;
  $("#kpis").innerHTML = [
    kpi("eye", number(t.photoViews), `fotos vistas em ${days} dias`, true),
    kpi("dashboard", number(t.pages), "visitas ao site"),
    kpi("download", number(t.downloads), "downloads"),
    kpi("upload", number(t.uploads), "fotos recebidas"),
    kpi("photos", number(t.photos), `fotos no acervo${t.hidden ? ` · ${t.hidden} ocultas` : ""}`),
    kpi("people", number(t.people), "pessoas cadastradas"),
    kpi("event", number(t.events), "eventos"),
    kpi("storage", size(t.bytes), "de espaço usado"),
  ].join("");
  renderChart();
  const todo = [
    ["date", t.undated, "sem data", "calendar"],
    ["people", t.untagged, "sem ninguém marcado", "people"],
    ["event", t.noEvent, "sem evento", "event"],
  ].filter((item) => item[1] > 0);
  $("#todo").innerHTML = todo.length
    ? todo
        .map(
          ([key, count, label, name]) =>
            `<button class="todo-item warn" type="button" data-missing="${key}"><strong>${count}</strong><span>${count === 1 ? "foto" : "fotos"} ${label}</span>${icon("right")}</button>`,
        )
        .join("")
    : `<p class="todo-ok">${icon("check")}Tudo organizado por aqui.</p>`;
  $("#top-photos").innerHTML = dashboard.topPhotos.length
    ? dashboard.topPhotos
        .map(
          (item) =>
            `<button class="mini-row" type="button" data-edit="${item.id}"><img src="${item.thumbnail}" alt="" loading="lazy"><span><strong>${esc(item.title || "Sem título")}</strong><small>${shortDate(item.date)}</small></span><span class="num">${number(item.views)}</span></button>`,
        )
        .join("")
    : '<p class="empty-line">Ainda sem visualizações no período.</p>';
  $("#top-people").innerHTML = dashboard.topPeople.length
    ? dashboard.topPeople
        .map(
          (person) =>
            `<div class="mini-row">${avatar(person)}<span><strong>${esc(person.name)}</strong><small>${esc(person.reference || "")}</small></span><span class="num">${person.photos}</span></div>`,
        )
        .join("")
    : '<p class="empty-line">Ninguém marcado ainda.</p>';
  $("#recent").innerHTML = dashboard.recent.length
    ? dashboard.recent
        .map(
          (item) =>
            `<button class="recent-item" type="button" data-edit="${item.id}"><img src="${item.thumbnail}" alt="" loading="lazy"><small>${esc(item.author || "Sem crédito")}</small></button>`,
        )
        .join("")
    : '<p class="empty-line">Nenhuma foto enviada ainda.</p>';
}
// Colunas de uma série só: sem legenda (o título nomeia), dica ao passar o dedo/mouse e tabela.
function renderChart() {
  const series = dashboard.series;
  const info = METRICS[metric];
  const values = series.map((item) => item[metric]);
  const total = values.reduce((a, b) => a + b, 0);
  $("#chart-title").textContent = info.title;
  $("#chart-sub").textContent = `${number(total)} ${total === 1 ? info.unit[0] : info.unit[1]} nos últimos ${days} dias`;
  $("#chart-table").innerHTML = `<table><thead><tr><th>Dia</th><th>${esc(info.unit[1])}</th></tr></thead><tbody>${series
    .slice()
    .reverse()
    .map((item) => `<tr><td>${dayLabel(item.day)}</td><td>${number(item[metric])}</td></tr>`)
    .join("")}</tbody></table>`;
  const chart = $("#chart");
  if (!total) {
    chart.innerHTML = `<div class="chart-empty">Nada registrado nesse período ainda.<br>Os números aparecem conforme o site é usado.</div>`;
    return;
  }
  const width = chart.clientWidth || 600,
    height = chart.clientHeight || 220;
  const pad = { top: 22, right: 4, bottom: 24, left: 30 };
  const plotW = width - pad.left - pad.right,
    plotH = height - pad.top - pad.bottom;
  const max = Math.max(...values);
  const step = Math.max(1, Math.ceil(max / 3 / (max > 10 ? 5 : 1)) * (max > 10 ? 5 : 1));
  const top = step * Math.ceil(max / step) || 1;
  const band = plotW / values.length;
  const barW = Math.min(24, Math.max(2, band - 2));
  const y = (value) => pad.top + plotH - (value / top) * plotH;
  const ticks = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  const peakIndex = values.indexOf(max);
  const labelEvery = values.length > 60 ? 14 : values.length > 20 ? 7 : 1;
  const r = Math.min(4, barW / 2);
  const bar = (value, index) => {
    const x = pad.left + index * band + (band - barW) / 2;
    const h = Math.max(value ? 2 : 0, (value / top) * plotH);
    const yTop = pad.top + plotH - h;
    const rr = Math.min(r, h);
    // Ponta arredondada de 4px, base reta na linha do zero.
    const d = h
      ? `M${x},${pad.top + plotH}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + barW - rr}Q${x + barW},${yTop} ${x + barW},${yTop + rr}V${pad.top + plotH}Z`
      : "";
    return `<rect class="hit" x="${pad.left + index * band}" y="${pad.top}" width="${band}" height="${plotH}" data-i="${index}"></rect>${d ? `<path class="bar" d="${d}" data-i="${index}"></path>` : ""}`;
  };
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(info.title)}: ${number(total)} no período, máximo de ${number(max)} em ${dayLabel(series[peakIndex].day)}">
    <g class="grid">${ticks
      .map(
        (value) =>
          `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(value)}" y2="${y(value)}"></line><text x="${pad.left - 6}" y="${y(value) + 4}" text-anchor="end">${number(value)}</text>`,
      )
      .join("")}</g>
    <g>${values.map(bar).join("")}</g>
    <text class="peak" x="${pad.left + peakIndex * band + band / 2}" y="${y(max) - 6}" text-anchor="middle">${number(max)}</text>
    <g class="x-labels">${series
      .map((item, index) =>
        (values.length - 1 - index) % labelEvery === 0
          ? `<text x="${pad.left + index * band + band / 2}" y="${height - 6}" text-anchor="middle">${dayLabel(item.day)}</text>`
          : "",
      )
      .join("")}</g>
  </svg><div class="chart-tip" hidden></div>`;
  const tip = chart.querySelector(".chart-tip");
  const show = (target) => {
    const index = Number(target.dataset.i);
    for (const item of chart.querySelectorAll(".bar.active")) item.classList.remove("active");
    chart.querySelector(`.bar[data-i="${index}"]`)?.classList.add("active");
    const item = series[index];
    tip.innerHTML = `${dayLabel(item.day)}<strong>${number(item[metric])}</strong>${esc(item[metric] === 1 ? info.unit[0] : info.unit[1])}`;
    tip.hidden = false;
    const x = ((pad.left + index * band + band / 2) / width) * chart.clientWidth;
    tip.style.left = Math.min(chart.clientWidth - 60, Math.max(60, x)) + "px";
  };
  chart.querySelector("svg").addEventListener("pointermove", (event) => {
    const target = event.target.closest("[data-i]");
    if (target) show(target);
  });
  chart.querySelector("svg").addEventListener("pointerleave", () => {
    tip.hidden = true;
    for (const item of chart.querySelectorAll(".bar.active")) item.classList.remove("active");
  });
}
for (const button of $$("[data-days]"))
  button.onclick = () => {
    days = Number(button.dataset.days);
    for (const other of $$("[data-days]"))
      other.setAttribute("aria-pressed", String(other === button));
    loadDashboard();
  };
for (const button of $$("[data-metric]"))
  button.onclick = () => {
    metric = button.dataset.metric;
    for (const other of $$("[data-metric]"))
      other.setAttribute("aria-pressed", String(other === button));
    if (dashboard) renderChart();
  };
let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => section === "painel" && dashboard && renderChart(), 150);
});
$("#todo").addEventListener("click", (event) => {
  const item = event.target.closest("[data-missing]");
  if (!item) return;
  $("#p-missing").value = item.dataset.missing;
  go("fotos");
});

/* ---------- Fotos ---------- */
async function loadEventOptions() {
  const data = await api("/api/admin/events");
  events = data.events;
  const options = events
    .map((item) => `<option value="${item.id}">${esc(item.name)}</option>`)
    .join("");
  const current = $("#p-event").value;
  $("#p-event").innerHTML = '<option value="">Todos os eventos</option>' + options;
  $("#p-event").value = events.some((item) => item.id === current) ? current : "";
  $("#ed-event").innerHTML = '<option value="">Sem evento</option>' + options;
}
async function loadPhotosSection() {
  await loadEventOptions().catch(() => {});
  loadPhotos();
}
async function loadPhotos(append = false) {
  const number = ++photoRequest;
  const params = new URLSearchParams({
    q: $("#p-search").value.trim(),
    status: $("#p-status").value,
    missing: $("#p-missing").value,
    event: $("#p-event").value,
  });
  if (append) params.set("offset", photoOffset);
  try {
    const data = await api("/api/admin/photos?" + params);
    if (number !== photoRequest) return;
    photos = append ? [...photos, ...data.photos] : data.photos;
    photoOffset = data.nextOffset;
    $("#p-summary").textContent = plural(data.total, "foto", "fotos");
    const html = data.photos.map(tile).join("");
    if (append) $("#p-grid").insertAdjacentHTML("beforeend", html);
    else
      $("#p-grid").innerHTML =
        html || '<p class="empty-line">Nenhuma foto com esses filtros.</p>';
    $("#p-more").hidden = photoOffset === null;
  } catch (error) {
    $("#p-grid").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function tile(photo) {
  const flags = [
    photo.hidden ? `<span class="flag dark">${icon("eye-off")}Oculta</span>` : "",
    !photo.date ? '<span class="flag warn">Sem data</span>' : "",
    !photo.people.length ? '<span class="flag warn">Sem pessoas</span>' : "",
  ].join("");
  return `<article class="tile${photo.hidden ? " is-hidden" : ""}" data-id="${photo.id}" aria-selected="${selected.has(photo.id)}"><button class="tile-open" type="button" data-edit="${photo.id}" aria-label="Editar ${esc(photo.title || "foto")}"><span class="tile-img"><img src="${photo.thumbnail}" alt="" loading="lazy" decoding="async"><span class="tile-flags">${flags}</span></span><span class="tile-info"><strong>${esc(photo.title || "Sem título")}</strong><small>${shortDate(photo.date)}${photo.event_name ? " · " + esc(photo.event_name) : ""}</small><small>${icon("eye").replace('class="icon"', 'class="icon" style-free')}${number(photo.views)} · ${plural(photo.people.length, "pessoa", "pessoas")}</small></span></button><button class="tile-check" type="button" data-check="${photo.id}" aria-label="Selecionar">${icon("check")}</button></article>`;
}
let searchTimer;
$("#p-search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadPhotos(), 250);
});
for (const id of ["#p-status", "#p-missing", "#p-event"])
  $(id).addEventListener("change", () => loadPhotos());
$("#p-more").onclick = () => loadPhotos(true);
$("#p-select-all").onclick = () => {
  for (const photo of photos) selected.add(photo.id);
  for (const element of $$(".tile")) element.setAttribute("aria-selected", "true");
  syncBulk();
};

/* Seleção e ações em lote */
function syncBulk() {
  const count = selected.size;
  const bar = $("#bulk-bar");
  bar.dataset.open = String(count > 0);
  bar.inert = !count;
  $("#bulk-count").textContent = count;
}
function clearSelection() {
  selected.clear();
  for (const element of $$(".tile[aria-selected='true']"))
    element.setAttribute("aria-selected", "false");
  syncBulk();
}
$("#bulk-cancel").onclick = clearSelection;
document.addEventListener("click", (event) => {
  const check = event.target.closest("[data-check]");
  if (check) {
    const id = check.dataset.check;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    check.closest(".tile").setAttribute("aria-selected", String(selected.has(id)));
    syncBulk();
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) openPhoto(edit.dataset.edit);
});
async function bulk(action, value) {
  const data = await api("/api/admin/photos/bulk", {
    method: "POST",
    body: { ids: [...selected], action, value },
  });
  toast(`${plural(data.count, "foto atualizada", "fotos atualizadas")}.`);
  clearSelection();
  loadPhotos();
}
let pickAction = null;
function openPick({ title, kicker = "Em lote", body, submit = "Aplicar", onSubmit }) {
  $("#pk-title").textContent = title;
  $("#pk-kicker").textContent = kicker;
  $("#pk-body").innerHTML = body + '<p id="pk-error" class="error" role="alert" hidden></p>';
  $("#pk-submit").textContent = submit;
  pickAction = onSubmit;
  $("#pick-dialog").showModal();
}
$("#pick-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await pickAction();
    $("#pick-dialog").close();
  } catch (error) {
    errorAt("#pk-error", error.message);
  }
});
function personPicker(id) {
  return `<label class="field-icon"><span class="sr-only">Buscar pessoa</span>${icon("search")}<input id="${id}" type="search" placeholder="Buscar nome" autocomplete="off"></label><div class="person-results" id="${id}-results"></div><input type="hidden" id="${id}-value">`;
}
function wirePersonPicker(id, exclude = "") {
  const input = $("#" + id);
  const render = async () => {
    const data = await api("/api/admin/people?q=" + encodeURIComponent(input.value.trim()));
    const chosen = $(`#${id}-value`).value;
    $(`#${id}-results`).innerHTML =
      data.people
        .filter((person) => person.id !== exclude)
        .slice(0, 8)
        .map(
          (person) =>
            `<button type="button" class="person-result" data-pick="${person.id}" aria-pressed="${person.id === chosen}">${avatar(person)}<span>${esc(person.name)}<small>${esc(person.reference || plural(person.photos, "foto", "fotos"))}</small></span>${icon(person.id === chosen ? "check" : "plus")}</button>`,
        )
        .join("") || '<p class="empty-line">Ninguém encontrado.</p>';
  };
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, 180);
  });
  $(`#${id}-results`).addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (!button) return;
    $(`#${id}-value`).value = button.dataset.pick;
    render();
  });
  render();
}
$("#bulk-bar").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-bulk]");
  if (!button || !selected.size) return;
  const action = button.dataset.bulk;
  const count = plural(selected.size, "foto", "fotos");
  try {
    if (action === "hide" || action === "show") await bulk(action);
    else if (action === "delete") {
      if (
        await confirmBox(
          `Excluir ${count}?`,
          "As fotos e os arquivos somem do acervo e não dá para desfazer.",
        )
      )
        await bulk("delete");
    } else if (action === "event") {
      await loadEventOptions();
      openPick({
        title: `Evento de ${count}`,
        body: `<label class="field"><span class="field-label">Evento</span><select id="pk-event"><option value="">Sem evento</option>${events.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}</select></label>`,
        onSubmit: () => bulk("event", $("#pk-event").value),
      });
    } else if (action === "date") {
      openPick({
        title: `Data de ${count}`,
        body: '<label class="field"><span class="field-label">Data <span class="optional">vazio = sem data</span></span><input id="pk-date" type="date" min="1800-01-01"></label>',
        onSubmit: () => bulk("date", $("#pk-date").value),
      });
    } else if (action === "person") {
      openPick({
        title: `Marcar pessoa em ${count}`,
        body: personPicker("pk-person"),
        onSubmit: () => {
          if (!$("#pk-person-value").value) throw new Error("Escolha uma pessoa.");
          return bulk("person", $("#pk-person-value").value);
        },
      });
      wirePersonPicker("pk-person");
    }
  } catch (error) {
    toast(error.message, false);
  }
});

/* Editar uma foto */
async function openPhoto(id) {
  try {
    await loadEventOptions();
    const data = await api("/api/admin/photos?q=&offset=0&status=");
    let photo = photos.find((item) => item.id === id) || data.photos.find((item) => item.id === id);
    if (!photo) {
      // Foto fora da página atual: busca direto pela listagem completa.
      const all = await api("/api/admin/photos?offset=0");
      photo = all.photos.find((item) => item.id === id);
    }
    if (!photo) throw new Error("Foto não encontrada.");
    editing = photo;
    editingPeople = [...photo.people];
    $("#pe-title").textContent = photo.title || "Sem título";
    $("#pe-kicker").textContent = `Enviada em ${shortDate(photo.created_at.slice(0, 10))}`;
    $("#ed-image").src = photo.view;
    $("#ed-open").href = `/?photo=${photo.id}`;
    $("#ed-open").hidden = photo.hidden;
    $("#ed-stats").innerHTML = `<span class="flag">${icon("eye")}${plural(photo.views, "visualização", "visualizações")}</span><span class="flag">${size(photo.bytes)}</span>`;
    $("#ed-visible").checked = !photo.hidden;
    syncVisible();
    $("#ed-title").value = photo.title;
    $("#ed-date").value = photo.date;
    $("#ed-event").value = photo.event_id || "";
    $("#ed-description").value = photo.description;
    $("#ed-author").value = photo.author;
    $("#ed-person-search").value = "";
    renderEditPeople();
    searchEditPeople();
    errorAt("#ed-error");
    $("#photo-edit").showModal();
  } catch (error) {
    toast(error.message, false);
  }
}
function syncVisible() {
  $("#ed-visible-hint").textContent = $("#ed-visible").checked
    ? "Aparece para todo mundo"
    : "Escondida do site, só a equipe vê";
}
$("#ed-visible").addEventListener("change", syncVisible);
function renderEditPeople() {
  $("#ed-people").innerHTML = editingPeople
    .map(
      (person) =>
        `<button type="button" class="chip" data-unpick="${person.id}" aria-label="Tirar ${esc(person.name)}">${esc(person.name)}${person.reference ? ` <small>${esc(person.reference)}</small>` : ""}${icon("close")}</button>`,
    )
    .join("");
}
async function searchEditPeople() {
  const query = $("#ed-person-search").value.trim();
  const data = await api("/api/admin/people?q=" + encodeURIComponent(query));
  $("#ed-person-results").innerHTML = query
    ? data.people
        .slice(0, 6)
        .map((person) => {
          const chosen = editingPeople.some((item) => item.id === person.id);
          return `<button type="button" class="person-result" data-add-person="${person.id}" ${chosen ? "disabled" : ""}>${avatar(person)}<span>${esc(person.name)}${person.reference ? `<small>${esc(person.reference)}</small>` : ""}</span>${icon(chosen ? "check" : "plus")}</button>`;
        })
        .join("") || '<p class="empty-line">Ninguém com esse nome. Cadastre pelo site.</p>'
    : "";
  $("#ed-person-results").people = data.people;
}
let editSearchTimer;
$("#ed-person-search").addEventListener("input", () => {
  clearTimeout(editSearchTimer);
  editSearchTimer = setTimeout(searchEditPeople, 160);
});
$("#photo-edit").addEventListener("click", (event) => {
  const add = event.target.closest("[data-add-person]");
  if (add) {
    const person = $("#ed-person-results").people.find((item) => item.id === add.dataset.addPerson);
    if (person && !editingPeople.some((item) => item.id === person.id)) editingPeople.push(person);
    $("#ed-person-search").value = "";
    renderEditPeople();
    searchEditPeople();
  }
  const remove = event.target.closest("[data-unpick]");
  if (remove) {
    editingPeople = editingPeople.filter((item) => item.id !== remove.dataset.unpick);
    renderEditPeople();
  }
});
$("#photo-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ed-error");
  try {
    await api("/api/admin/photos/" + editing.id, {
      method: "PATCH",
      body: {
        title: $("#ed-title").value,
        date: $("#ed-date").value,
        description: $("#ed-description").value,
        author: $("#ed-author").value,
        event_id: $("#ed-event").value,
        hidden: !$("#ed-visible").checked,
        people: editingPeople.map((person) => person.id),
      },
    });
    $("#photo-edit").close();
    toast("Foto atualizada.");
    if (section === "fotos") loadPhotos();
    else loadDashboard();
  } catch (error) {
    errorAt("#ed-error", error.message);
  }
});
$("#ed-delete").onclick = async () => {
  $("#photo-edit").close();
  if (
    !(await confirmBox(
      "Excluir esta foto?",
      "A foto e os arquivos somem do acervo e não dá para desfazer.",
    ))
  )
    return $("#photo-edit").showModal();
  try {
    await api("/api/admin/photos/" + editing.id, { method: "DELETE" });
    toast("Foto excluída.");
    if (section === "fotos") loadPhotos();
    else loadDashboard();
  } catch (error) {
    toast(error.message, false);
  }
};

/* ---------- Eventos ---------- */
async function loadEvents() {
  try {
    await loadEventOptions();
    $("#event-list").innerHTML = events.length
      ? events
          .map(
            (item) =>
              `<article class="event-card"><span class="event-cover">${item.cover ? `<img src="${item.cover}" alt="" loading="lazy">` : icon("event")}</span><span class="event-body"><strong>${esc(item.name)}</strong><small>${item.date ? shortDate(item.date) + " · " : ""}${plural(item.photos, "foto", "fotos")}</small></span><span class="event-actions"><button class="icon-btn" type="button" data-event-photos="${item.id}" aria-label="Ver fotos de ${esc(item.name)}">${icon("photos")}</button><button class="icon-btn" type="button" data-event-edit="${item.id}" aria-label="Editar ${esc(item.name)}">${icon("edit")}</button></span></article>`,
          )
          .join("")
      : '<p class="empty-line">Nenhum evento ainda. Crie o primeiro, por exemplo “Eleições 2024 · 1º turno”.</p>';
  } catch (error) {
    $("#event-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function openEvent(item = null) {
  editingEvent = item;
  $("#ev-title").textContent = item ? "Editar evento" : "Novo evento";
  $("#ev-name").value = item?.name || "";
  $("#ev-date").value = item?.date || "";
  $("#ev-description").value = item?.description || "";
  $("#ev-delete").hidden = !item;
  errorAt("#ev-error");
  $("#event-dialog").showModal();
  setTimeout(() => $("#ev-name").focus(), 50);
}
$("#event-new").onclick = () => openEvent();
$("#event-list").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-event-edit]");
  if (edit) openEvent(events.find((item) => item.id === edit.dataset.eventEdit));
  const show = event.target.closest("[data-event-photos]");
  if (show) {
    go("fotos");
    $("#p-event").value = show.dataset.eventPhotos;
    loadPhotos();
  }
});
$("#event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ev-error");
  try {
    const body = {
      name: $("#ev-name").value,
      date: $("#ev-date").value,
      description: $("#ev-description").value,
    };
    if (editingEvent)
      await api("/api/admin/events/" + editingEvent.id, { method: "PATCH", body });
    else await api("/api/admin/events", { method: "POST", body });
    $("#event-dialog").close();
    toast(editingEvent ? "Evento atualizado." : "Evento criado.");
    loadEvents();
  } catch (error) {
    errorAt("#ev-error", error.message);
  }
});
$("#ev-delete").onclick = async () => {
  $("#event-dialog").close();
  if (
    !(await confirmBox(
      `Excluir “${editingEvent.name}”?`,
      "As fotos continuam no acervo, só ficam sem evento.",
    ))
  )
    return;
  await api("/api/admin/events/" + editingEvent.id, { method: "DELETE" });
  toast("Evento excluído.");
  loadEvents();
};

/* ---------- Pessoas ---------- */
async function loadPeople() {
  try {
    const data = await api(
      "/api/admin/people?q=" + encodeURIComponent($("#pe-search").value.trim()),
    );
    people = data.people;
    $("#pe-list").innerHTML = people.length
      ? people
          .map(
            (person) =>
              `<div class="pe-row">${avatar(person)}<span><strong>${esc(person.name)}</strong><small>${person.reference ? esc(person.reference) + " · " : ""}${plural(person.photos, "foto", "fotos")}</small></span><span class="row-actions"><button class="icon-btn" type="button" data-person-edit="${person.id}" aria-label="Editar ${esc(person.name)}">${icon("edit")}</button><button class="icon-btn" type="button" data-person-merge="${person.id}" aria-label="Juntar ${esc(person.name)} com outro cadastro">${icon("merge")}</button><button class="icon-btn danger" type="button" data-person-delete="${person.id}" aria-label="Excluir ${esc(person.name)}">${icon("trash")}</button></span></div>`,
          )
          .join("")
      : '<p class="empty-line">Ninguém encontrado.</p>';
  } catch (error) {
    $("#pe-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
let peopleTimer;
$("#pe-search").addEventListener("input", () => {
  clearTimeout(peopleTimer);
  peopleTimer = setTimeout(loadPeople, 200);
});
$("#pe-list").addEventListener("click", async (event) => {
  const find = (attr) => {
    const button = event.target.closest(`[data-${attr}]`);
    return button && people.find((person) => person.id === button.getAttribute(`data-${attr}`));
  };
  const edit = find("person-edit"),
    merge = find("person-merge"),
    remove = find("person-delete");
  if (edit) {
    editingPerson = edit;
    $("#pr-name").value = edit.name;
    $("#pr-reference").value = edit.reference;
    errorAt("#pr-error");
    $("#person-edit").showModal();
  } else if (merge) {
    openPick({
      title: `Juntar ${merge.name}`,
      kicker: "Cadastro repetido",
      body: `<p class="muted">As fotos de <strong>${esc(merge.name)}</strong> passam para a pessoa escolhida, e este cadastro sai da lista.</p>${personPicker("pk-merge")}`,
      submit: "Juntar",
      onSubmit: async () => {
        const to = $("#pk-merge-value").value;
        if (!to) throw new Error("Escolha com quem juntar.");
        await api("/api/admin/people/merge", { method: "POST", body: { from: merge.id, to } });
        toast("Cadastros juntados.");
        loadPeople();
      },
    });
    wirePersonPicker("pk-merge", merge.id);
  } else if (remove) {
    if (
      await confirmBox(
        `Excluir ${remove.name}?`,
        remove.photos
          ? `Ela sai da lista e é desmarcada de ${plural(remove.photos, "foto", "fotos")}. As fotos continuam.`
          : "Ela sai da lista de pessoas.",
      )
    ) {
      await api("/api/admin/people/" + remove.id, { method: "DELETE" });
      toast("Pessoa excluída.");
      loadPeople();
    }
  }
});
$("#person-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#pr-error");
  try {
    await api("/api/admin/people/" + editingPerson.id, {
      method: "PATCH",
      body: { name: $("#pr-name").value, reference: $("#pr-reference").value },
    });
    $("#person-edit").close();
    toast("Nome atualizado.");
    loadPeople();
  } catch (error) {
    errorAt("#pr-error", error.message);
  }
});

/* ---------- Textos ---------- */
async function loadSettings() {
  try {
    const data = await api("/api/admin/settings");
    settingsFields = data.fields;
    $("#settings-fields").innerHTML = Object.entries(data.fields)
      .map(([key, field]) => {
        const value = data.settings[key];
        const long = field.max > 120;
        const input = long
          ? `<textarea id="st-${key}" name="${key}" maxlength="${field.max}" rows="3">${esc(value)}</textarea>`
          : `<input id="st-${key}" name="${key}" maxlength="${field.max}" value="${esc(value)}">`;
        return `<label class="field"><span class="field-label">${esc(field.label)}<span class="counter" data-counter="${key}"></span></span>${input}<button class="reset-field" type="button" data-reset="${key}">Voltar ao padrão</button></label>`;
      })
      .join("");
    preview();
  } catch (error) {
    errorAt("#settings-error", error.message);
  }
}
function preview() {
  const value = (key) => $("#st-" + key)?.value ?? "";
  $("#pv-kicker").textContent = value("hero_kicker");
  $("#pv-title").textContent = value("hero_title");
  $("#pv-highlight").textContent = value("hero_highlight");
  $("#pv-lede").textContent = value("hero_lede");
  $("#pv-names").innerHTML = value("zone_names")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => `<span>${esc(name)}</span>`)
    .join("");
  for (const counter of $$("[data-counter]")) {
    const key = counter.dataset.counter;
    counter.textContent = `${value(key).length}/${settingsFields[key].max}`;
  }
}
$("#settings-form").addEventListener("input", preview);
$("#settings-form").addEventListener("click", (event) => {
  const reset = event.target.closest("[data-reset]");
  if (!reset) return;
  $("#st-" + reset.dataset.reset).value = settingsFields[reset.dataset.reset].default;
  preview();
});
$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#settings-error");
  try {
    const body = Object.fromEntries(
      Object.keys(settingsFields).map((key) => [key, $("#st-" + key).value]),
    );
    await api("/api/admin/settings", { method: "PATCH", body });
    toast("Textos publicados no site.");
  } catch (error) {
    errorAt("#settings-error", error.message);
  }
});

boot();
