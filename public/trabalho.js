/* Trabalho do cartório: Tarefas (delegação, apoio, checklist, conversa) e Escala ASE.
   Usa os utilitários de admin.js e equipe.js ($, esc, icon, api, toast, confirmBox, errorAt, me, section…). */

const fmtData = (data) => (data ? data.split("-").reverse().join("/") : "");
const diaMes = (data) => `${Number(data.slice(8, 10))} ${MONTHS[Number(data.slice(5, 7)) - 1]}`;
const SEMANA_LONGA = { DOMINGO: "Domingo", SEGUNDA: "Segunda-feira", "TERÇA": "Terça-feira", QUARTA: "Quarta-feira", QUINTA: "Quinta-feira", SEXTA: "Sexta-feira", "SÁBADO": "Sábado" };
const hojeLocal = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const nomeCurto = (nome = "") => {
  const partes = nome.replace(/^(dra?|sra?)\.?\s+/i, "").split(" ").filter(Boolean);
  return partes.length > 1 ? `${partes[0]} ${partes.at(-1)}` : partes[0] || "";
};
const barra = (valor, total, classe = "") =>
  `<svg class="mini-bar ${classe}" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="bg" width="100" height="8" rx="4"/><rect class="fg" width="${Math.max(0, Math.min(100, total ? (valor / total) * 100 : 0)).toFixed(1)}" height="8" rx="4"/></svg>`;
const whatsappLink = (phone, texto) => `https://wa.me/${whatsappNumber(phone || "")}?text=${encodeURIComponent(texto)}`;

/* ---------- Tarefas ---------- */
let tk = null,
  tkVisao = "minhas",
  tkLayout = "lista",
  tkAberta = null,
  tkEditando = null,
  tkModelo = "",
  tkDocs = null;
const TK_STATUS_CHIP = { a_fazer: "chip-yellow", em_andamento: "chip-blue", aguardando: "chip-gray", concluida: "chip-green", cancelada: "chip-gray" };
const TK_ICON = {
  sei: "doc",
  pje: "gavel",
  filia: "badge",
  elo: "ballot",
  conseg: "school",
  ti: "key",
  edital: "calendar",
  justificativas: "check-circle",
  credenciamento: "users",
  frequencia: "attendance",
  oficio: "certificate",
  outro: "tasks",
};
const TK_COLUNAS = ["a_fazer", "em_andamento", "aguardando"];

function prazoLabel(t) {
  if (!t.prazo) return "Sem prazo";
  if (["concluida", "cancelada"].includes(t.status)) return `Prazo ${diaMes(t.prazo)}`;
  const dias = daysBetween(tk?.hoje || hojeLocal(), t.prazo);
  if (dias < 0) return `Atrasada · era ${diaMes(t.prazo)}`;
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Até ${diaMes(t.prazo)}`;
}
const avatarMini = (p, extra = "") => (p ? userAvatar(p, " avatar-sm" + extra).replace("<span ", `<span title="${esc(p.name)}" `) : "");

async function loadTarefas() {
  try {
    tk = await api(`/api/tarefas?visao=${tkVisao}`);
    for (const [key, n] of Object.entries(tk.contagem)) {
      const badge = $(`#tk-c-${key}`);
      if (badge) badge.textContent = n;
    }
    renderTarefas();
  } catch (error) {
    $("#tk-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => section === "tarefas" && !$("#tk-view").open && !$("#tk-dialog").open && !$("#tk-lote-dialog").open && loadTarefas(), 60000);
}
function tkCard(t) {
  const quem = t.responsavel ? firstName(t.responsavel) + (t.apoio.length ? ` + ${t.apoio.length}` : "") : "Sem responsável";
  return `<button type="button" class="tk-card prio-${t.prioridade} st-${t.status}${t.atrasada ? " late" : ""}" data-tarefa="${t.id}">
    <span class="dm-main">
      <strong>${esc(t.titulo)}${t.prioridade !== "normal" ? ` <span class="chip chip-tag chip-red">${t.prioridade === "urgente" ? "Urgente" : "Alta"}</span>` : ""}</strong>
      <small class="tk-meta">${t.prazo ? `<span class="tk-prazo${t.atrasada ? " late" : ""}">${esc(prazoLabel(t))}</span> · ` : ""}${esc(quem)}${t.itens.total ? ` · ${t.itens.feitos}/${t.itens.total} passos` : ""}${t.status === "aguardando" && t.aguardando ? ` · aguardando ${esc(t.aguardando)}` : ""}</small>
    </span>
    <span class="chip chip-tag ${TK_STATUS_CHIP[t.status]}">${esc(t.statusNome)}</span>
  </button>`;
}
function renderTarefas() {
  const q = normalizeText($("#tk-busca").value);
  const lista = tk.tarefas.filter(
    (t) => !q || normalizeText(`${t.titulo} ${t.referencia} ${t.tipoNome} ${t.responsavel?.name || ""} ${t.apoio.map((p) => p.name).join(" ")} #${t.numero}`).includes(q),
  );
  const vazio = {
    minhas: ["Nada com você agora", "As tarefas que passarem para você aparecem aqui."],
    comigo: ["Nada com você agora", ""],
    apoio: ["Você não está apoiando nenhuma tarefa", "Quem te marcar com @ num comentário te chama para ajudar."],
    equipe: ["Nenhuma tarefa em aberto", "Use “Nova tarefa” para passar um trabalho a alguém."],
    atrasadas: ["Nada atrasado", "Tudo dentro do prazo."],
    concluidas: ["Nenhuma tarefa concluída ainda", ""],
  }[tkVisao];
  const quadro = tkLayout === "quadro" && tkVisao !== "concluidas";
  $("#tk-list").className = quadro ? "tk-board" : "tk-list";
  if (!lista.length) {
    $("#tk-list").className = "tk-list";
    $("#tk-list").innerHTML = `<div class="empty-state">${icon("tasks")}<strong>${q ? "Nada com essa busca" : vazio[0]}</strong><p>${q ? "Tente outro termo." : vazio[1]}</p></div>`;
    return;
  }
  $("#tk-list").innerHTML = quadro
    ? TK_COLUNAS.map((status) => {
        const itens = lista.filter((t) => t.status === status);
        return `<section class="tk-col st-${status}"><h3>${esc(tk.status[status])}<b>${itens.length}</b></h3>${itens.map(tkCard).join("") || `<p class="tk-col-empty">—</p>`}</section>`;
      }).join("")
    : lista.map(tkCard).join("");
}
for (const button of $$("[data-tk-visao]"))
  button.addEventListener("click", () => {
    tkVisao = button.dataset.tkVisao;
    for (const other of $$("[data-tk-visao]")) other.setAttribute("aria-pressed", String(other === button));
    loadTarefas();
  });
for (const button of $$("[data-tk-layout]"))
  button.addEventListener("click", () => {
    tkLayout = button.dataset.tkLayout;
    for (const other of $$("[data-tk-layout]")) other.setAttribute("aria-pressed", String(other === button));
    try {
      localStorage.setItem("z23-tk-layout", tkLayout);
    } catch {}
    tk && renderTarefas();
  });
try {
  const salvo = localStorage.getItem("z23-tk-layout");
  if (salvo === "quadro") $('[data-tk-layout="quadro"]').click();
} catch {}
$("#tk-busca").addEventListener("input", () => tk && renderTarefas());
$("#tk-list").addEventListener("click", (event) => {
  const card = event.target.closest("[data-tarefa]");
  if (card) openTarefa(card.dataset.tarefa);
});

/* Nova tarefa e edição */
function pessoasChips(container, selecionadas, excluir = "") {
  container.innerHTML = tk.pessoas
    .filter((p) => p.id !== excluir)
    .map((p) => `<button type="button" class="chip tk-pick" data-pessoa="${p.id}" aria-pressed="${selecionadas.includes(p.id)}">${userAvatar(p, " avatar-sm")}<span>${esc(firstName(p))}</span></button>`)
    .join("");
}
const escolhidas = (container) => $$("[data-pessoa][aria-pressed=true]", container).map((b) => b.dataset.pessoa);
document.addEventListener("click", (event) => {
  const pick = event.target.closest(".tk-pick");
  if (pick) pick.setAttribute("aria-pressed", String(pick.getAttribute("aria-pressed") !== "true"));
});
async function openTarefaForm(t = null) {
  if (!tk) tk = await api("/api/tarefas?visao=comigo");
  tkEditando = t;
  tkModelo = "";
  $("#tk-title").textContent = t ? `Editar #${t.numero}` : "Nova tarefa";
  $("#tk-submit").textContent = t ? "Salvar" : "Criar tarefa";
  $("#tk-tipo").innerHTML = Object.entries(tk.tipos).map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("");
  $("#tk-responsavel").innerHTML = tk.pessoas.map((p) => `<option value="${p.id}">${esc(p.name)}${p.id === me.id ? " (você)" : ""}</option>`).join("");
  $("#tk-modelos").innerHTML = Object.entries(tk.modelos)
    .map(([key, m]) => `<button type="button" class="chip" data-modelo="${key}" aria-pressed="false">${icon(TK_ICON[m.tipo] || "tasks")}${esc(m.nome)}</button>`)
    .join("");
  $("#tk-modelos-field").hidden = Boolean(t);
  $("#tk-itens-field").hidden = Boolean(t);
  $("#tk-titulo").value = t?.titulo || "";
  $("#tk-tipo").value = t?.tipo || "outro";
  $("#tk-referencia").value = t?.referencia || "";
  $("#tk-responsavel").value = t?.responsavel?.id || me.id;
  $("#tk-prazo").value = t?.prazo || "";
  $("#tk-prioridade").value = t?.prioridade || "normal";
  $("#tk-descricao").value = t?.descricao || "";
  $("#tk-itens").value = "";
  pessoasChips($("#tk-apoio"), t ? t.apoio.map((p) => p.id) : [], $("#tk-responsavel").value);
  errorAt("#tk-error");
  $("#tk-dialog").showModal();
  if (!t) setTimeout(() => $("#tk-titulo").focus(), 50);
}
$("#tk-new").addEventListener("click", () => openTarefaForm());
$("#tk-responsavel").addEventListener("change", () => pessoasChips($("#tk-apoio"), escolhidas($("#tk-apoio")), $("#tk-responsavel").value));
$("#tk-modelos").addEventListener("click", (event) => {
  const button = event.target.closest("[data-modelo]");
  if (!button) return;
  const m = tk.modelos[button.dataset.modelo];
  const ativo = button.getAttribute("aria-pressed") !== "true";
  for (const other of $$("[data-modelo]", $("#tk-modelos"))) other.setAttribute("aria-pressed", String(other === button && ativo));
  tkModelo = ativo ? button.dataset.modelo : "";
  if (!ativo) return;
  $("#tk-titulo").value = m.nome;
  $("#tk-tipo").value = m.tipo;
  $("#tk-itens").value = m.itens.join("\n");
});
$("#tk-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#tk-error");
  const body = {
    titulo: $("#tk-titulo").value,
    tipo: $("#tk-tipo").value,
    referencia: $("#tk-referencia").value,
    responsavel: $("#tk-responsavel").value,
    prazo: $("#tk-prazo").value,
    prioridade: $("#tk-prioridade").value,
    descricao: $("#tk-descricao").value,
    apoio: escolhidas($("#tk-apoio")),
  };
  try {
    if (tkEditando) {
      const { tarefa } = await api(`/api/tarefas/${tkEditando.id}`, { method: "PATCH", body });
      $("#tk-dialog").close();
      toast("Tarefa atualizada.");
      renderTarefaView(tarefa);
    } else {
      const itens = $("#tk-itens").value.split("\n").map((linha) => linha.trim()).filter(Boolean);
      const { tarefa } = await api("/api/tarefas", { method: "POST", body: { ...body, itens, modelo: tkModelo } });
      $("#tk-dialog").close();
      toast(tarefa.responsavel?.id === me.id ? "Tarefa criada." : `Tarefa passada para ${firstName(tarefa.responsavel)}.`);
      if (tarefa.responsavel?.id !== me.id && tarefa.responsavel?.phone) {
        renderTarefaView(tarefa);
        $("#tk-view").showModal();
      }
    }
    if (section === "tarefas") loadTarefas();
  } catch (error) {
    errorAt("#tk-error", error.message);
  }
});

/* Tarefa aberta: situação, checklist, documentos e conversa */
const TV_EVENTO_ICON = { criada: "plus", status: "swap", responsavel: "user", apoio: "users", prazo: "clock", prioridade: "flag", item: "check-circle", edicao: "edit", documento: "doc" };
async function openTarefa(id) {
  try {
    const { tarefa } = await api(`/api/tarefas/${id}`);
    renderTarefaView(tarefa);
    if (!$("#tk-view").open) $("#tk-view").showModal();
  } catch (error) {
    toast(error.message, false);
  }
}
function mensagemTarefa(t) {
  return [
    `*Tarefa #${t.numero} · Zona 023*`,
    t.titulo,
    [t.tipoNome, t.referencia].filter(Boolean).join(" · "),
    t.prazo ? `Prazo: ${fmtData(t.prazo)}` : "",
    t.lista?.length ? `Checklist: ${t.lista.map((i) => i.texto).join("; ")}` : "",
    `Abrir: ${location.origin}/#tarefas`,
  ]
    .filter(Boolean)
    .join("\n");
}
function renderTarefaView(t) {
  tkAberta = t;
  $("#tv-kicker").textContent = `#${t.numero} · ${t.tipoNome}`;
  $("#tv-title").textContent = t.titulo;
  const pessoaLinha = (p, papel) => `<span class="tv-person">${userAvatar(p, " avatar-sm")}<span><strong>${esc(p.name)}</strong><small>${papel}</small></span></span>`;
  const feitos = t.lista.filter((i) => i.feito).length;
  const nomes = (tk?.pessoas || []).map((p) => p.username);
  $("#tv-body").innerHTML = `
    <div class="tv-meta">
      ${t.referencia ? `<span class="chip chip-tag chip-blue">${icon("doc")}${esc(t.referencia)}</span>` : ""}
      <span class="chip chip-tag${t.atrasada ? " chip-red" : ""}">${icon("clock")}${esc(prazoLabel(t))}</span>
      ${t.prioridade !== "normal" ? `<span class="chip chip-tag chip-red">${icon("flag")}${t.prioridade === "urgente" ? "Urgente" : "Alta"}</span>` : ""}
      ${t.criadaPor ? `<span class="chip chip-tag">Criada por ${esc(firstName(t.criadaPor))} · ${new Date(t.criadaEm).toLocaleDateString("pt-BR")}</span>` : ""}
    </div>
    <div class="tv-people">${t.responsavel ? pessoaLinha(t.responsavel, "Responsável") : ""}${t.apoio.map((p) => pessoaLinha(p, "Apoio")).join("")}</div>
    ${t.descricao ? `<p class="tv-desc">${esc(t.descricao)}</p>` : ""}
    <div class="tv-block">
      <h3>Situação</h3>
      <div class="segmented tv-status" role="group" aria-label="Situação">${["a_fazer", "em_andamento", "aguardando", "concluida"]
        .map((s) => `<button type="button" data-tv-status="${s}" aria-pressed="${t.status === s}">${esc({ a_fazer: "A fazer", em_andamento: "Fazendo", aguardando: "Aguardando", concluida: "Concluída" }[s])}</button>`)
        .join("")}</div>
      <div class="tv-wait" id="tv-wait" ${t.status === "aguardando" ? "" : "hidden"}>
        <input id="tv-aguardando" maxlength="160" placeholder="Aguardando quem? Ex.: Central de Mandados" value="${esc(t.aguardando)}" />
        <button type="button" class="btn btn-outline btn-sm" id="tv-aguardando-ok">Salvar</button>
      </div>
      ${t.status === "cancelada" ? `<p class="muted small">Cancelada. Escolha uma situação para reabrir.</p>` : ""}
    </div>
    <div class="tv-block">
      <h3>Checklist ${t.lista.length ? `<small>${feitos}/${t.lista.length}</small>` : ""}</h3>
      ${t.lista.length ? barra(feitos, t.lista.length, "tv-progress") : ""}
      <ul class="tv-itens">${t.lista
        .map(
          (i) => `<li class="${i.feito ? "done" : ""}"><label class="check-line"><input type="checkbox" data-item="${i.id}" ${i.feito ? "checked" : ""} /><span>${esc(i.texto)}${i.feito && i.feitoPor ? `<small>${esc(firstName({ name: i.feitoPor }))} · ${new Date(i.feitoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small>` : ""}</span></label><button type="button" class="icon-btn" data-del-item="${i.id}" aria-label="Retirar passo">${icon("close")}</button></li>`,
        )
        .join("")}</ul>
      <div class="tv-add"><input id="tv-novo-item" maxlength="200" placeholder="Novo passo" /><button type="button" class="btn btn-outline btn-sm" id="tv-add-item">${icon("plus")}Incluir</button></div>
    </div>
    <div class="tv-block">
      <h3>Documentos</h3>
      <ul class="tv-docs">${t.documentos
        .map((d) => `<li><a class="row-link" href="/api/documentos/${d.id}/arquivo${d.extensao === "pdf" ? "?ver=1" : ""}" target="_blank" rel="noopener">${icon("doc")}<span>${esc(d.titulo)}</span><small>${esc(d.extensao.toUpperCase())}</small></a></li>`)
        .join("")}</ul>
      <div class="tv-add"><select id="tv-doc" aria-label="Vincular documento"><option value="">Vincular um documento da biblioteca…</option></select></div>
    </div>
    <div class="tv-block">
      <h3>Conversa e histórico</h3>
      <ol class="tv-feed">${t.eventos
        .map((e) =>
          e.tipo === "comentario"
            ? `<li class="tv-comment${e.autor?.id === me.id ? " mine" : ""}">${e.autor ? userAvatar(e.autor, " avatar-sm") : ""}<div><span class="tv-who">${esc(e.autor ? firstName(e.autor) : "—")} · ${sinceLabel(e.quando)}</span><p>${esc(e.texto).replace(/@([a-z0-9._-]{2,32})/gi, (m, u) => (nomes.includes(u.toLowerCase()) ? `<b class="mention">@${u}</b>` : m))}</p></div></li>`
            : `<li class="tv-event">${icon(TV_EVENTO_ICON[e.tipo] || "clock")}<span>${esc(e.autor ? firstName(e.autor) : "Sistema")} · ${esc(e.tipo === "criada" ? "criou a tarefa" : e.texto)}${e.tipo === "criada" && e.texto ? ` (${esc(e.texto)})` : ""}</span><small>${sinceLabel(e.quando)}</small></li>`,
        )
        .join("")}</ol>
      <form class="tv-comentar" id="tv-comentar">
        <textarea id="tv-comentario" rows="2" maxlength="2000" placeholder="Comente ou chame alguém com @usuário"></textarea>
        <button class="btn btn-navy btn-sm" type="submit">${icon("chat-send")}Enviar</button>
      </form>
      <div class="tv-mentions">${(tk?.pessoas || [])
        .filter((p) => p.id !== me.id)
        .map((p) => `<button type="button" class="chip" data-mention="${esc(p.username)}">@${esc(p.username)}</button>`)
        .join("")}</div>
    </div>`;
  const podeApagar = GESTAO.includes(me.role) || t.criadaPor?.id === me.id;
  const responsavelPhone = t.responsavel?.phone;
  const aviso = t.responsavel?.id !== me.id && responsavelPhone;
  $("#tv-body").insertAdjacentHTML(
    "beforeend",
    `<div class="tv-danger">${t.status !== "cancelada" && t.status !== "concluida" ? `<button type="button" class="link" id="tv-cancelar">Cancelar tarefa</button>` : ""}${podeApagar ? `<button type="button" class="link danger" id="tv-apagar">${icon("trash")}Excluir</button>` : ""}</div>`,
  );
  $("#tv-foot").innerHTML = `
    <a class="btn btn-outline" target="_blank" rel="noopener" href="${whatsappLink(aviso ? responsavelPhone : "", mensagemTarefa(t))}">${icon("chat-send")}<span>${aviso ? `Avisar ${esc(firstName(t.responsavel))}` : "WhatsApp"}</span></a>
    <button type="button" class="btn btn-navy btn-grow" id="tv-editar">${icon("edit")}<span>Editar</span></button>`;
  carregarDocsTarefa(t);
}
async function carregarDocsTarefa(t) {
  try {
    tkDocs ||= (await api("/api/documentos")).documentos;
    const ligados = new Set(t.documentos.map((d) => d.id));
    $("#tv-doc").innerHTML =
      `<option value="">${tkDocs.length ? "Vincular um documento da biblioteca…" : "Nenhum documento na biblioteca"}</option>` +
      tkDocs.filter((d) => !ligados.has(d.id)).map((d) => `<option value="${d.id}">${esc(d.titulo)}</option>`).join("");
  } catch {}
}
async function patchTarefa(body, mensagem = "") {
  try {
    const { tarefa } = await api(`/api/tarefas/${tkAberta.id}`, { method: "PATCH", body });
    renderTarefaView(tarefa);
    if (mensagem) toast(mensagem);
    if (section === "tarefas") loadTarefas();
  } catch (error) {
    toast(error.message, false);
  }
}
$("#tv-body").addEventListener("click", async (event) => {
  const status = event.target.closest("[data-tv-status]");
  if (status) {
    const novo = status.dataset.tvStatus;
    if (novo === "aguardando") {
      $("#tv-wait").hidden = false;
      $("#tv-aguardando").focus();
      return;
    }
    const abertos = tkAberta.lista.filter((i) => !i.feito).length;
    if (novo === "concluida" && abertos && !(await confirmBox("Concluir com passos em aberto?", `${abertos} passo(s) do checklist não foram marcados.`, "Concluir")))
      return;
    return patchTarefa({ status: novo }, novo === "concluida" ? "Tarefa concluída." : "");
  }
  if (event.target.closest("#tv-aguardando-ok")) return patchTarefa({ status: "aguardando", aguardando: $("#tv-aguardando").value }, "Marcada como aguardando.");
  if (event.target.closest("#tv-add-item")) {
    const texto = $("#tv-novo-item").value.trim();
    if (!texto) return $("#tv-novo-item").focus();
    try {
      renderTarefaView((await api(`/api/tarefas/${tkAberta.id}/itens`, { method: "POST", body: { texto } })).tarefa);
      $("#tv-novo-item").focus();
    } catch (error) {
      toast(error.message, false);
    }
    return;
  }
  const del = event.target.closest("[data-del-item]");
  if (del) {
    try {
      renderTarefaView((await api(`/api/tarefas/${tkAberta.id}/itens/${del.dataset.delItem}`, { method: "DELETE" })).tarefa);
    } catch (error) {
      toast(error.message, false);
    }
    return;
  }
  const mention = event.target.closest("[data-mention]");
  if (mention) {
    const area = $("#tv-comentario");
    area.value = `${area.value}${area.value && !area.value.endsWith(" ") ? " " : ""}@${mention.dataset.mention} `;
    area.focus();
  }
});
$("#tv-body").addEventListener("change", async (event) => {
  const box = event.target.closest("[data-item]");
  if (box) {
    try {
      renderTarefaView((await api(`/api/tarefas/${tkAberta.id}/itens/${box.dataset.item}`, { method: "PATCH", body: { feito: box.checked } })).tarefa);
      if (section === "tarefas") loadTarefas();
    } catch (error) {
      box.checked = !box.checked;
      toast(error.message, false);
    }
    return;
  }
  if (event.target.id === "tv-doc" && event.target.value)
    patchTarefa({ documentos: [...tkAberta.documentos.map((d) => d.id), event.target.value] }, "Documento vinculado.");
});
$("#tv-body").addEventListener("keydown", (event) => {
  if (event.target.id === "tv-novo-item" && event.key === "Enter") {
    event.preventDefault();
    $("#tv-add-item").click();
  }
});
$("#tv-body").addEventListener("submit", async (event) => {
  if (event.target.id !== "tv-comentar") return;
  event.preventDefault();
  const texto = $("#tv-comentario").value.trim();
  if (!texto) return;
  try {
    renderTarefaView((await api(`/api/tarefas/${tkAberta.id}/comentarios`, { method: "POST", body: { texto } })).tarefa);
    $("#tv-body").scrollTop = $("#tv-body").scrollHeight;
    if (section === "tarefas") loadTarefas();
  } catch (error) {
    toast(error.message, false);
  }
});
$("#tv-foot").addEventListener("click", (event) => {
  if (event.target.closest("#tv-editar")) openTarefaForm(tkAberta);
});
$("#tv-body").addEventListener("click", async (event) => {
  if (event.target.closest("#tv-cancelar")) {
    if (await confirmBox("Cancelar a tarefa?", "Ela sai das listas abertas e fica no histórico. Dá para reabrir depois.", "Cancelar tarefa"))
      patchTarefa({ status: "cancelada" }, "Tarefa cancelada.");
    return;
  }
  if (event.target.closest("#tv-apagar")) {
    if (!(await confirmBox("Excluir a tarefa?", "Apaga a tarefa, o checklist e a conversa. Use só para o que foi lançado por engano.", "Excluir"))) return;
    try {
      await api(`/api/tarefas/${tkAberta.id}`, { method: "DELETE" });
      $("#tk-view").close();
      toast("Tarefa excluída.");
      if (section === "tarefas") loadTarefas();
    } catch (error) {
      toast(error.message, false);
    }
  }
});

/* Lote por modelo */
async function previaLote() {
  const modelo = tk.modelos[$("#tl-modelo").value];
  const criterio = $("#tl-criterios input:checked")?.value || "pessoas";
  const pessoas = escolhidas($("#tl-pessoas")).map((id) => tk.pessoas.find((p) => p.id === id));
  if (!modelo || !pessoas.length) {
    $("#tl-previa").innerHTML = `<p class="muted small">Escolha quem vai executar para ver as tarefas.</p>`;
    return;
  }
  let partes = pessoas.map(() => "");
  if (criterio === "pares_impares") partes = ["dias pares", "dias ímpares"];
  if (criterio === "secoes") {
    const secoes = (await getLocais()).flatMap((l) => l.secoes.map((s) => s.secao)).sort((a, b) => a - b);
    const tamanho = Math.ceil(secoes.length / pessoas.length);
    partes = pessoas.map((_, i) => {
      const faixa = secoes.slice(i * tamanho, (i + 1) * tamanho);
      return faixa.length ? `seções ${String(faixa[0]).padStart(4, "0")} a ${String(faixa.at(-1)).padStart(4, "0")}` : "";
    });
  }
  const aviso = criterio === "pares_impares" && pessoas.length !== 2 ? `<p class="error">Para dias pares e ímpares, escolha duas pessoas.</p>` : "";
  $("#tl-previa").innerHTML =
    aviso +
    `<p class="field-label">Vai criar ${pessoas.length} tarefa(s)</p><ul class="tl-lista">${pessoas
      .map((p, i) => `<li>${userAvatar(p, " avatar-sm")}<span><strong>${esc(partes[i] ? `${modelo.nome} · ${partes[i]}` : modelo.nome)}</strong><small>${esc(p.name)} · ${modelo.itens.length} passos</small></span></li>`)
      .join("")}</ul>`;
}
$("#tk-lote").addEventListener("click", async () => {
  if (!tk) tk = await api("/api/tarefas?visao=comigo");
  $("#tl-modelo").innerHTML = Object.entries(tk.modelos)
    .map(([key, m]) => `<option value="${key}">${esc(m.nome)}</option>`)
    .join("");
  $("#tl-criterios").innerHTML = Object.entries(tk.criterios)
    .map(([key, label], i) => `<label class="dm-tipo"><input type="radio" name="tl-criterio" value="${key}" ${i === 0 ? "checked" : ""} />${icon({ pares_impares: "calendar", secoes: "ballot", pessoas: "users" }[key])}<span>${esc(label)}</span></label>`)
    .join("");
  pessoasChips($("#tl-pessoas"), []);
  $("#tl-prazo").value = "";
  $("#tl-referencia").value = "";
  errorAt("#tl-error");
  previaLote();
  $("#tk-lote-dialog").showModal();
});
for (const id of ["#tl-modelo", "#tl-criterios"]) $(id).addEventListener("change", previaLote);
$("#tl-pessoas").addEventListener("click", () => setTimeout(previaLote));
$("#tl-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#tl-error");
  try {
    const { tarefas } = await api("/api/tarefas/lote", {
      method: "POST",
      body: {
        modelo: $("#tl-modelo").value,
        criterio: $("#tl-criterios input:checked")?.value,
        pessoas: escolhidas($("#tl-pessoas")),
        prazo: $("#tl-prazo").value,
        referencia: $("#tl-referencia").value,
      },
    });
    $("#tk-lote-dialog").close();
    toast(`${tarefas.length} tarefa(s) criadas.`);
    tkVisao = "equipe";
    for (const other of $$("[data-tk-visao]")) other.setAttribute("aria-pressed", String(other.dataset.tkVisao === "equipe"));
    loadTarefas();
  } catch (error) {
    errorAt("#tl-error", error.message);
  }
});

/* ---------- Escala ASE ---------- */
let es = null,
  esVisao = "proximos",
  esPassados = false,
  esDia = null;
const ES_PRESENCA = { presente: ["Presente", "chip-green"], faltou: ["Faltou", "chip-red"], substituido: ["Substituído", "chip-blue"] };
const ES_SITUACAO = { alerta: ["No limite", "chip-yellow"], acima: ["Acima do limite", "chip-red"] };

async function loadEscala() {
  try {
    es = await api("/api/escala");
    renderEscala();
  } catch (error) {
    $("#es-body").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function renderEscala() {
  const futuros = es.dias.filter((d) => d.data >= es.hoje && (d.pessoas.length || d.todos));
  const proximo = futuros[0];
  const acima = es.pessoas.filter((p) => p.situacao === "acima");
  const alerta = es.pessoas.filter((p) => p.situacao === "alerta");
  const pendentes = es.trocas.filter((t) => t.status === "pendente");
  $("#es-c-pessoas").textContent = es.pessoas.length;
  $("#es-c-trocas").textContent = pendentes.length;
  $("#es-resumo").innerHTML = es.dias.length
    ? [
        proximo ? `<b>${proximo.data === es.hoje ? "Hoje" : esc(diaMes(proximo.data))}:</b> ${proximo.todos ? "todos os ASE" : `${proximo.pessoas.length} ASE`}` : "",
        `${es.pessoas.length} ASE na escala`,
        acima.length ? `<span class="bad">${acima.length} acima de ${es.limite} convocações</span>` : "",
        pendentes.length ? `<span class="warn">${pendentes.length} troca(s) para responder</span>` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  void alerta;
  if (!es.dias.length) {
    $("#es-body").innerHTML = `<div class="empty-state"><strong>A escala ainda não foi lançada</strong><p>Copie a mensagem da escala no grupo dos ASE e use “Atualizar pelo WhatsApp”.</p></div>`;
    return;
  }
  const corpo = {
    proximos: () => {
      const passados = es.dias.filter((d) => d.data < es.hoje && d.pessoas.length);
      return (
        (passados.length ? `<button type="button" class="link es-passados" id="es-passados">${esPassados ? "Esconder dias anteriores" : `Ver ${passados.length} dias anteriores`}</button>` : "") +
        (esPassados ? passados.map(diaCard).join("") : "") +
        (futuros.length ? futuros.map(diaCard).join("") : `<div class="empty-state"><strong>Nenhum dia pela frente</strong><p>Use “Atualizar pelo WhatsApp” para lançar os próximos dias.</p></div>`)
      );
    },
    todos: () => {
      const meses = {};
      for (const d of es.dias) (meses[d.data.slice(0, 7)] ||= []).push(d);
      return Object.entries(meses)
        .map(
          ([mes, dias]) =>
            `<details class="es-mes" ${mes === es.hoje.slice(0, 7) ? "open" : ""}><summary><strong>${new Date(mes + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><small>${dias.length} dias</small></summary><div class="es-dias">${dias.map(diaCard).join("")}</div></details>`,
        )
        .join("");
    },
    pessoas: () =>
      `<div class="es-pessoas">${[...es.pessoas]
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
        .map((p) => {
          const [label, chip] = ES_SITUACAO[p.situacao] || [];
          const proximo = p.datas.find((d) => d >= es.hoje);
          return `<button type="button" class="es-pessoa sit-${p.situacao}" data-es-pessoa="${p.id}">
            ${userAvatar({ id: p.id, name: p.nome }, " avatar-sm")}
            <span class="es-pessoa-main"><strong>${esc(p.nome)}</strong><small>${proximo ? `Próximo: ${esc(diaMes(proximo))}` : "Sem dias pela frente"} · 1º turno ${p.turno1} · 2º turno ${p.turno2}${p.conta ? " · tem acesso" : ""}</small>${barra(p.total, es.limite, `sit-${p.situacao}`)}</span>
            <span class="es-total"><b>${p.total}</b>/${es.limite}${label ? `<span class="chip chip-tag ${chip}">${label}</span>` : ""}</span>
          </button>`;
        })
        .join("")}</div>`,
    trocas: () => {
      const gestao = GESTAO.includes(me.role);
      return `<div class="es-trocas-head"><p class="muted small">${gestao ? "Ao aprovar, a escala muda sozinha." : "Quem aprova é a chefia."}</p><button type="button" class="btn btn-outline btn-sm" id="es-nova-troca">${icon("plus")}Registrar pedido</button></div>${
        es.trocas.length
          ? `<div class="dm-list">${es.trocas.map((t) => trocaCard(t, gestao)).join("")}</div>`
          : `<div class="empty-state">${icon("swap")}<strong>Nenhum pedido de troca</strong><p>Quem é ASE pede pelo app; o cartório também pode registrar o que chegou pelo grupo.</p></div>`
      }`;
    },
  };
  $("#es-body").innerHTML = corpo[esVisao]();
}
function diaCard(d) {
  const passado = d.data < es.hoje;
  const presentes = d.pessoas.filter((p) => p.presenca === "presente").length;
  return `<article class="es-dia${d.data === es.hoje ? " today" : ""}${passado ? " past" : ""}">
    <button type="button" class="es-dia-head" data-es-dia="${d.data}">
      <span class="tl-date"><b>${Number(d.data.slice(8))}</b>${MONTHS[Number(d.data.slice(5, 7)) - 1]}</span>
      <span class="es-dia-info"><strong>${esc(SEMANA_LONGA[d.semana] || d.semana)}${d.data === es.hoje ? ' <span class="chip chip-tag chip-yellow">Hoje</span>' : ""}</strong>${d.atividade || d.horario ? `<small>${esc([d.atividade, d.horario].filter(Boolean).join(" · "))}</small>` : ""}</span>
      <span class="es-dia-count">${d.todos ? `<span class="chip chip-tag chip-navy">Todos</span>` : `<b>${d.pessoas.length}</b><small>ASE</small>`}${passado && d.pessoas.length ? `<small>${presentes} presentes</small>` : ""}</span>
    </button>
    ${
      d.pessoas.length
        ? `<ul class="es-nomes">${d.pessoas
            .map((p) => {
              const [, chip] = ES_PRESENCA[p.presenca] || [];
              return `<li class="${chip || ""}${p.situacao === "acima" ? " sit-acima" : ""}" title="${esc(p.nome)}${p.situacao === "acima" ? " · acima do limite" : ""}">${esc(nomeCurto(p.nome))}${p.horario ? `<small>${esc(p.horario)}</small>` : ""}</li>`;
            })
            .join("")}</ul>`
        : ""
    }
  </article>`;
}
function trocaCard(t, gestao) {
  const status = { pendente: ["Aguardando a chefia", "chip-yellow"], aprovada: ["Aprovada", "chip-green"], recusada: ["Recusada", "chip-red"], cancelada: ["Cancelada", ""] }[t.status];
  return `<div class="dm-card es-troca st-${t.status}">
    <span class="dm-icon">${icon("swap")}</span>
    <span class="dm-main">
      <span class="dm-top"><b>#${t.numero}</b> ${esc(t.pessoa)}</span>
      <strong>${esc(diaMes(t.deData))} → ${esc(diaMes(t.paraData))}</strong>
      <small>${esc([t.motivo, `pedido por ${t.pedidoPor} ${sinceLabel(t.pedidoEm)}`].filter(Boolean).join(" · "))}</small>
      ${t.resposta ? `<small class="dm-answer">${icon("check-circle")}${esc(t.resposta)}</small>` : ""}
      ${
        t.status === "pendente"
          ? `<span class="es-troca-actions">${gestao ? `<button type="button" class="btn btn-outline btn-sm" data-troca="${t.id}" data-acao="recusar">Recusar</button><button type="button" class="btn btn-primary btn-sm" data-troca="${t.id}" data-acao="aprovar">Aprovar</button>` : ""}<button type="button" class="link" data-troca="${t.id}" data-acao="cancelar">Cancelar pedido</button></span>`
          : ""
      }
    </span>
    <span class="dm-side"><span class="chip chip-tag ${status[1]}">${status[0]}</span>${t.decididoPor ? `<small>${esc(firstName({ name: t.decididoPor }))}</small>` : ""}</span>
  </div>`;
}
for (const button of $$("[data-es-visao]"))
  button.addEventListener("click", () => {
    esVisao = button.dataset.esVisao;
    for (const other of $$("[data-es-visao]")) other.setAttribute("aria-pressed", String(other === button));
    es && renderEscala();
  });
$("#es-body").addEventListener("click", async (event) => {
  if (event.target.closest("#es-passados")) {
    esPassados = !esPassados;
    return renderEscala();
  }
  const dia = event.target.closest("[data-es-dia]");
  if (dia) return openDia(dia.dataset.esDia);
  const pessoa = event.target.closest("[data-es-pessoa]");
  if (pessoa) return openPessoaEscala(pessoa.dataset.esPessoa);
  if (event.target.closest("#es-nova-troca")) return openTroca();
  const troca = event.target.closest("[data-troca]");
  if (troca) {
    const acao = troca.dataset.acao;
    let resposta = "";
    if (acao === "recusar" && !(await confirmBox("Recusar a troca?", "A pessoa continua escalada no dia original.", "Recusar"))) return;
    try {
      await api(`/api/escala/trocas/${troca.dataset.troca}`, { method: "PATCH", body: { acao, resposta } });
      toast({ aprovar: "Troca aprovada. A escala foi atualizada.", recusar: "Troca recusada.", cancelar: "Pedido cancelado." }[acao]);
      loadEscala();
    } catch (error) {
      toast(error.message, false);
    }
  }
});

/* Um dia da escala */
function openDia(data) {
  esDia = es.dias.find((d) => d.data === data) || { data, semana: "", atividade: "", horario: "", observacao: "", todos: false, pessoas: [] };
  $("#ed2-kicker").textContent = `Escala ASE · ${esDia.turno || (data <= "2026-10-04" ? 1 : 2)}º turno`;
  $("#ed2-title").textContent = dateLong(data);
  $("#ed2-atividade").value = esDia.atividade;
  $("#ed2-horario").value = esDia.horario;
  $("#ed2-obs").value = esDia.observacao;
  $("#ed2-todos").checked = esDia.todos;
  $("#es-nomes").innerHTML = es.pessoas.map((p) => `<option value="${esc(p.nome)}"></option>`).join("");
  $("#ed2-nova").value = "";
  renderDiaPessoas();
  errorAt("#ed2-error");
  if (!$("#es-dia-dialog").open) $("#es-dia-dialog").showModal();
}
function renderDiaPessoas() {
  $("#ed2-count").textContent = esDia.pessoas.length ? `${esDia.pessoas.length} ASE` : "";
  $("#ed2-pessoas").innerHTML = esDia.pessoas.length
    ? esDia.pessoas
        .map((p) => {
          const total = es.pessoas.find((x) => x.id === p.pessoaId)?.total || 0;
          return `<div class="ed2-pessoa">
            <span class="ed2-nome"><strong>${esc(p.nome)}</strong><small class="${total > es.limite ? "bad" : total >= es.limite - 1 ? "warn" : ""}">${total}/${es.limite} convocações</small></span>
            <input data-reg-horario="${p.id}" value="${esc(p.horario)}" maxlength="40" placeholder="${esc(esDia.horario || "Horário")}" aria-label="Horário de ${esc(p.nome)}" />
            <span class="segmented segmented-sm" role="group" aria-label="Presença">${["presente", "faltou"]
              .map((k) => `<button type="button" data-reg="${p.id}" data-p="${k}" aria-pressed="${p.presenca === k}">${ES_PRESENCA[k][0]}</button>`)
              .join("")}</span>
            <button type="button" class="icon-btn" data-reg-del="${p.id}" aria-label="Retirar ${esc(p.nome)} do dia">${icon("trash")}</button>
          </div>`;
        })
        .join("")
    : `<p class="muted small">${esDia.todos ? "Dia de todos: não precisa listar nomes." : "Ninguém escalado ainda."}</p>`;
}
async function recarregarDia() {
  es = await api("/api/escala");
  esDia = es.dias.find((d) => d.data === esDia.data) || { ...esDia, pessoas: [] };
  renderDiaPessoas();
  renderEscala();
}
$("#ed2-pessoas").addEventListener("click", async (event) => {
  const presenca = event.target.closest("[data-reg]");
  const del = event.target.closest("[data-reg-del]");
  try {
    if (presenca) {
      const reg = esDia.pessoas.find((p) => p.id === presenca.dataset.reg);
      const valor = reg.presenca === presenca.dataset.p ? "" : presenca.dataset.p;
      await api(`/api/escala/registros/${reg.id}`, { method: "PATCH", body: { presenca: valor } });
      reg.presenca = valor;
      renderDiaPessoas();
      renderEscala();
    }
    if (del) {
      const reg = esDia.pessoas.find((p) => p.id === del.dataset.regDel);
      if (!(await confirmBox(`Retirar ${nomeCurto(reg.nome)}?`, `Sai da escala de ${fmtData(esDia.data)}. A convocação deixa de contar.`, "Retirar"))) return;
      await api(`/api/escala/registros/${reg.id}`, { method: "DELETE" });
      await recarregarDia();
    }
  } catch (error) {
    errorAt("#ed2-error", error.message);
  }
});
$("#ed2-pessoas").addEventListener("change", async (event) => {
  const input = event.target.closest("[data-reg-horario]");
  if (!input) return;
  try {
    await api(`/api/escala/registros/${input.dataset.regHorario}`, { method: "PATCH", body: { horario: input.value } });
    esDia.pessoas.find((p) => p.id === input.dataset.regHorario).horario = input.value;
    renderEscala();
  } catch (error) {
    errorAt("#ed2-error", error.message);
  }
});
async function incluirNoDia() {
  const nome = $("#ed2-nova").value.trim();
  if (!nome) return $("#ed2-nova").focus();
  errorAt("#ed2-error");
  try {
    const conhecido = es.pessoas.find((p) => normalizeText(p.nome) === normalizeText(nome));
    const r = await api(`/api/escala/dias/${esDia.data}/pessoas`, { method: "POST", body: conhecido ? { pessoaId: conhecido.id } : { nome } });
    $("#ed2-nova").value = "";
    await recarregarDia();
    toast(r.alerta ? `Incluída. Atenção: ${r.total} de ${es.limite} convocações.` : "Incluída no dia.", !r.alerta);
  } catch (error) {
    errorAt("#ed2-error", error.message);
  }
}
$("#ed2-incluir").addEventListener("click", incluirNoDia);
$("#ed2-nova").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    incluirNoDia();
  }
});
$("#ed2-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ed2-error");
  try {
    await api(`/api/escala/dias/${esDia.data}`, {
      method: "PATCH",
      body: { atividade: $("#ed2-atividade").value, horario: $("#ed2-horario").value, observacao: $("#ed2-obs").value, todos: $("#ed2-todos").checked },
    });
    $("#es-dia-dialog").close();
    toast("Dia salvo.");
    loadEscala();
  } catch (error) {
    errorAt("#ed2-error", error.message);
  }
});

/* Pessoa da escala */
let esPessoa = null;
function openPessoaEscala(id) {
  esPessoa = es.pessoas.find((p) => p.id === id);
  const p = esPessoa;
  const [label, chip] = ES_SITUACAO[p.situacao] || ["Dentro do limite", "chip-green"];
  $("#ep-kicker").textContent = "Auxiliar de Serviços Eleitorais";
  $("#ep-title").textContent = p.nome;
  const datas = [...p.datas.map((d) => ({ d, todos: false })), ...p.todos.map((d) => ({ d, todos: true }))].sort((a, b) => a.d.localeCompare(b.d));
  $("#ep-resumo").innerHTML = `
    <div class="ep-total sit-${p.situacao}"><strong>${p.total}<span>/${es.limite}</span></strong><div><span class="chip chip-tag ${chip}">${label}</span><small>1º turno ${p.turno1} · 2º turno ${p.turno2}${p.todos.length ? ` · inclui ${p.todos.length} dia(s) de todos` : ""}</small>${barra(p.total, es.limite, `sit-${p.situacao}`)}</div></div>
    <ul class="ep-datas">${datas
      .map(({ d, todos }) => `<li class="${d < es.hoje ? "past" : ""}${todos ? " todos" : ""}"><b>${diaMes(d)}</b><small>${esc((SEMANA_LONGA[es.dias.find((x) => x.data === d)?.semana] || "").slice(0, 3))}${todos ? " · todos" : ""}</small></li>`)
      .join("")}</ul>`;
  $("#ep-nome").value = p.nome;
  $("#ep-telefone").value = p.telefone ? formatPhone(p.telefone) : "";
  const futuros = datas.filter(({ d }) => d >= es.hoje);
  const texto = [`Olá, ${nomeCurto(p.nome).split(" ")[0]}! Seus próximos dias na escala de ASE da 23ª ZE:`, ...futuros.map(({ d }) => {
    const dia = es.dias.find((x) => x.data === d);
    return `• ${fmtData(d)} (${(SEMANA_LONGA[dia?.semana] || "").toLowerCase()})${dia?.atividade ? ` · ${dia.atividade}` : ""}${dia?.horario ? ` · ${dia.horario}` : ""}`;
  }), `Você tem ${p.total} de ${es.limite} convocações.`].join("\n");
  $("#ep-whatsapp").hidden = !futuros.length;
  $("#ep-whatsapp").href = whatsappLink(p.telefone, texto);
  errorAt("#ep-error");
  $("#es-pessoa-dialog").showModal();
}
$("#ep-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ep-error");
  try {
    await api(`/api/escala/pessoas/${esPessoa.id}`, { method: "PATCH", body: { nome: $("#ep-nome").value, telefone: $("#ep-telefone").value } });
    $("#es-pessoa-dialog").close();
    toast("Dados salvos.");
    loadEscala();
  } catch (error) {
    errorAt("#ep-error", error.message);
  }
});

/* Colar do WhatsApp */
$("#es-importar").addEventListener("click", () => {
  $("#ei-texto").value = "";
  $("#ei-previa").hidden = true;
  $("#ei-aplicar").disabled = true;
  errorAt("#ei-error");
  $("#es-import-dialog").showModal();
  setTimeout(() => $("#ei-texto").focus(), 50);
});
$("#ei-texto").addEventListener("input", () => {
  $("#ei-aplicar").disabled = true;
  $("#ei-previa").hidden = true;
});
function previaImportacao(r) {
  const linha = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
  $("#ei-previa").innerHTML = `<dl class="ei-numeros">
      ${linha("Dias no texto", r.dias)}${linha("Entram", r.incluidas)}${linha("Saem", r.retiradas)}${linha("Pessoas novas", r.pessoasNovas.length)}
    </dl>
    ${r.pessoasNovas.length ? `<p class="small muted">Novas na escala: ${esc(r.pessoasNovas.join(", "))}</p>` : ""}
    ${r.acima.length ? `<p class="ei-alerta">${icon("alert")}<span>Acima de ${es?.limite || 10} convocações: ${esc(r.acima.join("; "))}</span></p>` : ""}
    ${r.avisos.length ? `<ul class="ei-avisos">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}`;
  $("#ei-previa").hidden = false;
}
$("#ei-conferir").addEventListener("click", async () => {
  errorAt("#ei-error");
  try {
    const r = await api("/api/escala/importar", { method: "POST", body: { texto: $("#ei-texto").value } });
    previaImportacao(r);
    $("#ei-aplicar").disabled = !r.dias;
  } catch (error) {
    errorAt("#ei-error", error.message);
  }
});
$("#ei-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ei-error");
  try {
    const r = await api("/api/escala/importar", { method: "POST", body: { texto: $("#ei-texto").value, aplicar: true } });
    $("#es-import-dialog").close();
    toast(`Escala atualizada: ${r.dias} dias, ${r.incluidas} entradas e ${r.retiradas} saídas.`);
    loadEscala();
  } catch (error) {
    errorAt("#ei-error", error.message);
  }
});

/* Copiar para o grupo, no mesmo formato do WhatsApp */
$("#es-copiar").addEventListener("click", async () => {
  if (!es) return;
  const dias = es.dias.filter((d) => d.data >= es.hoje && (d.pessoas.length || d.todos));
  if (!dias.length) return toast("Não há dias pela frente para copiar.", false);
  const texto = [
    "*🗓️ESCALA ATUALIZADA – AUXILIAR DE SERVIÇOS ELEITORAIS🗓️*",
    ...dias.map((d) =>
      [
        `*${d.semana}, ${fmtData(d.data)}*${d.atividade || d.horario ? `\n_${[d.atividade, d.horario].filter(Boolean).join(" · ")}_` : ""}`,
        ...(d.todos ? ["*▫️ TODOS*"] : d.pessoas.map((p) => `▫️ ${p.nome.toLocaleUpperCase("pt-BR")}${p.horario ? ` (${p.horario})` : ""}`)),
      ].join("\n\n"),
    ),
  ].join("\n\n\n");
  try {
    await navigator.clipboard.writeText(texto);
    toast(`Escala de ${dias.length} dia(s) copiada. Cole no grupo.`);
  } catch {
    toast("Não deu para copiar neste navegador.", false);
  }
});

/* Pedido de troca (ASE pelo app ou cartório registrando) */
let meuEs = null;
async function openTroca(pessoaId = "") {
  const cartorio = EDITORS.includes(me.role);
  if (cartorio && !es) es = await api("/api/escala");
  $("#et-pessoa-field").hidden = !cartorio;
  const pessoas = cartorio ? es.pessoas : [];
  if (cartorio) $("#et-pessoa").innerHTML = pessoas.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join("");
  if (pessoaId) $("#et-pessoa").value = pessoaId;
  const preencherDias = () => {
    const hoje = cartorio ? es.hoje : meuEs.hoje;
    const datas = cartorio ? pessoas.find((p) => p.id === $("#et-pessoa").value)?.datas || [] : meuEs.dias.filter((d) => !d.todos).map((d) => d.data);
    $("#et-de").innerHTML = datas.filter((d) => d >= hoje).map((d) => `<option value="${d}">${fmtData(d)}</option>`).join("") || `<option value="">Sem dias pela frente</option>`;
  };
  $("#et-pessoa").onchange = preencherDias;
  preencherDias();
  $("#et-para").value = "";
  $("#et-motivo").value = "";
  errorAt("#et-error");
  $("#es-troca-dialog").showModal();
}
$("#et-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#et-error");
  try {
    await api("/api/escala/trocas", {
      method: "POST",
      body: { pessoaId: $("#et-pessoa").value, deData: $("#et-de").value, paraData: $("#et-para").value, motivo: $("#et-motivo").value },
    });
    $("#es-troca-dialog").close();
    toast("Pedido de troca registrado.");
    if (section === "escala") loadEscala();
    if (section === "minha-escala") loadMinhaEscala();
  } catch (error) {
    errorAt("#et-error", error.message);
  }
});

/* ---------- Minha escala (ASE) ---------- */
async function loadMinhaEscala() {
  const body = $("#me-body");
  try {
    meuEs = await api("/api/escala/minha");
    if (!meuEs.pessoa) {
      body.innerHTML = `<div class="empty-state">${icon("shift")}<strong>Seu nome ainda não está na escala</strong><p>Assim que o cartório lançar a escala com o seu nome (${esc(me.name || me.username)}), seus dias aparecem aqui.</p></div>`;
      return;
    }
    const p = meuEs.pessoa;
    const futuros = meuEs.dias.filter((d) => d.data >= meuEs.hoje);
    const passados = meuEs.dias.filter((d) => d.data < meuEs.hoje).reverse();
    const proximo = futuros[0];
    const sit = { ok: "Dentro do limite", alerta: "Atenção: você está no limite", acima: "Acima do limite: fale com o cartório" }[p.situacao];
    const linhaDia = (d) => {
      const [plabel, pchip] = ES_PRESENCA[d.presenca] || [];
      return `<li class="tl-item${d.data === meuEs.hoje ? " today" : ""}${d.data < meuEs.hoje ? " past" : ""}">
        <span class="tl-date"><b>${Number(d.data.slice(8))}</b>${MONTHS[Number(d.data.slice(5, 7)) - 1]}</span>
        <span class="tl-body"><strong>${esc(SEMANA_LONGA[d.semana] || d.semana)}</strong><small>${esc([d.atividade, d.horario].filter(Boolean).join(" · ") || `${d.turno}º turno`)}</small></span>
        <span class="tl-side">${plabel ? `<span class="chip chip-tag ${pchip}">${plabel}</span>` : d.todos ? `<span class="chip chip-tag chip-navy">Todos</span>` : ""}</span>
      </li>`;
    };
    body.innerHTML = `
      <div class="me-grid">
        <article class="me-hero sit-${p.situacao}">
          <p class="cd-kicker">${icon("shift")}Suas convocações</p>
          <strong class="me-count">${p.total}<span>/${meuEs.limite}</span></strong>
          <p>${esc(sit)} · 1º turno ${p.turno1} · 2º turno ${p.turno2}</p>
          ${barra(p.total, meuEs.limite, `sit-${p.situacao}`)}
        </article>
        <article class="a-card me-next">
          <div class="card-head"><h2>${icon("clock")}Próximo dia</h2></div>
          ${
            proximo
              ? `<p class="me-date">${esc(dateLong(proximo.data))}</p><p class="muted">${esc([proximo.atividade, proximo.horario].filter(Boolean).join(" · ") || "Horário e atividade a confirmar pelo cartório")}</p>`
              : `<p class="muted">Nenhum dia pela frente.</p>`
          }
        </article>
        <article class="a-card me-dias">
          <div class="card-head"><h2>${icon("calendar")}Seus dias</h2><button type="button" class="btn btn-outline btn-sm" id="me-troca" ${futuros.some((d) => !d.todos) ? "" : "disabled"}>${icon("swap")}Pedir troca</button></div>
          <ol class="timeline">${futuros.map(linhaDia).join("") || `<li class="empty-line">Nenhum dia pela frente.</li>`}</ol>
          ${passados.length ? `<details class="me-passados"><summary>${passados.length} dia(s) já trabalhados</summary><ol class="timeline">${passados.map(linhaDia).join("")}</ol></details>` : ""}
        </article>
        ${
          meuEs.trocas.length
            ? `<article class="a-card me-trocas"><div class="card-head"><h2>${icon("swap")}Seus pedidos de troca</h2></div><div class="dm-list">${meuEs.trocas.map((t) => trocaCard(t, false)).join("")}</div></article>`
            : ""
        }
      </div>`;
  } catch (error) {
    body.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#me-body").addEventListener("click", async (event) => {
  if (event.target.closest("#me-troca")) return openTroca();
  const troca = event.target.closest("[data-troca]");
  if (troca && troca.dataset.acao === "cancelar") {
    try {
      await api(`/api/escala/trocas/${troca.dataset.troca}`, { method: "PATCH", body: { acao: "cancelar" } });
      toast("Pedido cancelado.");
      loadMinhaEscala();
    } catch (error) {
      toast(error.message, false);
    }
  }
});

/* ---------- Início: o que fazer agora ---------- */
async function loadHomeWork() {
  const card = $("#home-work");
  const cartorio = EDITORS.includes(me.role);
  card.hidden = !(cartorio || me.role === "ase");
  if (card.hidden) return;
  try {
    if (me.role === "ase") {
      const minha = await api("/api/escala/minha");
      $("#home-work-title").textContent = "Seu próximo dia";
      $("#home-work-link").dataset.go = "minha-escala";
      const proximo = minha.dias?.find((d) => d.data >= minha.hoje);
      $("#home-work-body").innerHTML = !minha.pessoa
        ? `<p class="muted">Seu nome ainda não está na escala.</p>`
        : proximo
          ? `<p class="hw-big">${esc(dateLong(proximo.data))}</p><p class="muted">${esc([proximo.atividade, proximo.horario].filter(Boolean).join(" · ") || "Horário a confirmar")}</p>`
          : `<p class="muted">Nenhum dia pela frente.</p>`;
      return;
    }
    const [tarefas, escala] = await Promise.all([api("/api/tarefas/resumo"), api("/api/escala/resumo").catch(() => null)]);
    $("#home-work-title").textContent = "Para fazer";
    $("#home-work-link").dataset.go = "tarefas";
    const gestao = GESTAO.includes(me.role);
    const hoje = escala?.proximos?.find((d) => d.data === escala.hoje);
    const linhas = [
      gestao && tarefas.equipeAtrasadas ? `<button type="button" class="hw-line hw-alert" data-go="tarefas">${tarefas.equipeAtrasadas} tarefa(s) atrasada(s) na equipe</button>` : "",
      gestao && escala?.trocasPendentes ? `<button type="button" class="hw-line hw-alert" data-go="escala">${escala.trocasPendentes} troca(s) de escala para responder</button>` : "",
      escala?.acima ? `<button type="button" class="hw-line hw-alert" data-go="escala">${escala.acima} ASE acima de 10 convocações</button>` : "",
      hoje ? `<button type="button" class="hw-line" data-go="escala">Escala de hoje: ${hoje.todos ? "todos os ASE" : `${hoje.pessoas} ASE`}${hoje.atividade ? ` · ${esc(hoje.atividade)}` : ""}</button>` : "",
    ].join("");
    $("#home-work-body").innerHTML =
      (tarefas.proximas.length
        ? `<ul class="hw-tasks">${tarefas.proximas.map((t) => `<li><button type="button" data-hw-tarefa="${t.id}"><span>${esc(t.titulo)}</span><small class="${t.atrasada ? "late" : ""}">${t.prazo ? esc(prazoLabel(t)) : ""}</small></button></li>`).join("")}</ul>`
        : `<p class="muted">Nenhuma tarefa com você.</p>`) + linhas;
  } catch (error) {
    $("#home-work-body").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#home-work-body").addEventListener("click", (event) => {
  const tarefa = event.target.closest("[data-hw-tarefa]");
  if (tarefa) openTarefa(tarefa.dataset.hwTarefa);
});
