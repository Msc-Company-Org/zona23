/* Área da equipe: sessão, primeiro acesso, menus por perfil e telas da equipe.
   Usa os utilitários de admin.js ($, $$, esc, icon, api, toast, confirmBox, errorAt, initials, seed). */

const ROLE_LABEL = {
  admin: "Administração do sistema",
  chefe: "Chefe do Cartório",
  equipe: "Equipe do Cartório",
  juiz: "Juízo Eleitoral",
  promotor: "Promotoria Eleitoral",
  ase: "Auxiliar de Serviços Eleitorais",
  presidente: "Presidente de Seção",
  adm_predio: "Administração de Prédio",
};
const GESTAO = ["admin", "chefe"];
const EDITORS = ["admin", "chefe", "equipe"];
const AUTORIDADES = ["juiz", "promotor"];
const CAMPO = ["ase", "presidente", "adm_predio"];
const isJudge = () => me?.role === "juiz";

// Módulos: os marcados com `soon` mostram o que vem e a data prevista.
const MODULES = {
  inicio: { label: "Início", icon: "home" },
  agenda: { label: "Agenda", icon: "calendar" },
  equipe: { label: "Equipe", icon: "users" },
  conta: { label: "Perfil", icon: "user" },
  painel: { label: "Visão do acervo", icon: "dashboard" },
  fotos: { label: "Fotos", icon: "photos" },
  eventos: { label: "Eventos", icon: "event" },
  pessoas: { label: "Pessoas", icon: "people" },
  textos: { label: "Textos do site", icon: "text" },
  demandas: { label: "Demandas", icon: "ticket" },
  totalizacao: { label: "Totalização", icon: "ballot" },
  locais: { label: "Locais e seções", icon: "school" },
  documentos: { label: "Documentos", icon: "doc" },
  declaracoes: {
    label: "Declarações",
    icon: "certificate",
    soon: "16/10",
    group: "Eleições 2026",
    lede: "Declarações de comparecimento geradas em lote, no modelo do cartório, a partir da presença registrada.",
    features: [
      ["certificate", "Em lote", "Todas as declarações do dia, do turno ou de uma função em um único PDF."],
      ["check-circle", "Sem erro de local", "Nome, função, local e data vêm da presença registrada, sem redigitar."],
      ["chat-send", "Para quem saiu antes", "Envio individual pelo WhatsApp a quem foi liberado antes de receber."],
    ],
  },
  "minha-escala": {
    label: "Minha escala",
    icon: "shift",
    soon: "12/10",
    group: "Auxiliar de Serviços Eleitorais",
    lede: "Os dias em que você foi escalado, o horário de chegada e o que vai fazer.",
    features: [
      ["clock", "Horário do dia", "Chegada, saída e atividade, sem procurar no grupo."],
      ["alert", "Seus dias X/10", "Quantas convocações você já cumpriu nos dois turnos."],
      ["swap", "Pedir troca", "Pedido de troca de dia com resposta do cartório."],
      ["certificate", "Suas declarações", "Declaração de cada dia trabalhado para baixar."],
    ],
  },
  "minha-secao": {
    label: "Minha seção",
    icon: "ballot",
    soon: "21/10",
    group: "Presidente de seção",
    lede: "Sua seção, a sala, a equipe de mesários e o que fazer no sábado e no domingo.",
    features: [
      ["school", "Local e sala", "Endereço, sala e quem administra o prédio."],
      ["check-circle", "Checklist", "Teste da urna, material conferido, zerésima e encerramento, sem foto no grupo."],
      ["doc", "Orientações", "Respostas rápidas às dúvidas mais comuns do dia."],
    ],
  },
  "meu-local": {
    label: "Meu local",
    icon: "school",
    soon: "21/10",
    group: "Administração de prédio",
    lede: "O seu colégio: seções, presidentes, guarda das urnas e o checklist do sábado e do domingo.",
    features: [
      ["check-circle", "Checklist do local", "Urnas recebidas e testadas, salas trancadas, policiamento, mídias e material recolhido."],
      ["clock", "Filas após 17h", "A estimativa da maior fila no formato pedido pelo TRE."],
      ["users", "Presenças", "Administradores e coletores presentes ou ausentes."],
    ],
  },
  tarefas: {
    label: "Tarefas",
    icon: "tasks",
    soon: "12/10",
    group: "Trabalho do cartório",
    lede: "Os pedidos do dia a dia com responsável, prazo e situação — sem se perder no grupo.",
    features: [
      ["tasks", "Quem está com o quê", "Cada pedido tem responsável, prazo e status: a fazer, em andamento ou concluído."],
      ["doc", "Referência do processo", "SEI, PJe (CarPrecCrim, FP, IP), FILIA, ELO, Conseg, chamado de TI, edital e ofício."],
      ["swap", "Lotes divididos", "Modelos recorrentes, como justificativas por dias pares e ímpares, viram tarefas para cada pessoa."],
      ["chat-send", "Aviso no WhatsApp", "Ao atribuir, um toque envia o resumo para quem vai executar."],
    ],
  },
  escala: {
    label: "Escala ASE",
    icon: "shift",
    soon: "12/10",
    group: "Eleições 2026",
    lede: "A escala dos auxiliares com horário, atividade do dia e o limite de 10 convocações sob controle.",
    features: [
      ["copy", "Cola do WhatsApp", "A escala atual entra colando o texto do grupo, no mesmo formato de dia e nomes."],
      ["clock", "Horário e atividade", "Cada pessoa vê o horário de chegada e o que fará: urnas, envelopes, roteiro."],
      ["alert", "Limite de 10 dias", "Contador por pessoa nos dois turnos, com alerta no 9º dia e bloqueio acima de 10."],
      ["swap", "Trocas registradas", "Pedido de troca de dia com aprovação, sem mensagens soltas no grupo."],
    ],
  },
  frequencia: {
    label: "Presença",
    icon: "attendance",
    soon: "16/10",
    group: "Eleições 2026",
    lede: "Presença por dia, local e função, e as declarações de comparecimento geradas de uma vez.",
    features: [
      ["attendance", "Presença do dia", "Presente, faltou ou substituído, com entrada e saída."],
      ["school", "Faltosos por local", "Administradores de prédio e coletores ausentes, sem levantamento à mão."],
      ["certificate", "Declarações em lote", "Todas as declarações do dia ou do turno em PDF, já no modelo do cartório."],
    ],
  },
  convocacoes: {
    label: "Convocações",
    icon: "badge",
    soon: "16/10",
    group: "Eleições 2026",
    lede: "Quem trabalha em cada local e seção, e o caminho das dispensas e substituições.",
    features: [
      ["badge", "Todas as funções", "Presidentes, mesários, administradores de prédio, coletores, coordenadores e técnicos."],
      ["swap", "Dispensa e substituição", "Pedido, decisão e substituto sugerido, com histórico."],
      ["upload", "Importação do ELO", "Relatório do sistema importado em planilha, sem CPF nem título."],
    ],
  },
  situacao: {
    label: "Sala de situação",
    icon: "radar",
    soon: "21/10",
    group: "Eleições 2026",
    lede: "O sábado e o domingo da eleição num painel: o que já está pronto e o que precisa de atenção.",
    features: [
      ["check-circle", "Checklist por local", "Urnas recebidas e testadas, salas trancadas, policiamento, mídias e material recolhido."],
      ["ticket", "Chamados", "Material, urna, mesário ausente, infraestrutura e localização de eleitor, com responsável."],
      ["clock", "Filas após 17h", "A escala de 0 a 4 por local, no formato pedido pelo TRE."],
    ],
  },
  decisoes: {
    label: "Para decidir",
    icon: "gavel",
    soon: "16/10",
    group: "Juízo da 23ª Zona Eleitoral",
    lede: "O que o cartório preparou e aguarda decisão ou assinatura, num lugar só.",
    features: [
      ["badge", "Dispensas de mesários", "Pedidos com o motivo e o substituto sugerido pelo cartório."],
      ["doc", "Blocos de assinatura", "Processos SEI disponibilizados para assinatura, avisados aqui."],
      ["calendar", "Audiências públicas", "Editais e horários de geração de mídias, preparação de urnas e conferência visual."],
    ],
  },
  acompanhamento: {
    label: "Acompanhamento",
    icon: "scale",
    soon: "21/10",
    group: "Promotoria Eleitoral",
    lede: "As ocorrências do período eleitoral que pedem atenção do Ministério Público Eleitoral.",
    features: [
      ["alert", "Ocorrências", "Registros da sala de situação, como boca de urna e propaganda irregular."],
      ["badge", "Fiscais e delegados", "Credenciamento dos partidos e federações, sem dados pessoais."],
      ["calendar", "Audiências públicas", "Datas e horários das audiências do período."],
    ],
  },
};

function navGroups() {
  if (AUTORIDADES.includes(me.role))
    return [
      { items: ["inicio"] },
      { label: "Acompanhamento", items: [isJudge() ? "decisoes" : "acompanhamento", "totalizacao", "demandas", "situacao", "locais", "convocacoes"] },
      { label: "Cartório", items: ["agenda", "documentos", "equipe"] },
    ];
  if (me.role === "ase")
    return [
      { items: ["inicio"] },
      { label: "Meu trabalho", items: ["minha-escala", "declaracoes", "agenda"] },
      { label: "Consulta", items: ["locais", "documentos", "equipe"] },
    ];
  if (me.role === "presidente")
    return [
      { items: ["inicio"] },
      { label: "Dia da eleição", items: ["minha-secao", "demandas"] },
      { label: "Consulta", items: ["documentos", "agenda", "equipe"] },
    ];
  if (me.role === "adm_predio")
    return [
      { items: ["inicio"] },
      { label: "Dia da eleição", items: ["meu-local", "demandas"] },
      { label: "Consulta", items: ["locais", "documentos", "agenda", "equipe"] },
    ];
  return [
    { items: ["inicio"] },
    { label: "Dia da eleição", items: ["demandas", "totalizacao", "situacao"] },
    { label: "Trabalho", items: ["tarefas", "agenda", "documentos"] },
    { label: "Eleições 2026", items: ["escala", "frequencia", "declaracoes", "convocacoes", "locais"] },
    { label: "Memórias", items: ["painel", "fotos", "eventos", "pessoas", "textos"] },
    { label: "Cartório", items: ["equipe"] },
  ];
}
// Barra inferior do celular: atalhos por perfil e rótulos curtos.
const TAB_KEYS = {
  juiz: ["inicio", "decisoes", "totalizacao", "demandas"],
  promotor: ["inicio", "acompanhamento", "totalizacao", "demandas"],
  ase: ["inicio", "minha-escala", "declaracoes", "documentos"],
  presidente: ["inicio", "minha-secao", "demandas", "documentos"],
  adm_predio: ["inicio", "meu-local", "demandas", "locais"],
};
const tabKeys = () => TAB_KEYS[me.role] || ["inicio", "demandas", "totalizacao", "tarefas"];
const TAB_LABEL = {
  situacao: "Situação",
  decisoes: "Decidir",
  acompanhamento: "Acompanhar",
  escala: "Escala",
  totalizacao: "Totalização",
  "minha-escala": "Escala",
  "minha-secao": "Seção",
  "meu-local": "Local",
  locais: "Locais",
  declaracoes: "Declarações",
};
const allowedSections = () => [...navGroups().flatMap((group) => group.items), "conta"];

let installPrompt = null;
addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
});

/* ---------- Utilidades ---------- */
const VIEWS = ["login-view", "link-view", "onboarding-view", "password-view", "app-view"];
function showView(id) {
  for (const view of VIEWS) $("#" + view).hidden = view !== id;
  scrollTo({ top: 0 });
}
// "Dr. Fulano" aparece como Fulano nas saudações e nas iniciais.
const plainName = (person) => (person.name || person.username).replace(/^(dra?|sra?)\.?\s+/i, "");
const firstName = (person) => plainName(person).split(" ")[0];
const userAvatar = (person, extra = "") =>
  `<span class="avatar c${seed(person.id || person.username) % 4}${extra}" aria-hidden="true">${esc(initials(plainName(person)))}</span>`;
const roleChip = (person) =>
  GESTAO.includes(person.role)
    ? `<span class="chip chip-tag chip-navy">${person.role === "chefe" ? "Chefia" : "Administração"}</span>`
    : AUTORIDADES.includes(person.role)
      ? `<span class="chip chip-tag chip-yellow">Autoridade</span>`
      : CAMPO.includes(person.role)
        ? `<span class="chip chip-tag chip-green">${{ ase: "ASE", presidente: "Presidente", adm_predio: "ADM de prédio" }[person.role]}</span>`
        : "";
const dateLong = (date) =>
  new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const daysBetween = (from, to) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86400000);
const whatsappNumber = (phone) => (phone ? (phone.length <= 11 ? "55" + phone : phone) : "");
const formatPhone = (phone) =>
  phone?.length === 11 ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}` : phone || "";
const KIND = {
  eleicao: ["Eleição", "chip-yellow"],
  preparacao: ["Preparação", "chip-blue"],
  reuniao: ["Reunião", "chip-green"],
  prazo: ["Prazo", "chip-red"],
  outro: ["Outro", ""],
};

document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".pass-toggle");
  if (toggle) {
    const input = toggle.parentElement.querySelector("input");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Esconder senha" : "Mostrar senha");
    toggle.querySelector("use").setAttribute("href", show ? "#i-eye-off" : "#i-eye");
    return;
  }
  if (event.target.closest("[data-more]")) return openMore();
  const target = event.target.closest("[data-go]");
  if (target && me) {
    event.preventDefault();
    $("#more-sheet").open && $("#more-sheet").close();
    go(target.dataset.go);
  }
});

/* ---------- Sessão ---------- */
async function boot() {
  if (location.pathname === "/entrar/link") return showMagic();
  try {
    me = (await api("/api/auth/me")).user;
    enter();
  } catch {
    showLogin();
  }
}
function enter() {
  if (["/entrar", "/equipe", "/admin", "/entrar/link"].includes(location.pathname))
    history.replaceState(null, "", "/" + location.hash);
  if (!me.onboarded) return startOnboarding();
  if (me.mustChange) {
    showView("password-view");
    $("#first-current-field").hidden = me.linkFresh;
    setTimeout(() => $(me.linkFresh ? "#first-next" : "#first-current").focus(), 50);
    return;
  }
  showShell();
}
let authConfig = null;
async function showLogin() {
  // Links antigos do acervo (zon023.com.br/#pessoas) seguem para as Memórias.
  if (location.pathname === "/" && ["#pessoas", "#duvidas"].includes(location.hash))
    return location.replace("/memorias" + location.hash);
  me = null;
  showView("login-view");
  if (!authConfig) {
    authConfig = await fetch("/api/auth/config").then((response) => response.json()).catch(() => ({}));
    $("#link-mail").hidden = !authConfig.email;
    $("#link-whatsapp").hidden = Boolean(authConfig.email);
    if (authConfig.ready === false)
      errorAt("#login-error", "A área da equipe está em configuração. As Memórias continuam disponíveis.");
  }
  setTimeout(() => $("#login-user").focus(), 60);
}
for (const button of $$("[data-auth-tab]"))
  button.addEventListener("click", () => {
    for (const other of $$("[data-auth-tab]"))
      other.setAttribute("aria-pressed", String(other === button));
    for (const panel of $$("[data-auth-panel]")) panel.hidden = panel.dataset.authPanel !== button.dataset.authTab;
  });
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#login-error");
  const button = event.submitter;
  button.disabled = true;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        username: $("#login-user").value,
        password: $("#login-pass").value,
        remember: $("#login-remember").checked,
      },
    });
    me = data.user;
    $("#login-pass").value = "";
    enter();
  } catch (error) {
    errorAt("#login-error", error.message);
  } finally {
    button.disabled = false;
  }
});
$("#link-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#link-error");
  $("#link-sent").hidden = true;
  try {
    await api("/api/auth/link-request", { method: "POST", body: { login: $("#link-login").value } });
    $("#link-sent").textContent = "Se houver e-mail cadastrado para esse usuário, o link chega em instantes.";
    $("#link-sent").hidden = false;
  } catch (error) {
    errorAt("#link-error", error.message);
  }
});
for (const button of $$(".logout")) button.addEventListener("click", logout);
async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  history.replaceState(null, "", "/");
  showLogin();
}

/* ---------- Link de acesso ---------- */
let magicToken = "";
function showMagic() {
  magicToken = new URLSearchParams(location.hash.slice(1)).get("t") || "";
  // O token sai da barra de endereço: não fica no histórico nem é compartilhado por engano.
  history.replaceState(null, "", "/entrar/link");
  showView("link-view");
  if (!/^[a-f0-9]{64}$/.test(magicToken)) magicFailed("Este link está incompleto. Abra a mensagem de novo ou peça outro à equipe.");
}
function magicFailed(message) {
  $("#magic-title").textContent = "Não foi possível entrar";
  $("#magic-text").textContent = message;
  $("#magic-remember-line").hidden = true;
  $("#magic-submit").hidden = true;
}
$("#magic-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#magic-error");
  $("#magic-submit").disabled = true;
  try {
    const data = await api("/api/auth/magic", {
      method: "POST",
      body: { token: magicToken, remember: $("#magic-remember").checked },
    });
    me = data.user;
    history.replaceState(null, "", "/");
    enter();
  } catch (error) {
    magicFailed(error.message);
  } finally {
    $("#magic-submit").disabled = false;
  }
});

/* ---------- Primeiro acesso ---------- */
let obSteps = [],
  obIndex = 0;
function startOnboarding() {
  obSteps = ["welcome", ...(me.mustChange ? ["password"] : []), "contacts", "app", "ready"];
  obIndex = 0;
  const first = firstName(me);
  $("#ob-avatar").textContent = initials(plainName(me));
  $("#ob-hello").textContent = `Olá, ${first}!`;
  $("#ob-title").textContent = me.title || ROLE_LABEL[me.role];
  const highlights = {
    juiz: [["gavel", "O que aguarda sua decisão ou assinatura"], ["ballot", "A totalização da zona, seção por seção"], ["ticket", "As demandas do dia da eleição"]],
    promotor: [["scale", "Ocorrências que pedem acompanhamento"], ["ballot", "A totalização da zona, seção por seção"], ["ticket", "As demandas do dia da eleição"]],
    ase: [["shift", "Seus dias, horários e atividades"], ["certificate", "Suas declarações de trabalho"], ["doc", "Orientações e documentos do cartório"]],
    presidente: [["ballot", "Sua seção, sala e checklist do dia"], ["ticket", "Pedidos ao cartório sem lotar o grupo"], ["doc", "Orientações para mesários"]],
    adm_predio: [["school", "Seu local, seções e checklist"], ["ticket", "Demandas ao cartório: título, seção, material"], ["doc", "Orientações e avisos"]],
  }[me.role] || [
    ["ticket", "Demandas do dia da eleição, do pedido à resposta"],
    ["ballot", "Totalização da 23ª ZE, seção por seção"],
    ["shift", "Escala de ASE, presença e declarações"],
    ["school", "Locais, seções e documentos num lugar só"],
  ];
  $("#ob-highlights").innerHTML = highlights.map(([name, text]) => `<li>${icon(name)}<span>${esc(text)}</span></li>`).join("");
  $("#ob-current-field").hidden = me.linkFresh;
  $("#ob-phone").value = formatPhone(me.phone);
  $("#ob-email").value = me.email || "";
  $("#ob-tour").innerHTML = tabKeys()
    .slice(1)
    .concat(EDITORS.includes(me.role) ? ["locais"] : [])
    .map((key) => {
      const item = MODULES[key];
      return `<div class="tour-card">${icon(item.icon)}<div><strong>${esc(item.label)}</strong><small>${item.soon ? `Em breve · ${item.soon}` : "Disponível"}</small></div></div>`;
    })
    .join("");
  const apple = /iPhone|iPad/.test(navigator.userAgent);
  $("#ob-ios").hidden = !apple;
  $("#ob-install").hidden = !installPrompt;
  fetch("/api/app")
    .then((response) => response.json())
    .then((data) => ($("#ob-apk").hidden = apple || !data.apk))
    .catch(() => {});
  showView("onboarding-view");
  renderStep();
}
function renderStep() {
  const current = obSteps[obIndex];
  for (const step of $$(".ob-step")) step.hidden = step.dataset.step !== current;
  $("#ob-dots").innerHTML = obSteps
    .map((step, index) => `<li class="${index < obIndex ? "done" : index === obIndex ? "current" : ""}"><span class="sr-only">Etapa ${index + 1}</span></li>`)
    .join("");
  // A senha provisória precisa ser trocada: não dá para pular essa etapa.
  $("#ob-skip").hidden = current === "ready" || current === "password";
  const focus = { password: me.linkFresh ? "#ob-next" : "#ob-current", contacts: "#ob-phone" }[current];
  scrollTo({ top: 0 });
  if (focus) setTimeout(() => $(focus).focus(), 80);
}
function nextStep() {
  obIndex = Math.min(obIndex + 1, obSteps.length - 1);
  renderStep();
}
$("#onboarding-view").addEventListener("click", (event) => {
  if (event.target.closest("[data-ob-next]")) nextStep();
});
$("#ob-skip").addEventListener("click", () => {
  obIndex = me.mustChange ? obSteps.indexOf("password") : obSteps.length - 1;
  renderStep();
});
function strength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return value.length < 8 ? Math.min(score, 1) : score;
}
$("#ob-next").addEventListener("input", () => {
  const score = strength($("#ob-next").value);
  const labels = ["Muito curta", "Fraca", "Razoável", "Boa", "Forte", "Muito forte"];
  $("#ob-strength").style.width = `${(score / 5) * 100}%`;
  $("#ob-strength").dataset.level = String(score);
  $("#ob-strength-text").textContent = $("#ob-next").value ? `Força: ${labels[score]}` : "Força da senha";
});
async function changePassword(current, next, repeat) {
  if (next !== repeat) throw new Error("As duas senhas novas não são iguais.");
  await api("/api/auth/password", { method: "POST", body: { current, next } });
  me.mustChange = false;
  me.linkFresh = false;
}
$("#ob-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ob-password-error");
  try {
    await changePassword($("#ob-current").value, $("#ob-next").value, $("#ob-repeat").value);
    event.target.reset();
    toast("Senha criada.");
    nextStep();
  } catch (error) {
    errorAt("#ob-password-error", error.message);
  }
});
$("#ob-contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#ob-contact-error");
  try {
    me = { ...me, ...(await api("/api/auth/profile", { method: "PATCH", body: { phone: $("#ob-phone").value, email: $("#ob-email").value } })).user };
    nextStep();
  } catch (error) {
    errorAt("#ob-contact-error", error.message);
  }
});
$("#ob-install").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $("#ob-install").hidden = true;
});
$("#ob-finish").addEventListener("click", async () => {
  await api("/api/auth/onboarded", { method: "POST" }).catch(() => {});
  me.onboarded = true;
  history.replaceState(null, "", "/#inicio");
  showShell();
});
$("#first-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#first-error");
  try {
    await changePassword($("#first-current").value, $("#first-next").value, $("#first-repeat").value);
    event.target.reset();
    toast("Senha salva.");
    showShell();
  } catch (error) {
    errorAt("#first-error", error.message);
  }
});

/* ---------- Estrutura e menus ---------- */
function showShell() {
  showView("app-view");
  $("#top-role").textContent = me.title || ROLE_LABEL[me.role];
  $("#top-account").innerHTML = userAvatar(me);
  document.body.dataset.role = me.role;
  renderNav();
  go(location.hash.slice(1) || "inicio");
}
function navButton(key, withSoon = true) {
  const item = MODULES[key];
  return `<button type="button" data-go="${key}">${icon(item.icon)}<span>${esc(item.label)}</span>${withSoon && item.soon ? '<em class="soon">Em breve</em>' : ""}</button>`;
}
function renderNav() {
  const groups = navGroups();
  $("#side-nav").innerHTML =
    groups
      .map(
        (group) =>
          `<div class="nav-group">${group.label ? `<p class="nav-label">${esc(group.label)}</p>` : ""}${group.items.map((key) => navButton(key)).join("")}</div>`,
      )
      .join("") + `<div class="nav-foot">${navButton("conta")}</div>`;
  const tabs = tabKeys();
  $("#tabbar").innerHTML =
    tabs
      .map((key) => navButton(key, false).replace(`<span>${esc(MODULES[key].label)}</span>`, `<span>${TAB_LABEL[key] || esc(MODULES[key].label)}</span>`))
      .join("") +
    `<button type="button" data-more>${icon("more")}<span>Mais</span></button>`;
  $("#more-kicker").textContent = me.title || ROLE_LABEL[me.role];
  $("#more-body").innerHTML =
    groups
      .map(
        (group) =>
          `<div class="more-group">${group.label ? `<p class="nav-label">${esc(group.label)}</p>` : ""}<div class="more-grid">${group.items
            .map((key) => {
              const item = MODULES[key];
              return `<button type="button" class="more-item" data-go="${key}">${icon(item.icon)}<span>${esc(item.label)}</span>${item.soon ? `<em class="soon">${item.soon}</em>` : ""}</button>`;
            })
            .join("")}</div></div>`,
      )
      .join("") +
    `<div class="more-group"><p class="nav-label">Conta</p><div class="more-grid">${navButton("conta").replace('type="button"', 'type="button" class="more-item"')}<button type="button" class="more-item logout">${icon("logout")}<span>Sair</span></button></div></div>`;
  for (const button of $$("#more-body .logout")) button.addEventListener("click", logout);
}
function openMore() {
  $("#more-sheet").showModal();
}
function go(name) {
  if (!allowedSections().includes(name)) name = "inicio";
  section = name;
  const target = MODULES[name]?.soon ? "modulo" : name;
  for (const item of $$(".a-section")) item.hidden = item.id !== target;
  for (const button of $$("#side-nav [data-go], #tabbar [data-go]"))
    if (button.dataset.go === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  const more = !tabKeys().includes(name);
  $("#tabbar [data-more]")?.toggleAttribute("aria-current", more);
  history.replaceState(null, "", "/#" + name);
  scrollTo({ top: 0 });
  clearSelection();
  for (const button of $$("[data-edit]")) button.hidden = !EDITORS.includes(me.role);
  const loaders = {
    inicio: loadHome,
    agenda: loadAgenda,
    equipe: loadTeam,
    conta: loadProfile,
    painel: loadDashboard,
    fotos: loadPhotosSection,
    eventos: loadEvents,
    pessoas: loadPeople,
    textos: loadSettings,
    demandas: loadDemandas,
    totalizacao: loadTotalizacao,
    locais: loadLocais,
    documentos: loadDocumentos,
  };
  clearInterval(refreshTimer);
  if (MODULES[name]?.soon) renderModule(name);
  else loaders[name]?.();
}

/* ---------- Início ---------- */
let homeData = null;
async function loadHome() {
  const hour = new Date().getHours();
  const first = firstName(me);
  $("#hello-title").textContent = `${hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}, ${first}`;
  $("#hello-sub").textContent = `${me.title || ROLE_LABEL[me.role]} · 023ª Zona Eleitoral`;
  renderHomeModules();
  try {
    homeData = await api("/api/equipe/inicio");
    $("#hello-date").textContent = dateLong(homeData.today);
    renderCountdown();
    if (homeData.local)
      $("#hello-sub").textContent = `${me.title || ROLE_LABEL[me.role]} · ${homeData.local.nome}${me.secao ? ` · seção ${me.secao}` : ""}`;
    renderTimeline($("#home-marcos"), homeData.marcos.slice(0, 5));
    $("#home-team").innerHTML = homeData.team
      .map(
        (person) =>
          `<button type="button" class="team-chip" data-go="equipe">${userAvatar(person)}<span><strong>${esc(firstName(person))}</strong><small>${esc(person.title || ROLE_LABEL[person.role])}</small></span></button>`,
      )
      .join("");
  } catch (error) {
    $("#countdown").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function renderCountdown() {
  const next = homeData.marcos.find((marco) => marco.kind === "eleicao");
  const card = $("#countdown");
  if (!next) {
    card.innerHTML = `<span class="cd-icon">${icon("ballot")}</span><div><p class="cd-kicker">Eleições</p><strong class="cd-title">Sem eleição marcada</strong><p class="cd-sub">Cadastre as datas na Agenda.</p></div>`;
    return;
  }
  const days = daysBetween(homeData.today, next.date);
  const count = days === 0 ? "É hoje" : days === 1 ? "Amanhã" : `${days} dias`;
  card.innerHTML = `
    <div class="cd-main">
      <p class="cd-kicker">${icon("ballot")}${esc(next.title)}</p>
      <strong class="cd-count">${days > 1 ? `<span>faltam</span>` : ""}${count}</strong>
      <p class="cd-sub">${esc(dateLong(next.date))}${next.time ? ` · ${esc(next.time.replace(/^0/, "").replace(":", "h").replace("h00", "h"))}` : ""}</p>
      ${next.detail ? `<p class="cd-detail">${esc(next.detail)}</p>` : ""}
    </div>
    <svg class="cd-art" viewBox="0 0 320 240" aria-hidden="true"><use href="#art-urna" /></svg>`;
}
function renderTimeline(list, marcos) {
  list.innerHTML = marcos.length
    ? marcos
        .map((marco) => {
          const [label, chip] = KIND[marco.kind] || KIND.outro;
          const days = homeData ? daysBetween(homeData.today, marco.date) : null;
          return `<li class="tl-item${days === 0 ? " today" : ""}">
            <span class="tl-date"><b>${Number(marco.date.slice(8))}</b>${MONTHS[Number(marco.date.slice(5, 7)) - 1]}</span>
            <span class="tl-body"><strong>${esc(marco.title)}</strong><small>${days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`}${marco.time ? ` · ${esc(marco.time)}` : ""}</small></span>
            <span class="chip chip-tag ${chip}">${label}</span>
          </li>`;
        })
        .join("")
    : `<li class="empty-line">Nenhum marco pela frente. ${EDITORS.includes(me.role) ? "Inclua na Agenda." : ""}</li>`;
}
function renderHomeModules() {
  const keys = navGroups()
    .flatMap((group) => group.items)
    .filter((key) => !["inicio", "painel", "eventos", "pessoas", "textos", "fotos"].includes(key));
  $("#home-modules").innerHTML = keys
    .map((key) => {
      const item = MODULES[key];
      return `<button type="button" class="module-card${item.soon ? " is-soon" : ""}" data-go="${key}">
        <span class="module-icon">${icon(item.icon)}</span>
        <strong>${esc(item.label)}</strong>
        <small>${item.soon ? `Em breve · ${item.soon}` : "Disponível"}</small>
      </button>`;
    })
    .join("");
}

/* ---------- Módulo em preparação ---------- */
function renderModule(key) {
  const item = MODULES[key];
  $("#modulo").innerHTML = `
    <div class="a-head"><div>
      <p class="kicker-dark">${esc(item.group)}</p>
      <h1>${esc(item.label)}</h1>
      <p class="muted">${esc(item.lede)}</p>
    </div></div>
    <div class="soon-hero">
      <span class="soon-icon">${icon(item.icon)}</span>
      <div>
        <span class="chip chip-tag chip-yellow">Em breve · previsto para ${esc(item.soon)}</span>
        <p>Este módulo está em preparação para o 2º turno. Veja o que ele vai fazer:</p>
      </div>
    </div>
    <div class="soon-grid">${item.features
      .map(([name, title, text]) => `<div class="soon-item"><span>${icon(name)}</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></div>`)
      .join("")}</div>`;
}

/* ---------- Agenda ---------- */
let marcos = [],
  editingMarco = null;
async function loadAgenda() {
  const list = $("#agenda-list");
  try {
    if (!homeData) homeData = await api("/api/equipe/inicio");
    marcos = (await api("/api/equipe/marcos")).marcos;
    const months = {};
    for (const marco of marcos) (months[marco.date.slice(0, 7)] ||= []).push(marco);
    const canEdit = EDITORS.includes(me.role);
    list.innerHTML = Object.keys(months).length
      ? Object.entries(months)
          .map(
            ([month, items]) => `<section class="agenda-month">
              <h2>${new Date(month + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
              <ol class="timeline">${items
                .map((marco) => {
                  const [label, chip] = KIND[marco.kind] || KIND.outro;
                  const past = marco.date < homeData.today;
                  return `<li class="tl-item${past ? " past" : ""}${marco.date === homeData.today ? " today" : ""}">
                    <span class="tl-date"><b>${Number(marco.date.slice(8))}</b>${MONTHS[Number(marco.date.slice(5, 7)) - 1]}</span>
                    <span class="tl-body"><strong>${esc(marco.title)}</strong><small>${esc(dateLong(marco.date))}${marco.time ? ` · ${esc(marco.time)}` : ""}</small>${marco.detail ? `<p>${esc(marco.detail)}</p>` : ""}</span>
                    <span class="tl-side"><span class="chip chip-tag ${chip}">${label}</span>${canEdit ? `<button class="icon-btn" type="button" data-marco="${marco.id}" aria-label="Editar">${icon("edit")}</button>` : ""}</span>
                  </li>`;
                })
                .join("")}</ol>
            </section>`,
          )
          .join("")
      : `<div class="empty-state">${icon("calendar")}<strong>Agenda vazia</strong><p>Inclua reuniões, preparação de urnas, prazos e as datas da eleição.</p></div>`;
  } catch (error) {
    list.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#agenda-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-marco]");
  if (button) openMarco(marcos.find((marco) => marco.id === button.dataset.marco));
});
$("#marco-new").addEventListener("click", () => openMarco());
function openMarco(marco = null) {
  editingMarco = marco;
  $("#mc-title").textContent = marco ? "Editar marco" : "Novo marco";
  $("#mc-name").value = marco?.title || "";
  $("#mc-date").value = marco?.date || homeData?.today || "";
  $("#mc-time").value = marco?.time || "";
  $("#mc-kind").value = marco?.kind || "preparacao";
  $("#mc-detail").value = marco?.detail || "";
  $("#mc-delete").hidden = !marco;
  errorAt("#mc-error");
  $("#marco-dialog").showModal();
}
$("#marco-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#mc-error");
  const body = {
    title: $("#mc-name").value,
    date: $("#mc-date").value,
    time: $("#mc-time").value,
    kind: $("#mc-kind").value,
    detail: $("#mc-detail").value,
  };
  try {
    await api(editingMarco ? `/api/equipe/marcos/${editingMarco.id}` : "/api/equipe/marcos", {
      method: editingMarco ? "PATCH" : "POST",
      body,
    });
    $("#marco-dialog").close();
    toast(editingMarco ? "Marco atualizado." : "Marco incluído na agenda.");
    homeData = null;
    loadAgenda();
  } catch (error) {
    errorAt("#mc-error", error.message);
  }
});
$("#mc-delete").addEventListener("click", async () => {
  if (!editingMarco || !(await confirmBox("Excluir marco?", `“${editingMarco.title}” sai da agenda de todos.`))) return;
  try {
    await api(`/api/equipe/marcos/${editingMarco.id}`, { method: "DELETE" });
    $("#marco-dialog").close();
    toast("Marco excluído.");
    loadAgenda();
  } catch (error) {
    errorAt("#mc-error", error.message);
  }
});

/* ---------- Equipe ---------- */
let team = [],
  editingUser = null;
async function loadTeam() {
  const admin = GESTAO.includes(me.role);
  $("#user-new").hidden = !admin;
  $("#team-sub").textContent = admin
    ? "Contas da equipe, cargos e links de acesso."
    : "Quem trabalha com você, com cargo e contato.";
  try {
    team = (await api("/api/equipe/users")).users;
    $("#team-list").innerHTML = team
      .map((person) => {
        const status = admin
          ? !person.active
            ? `<span class="chip chip-tag chip-red">Inativa</span>`
            : !person.onboarded
              ? `<span class="chip chip-tag chip-blue">Aguardando 1º acesso</span>`
              : ""
          : "";
        const phone = whatsappNumber(person.phone);
        return `<article class="person-card${person.active === false ? " inactive" : ""}">
          ${userAvatar(person, " avatar-lg")}
          <div class="person-info">
            <strong>${esc(person.name)}${person.id === me.id ? ' <small class="you">você</small>' : ""}</strong>
            <small>${esc(person.title || ROLE_LABEL[person.role])}</small>
            <span class="person-chips">${roleChip(person)}${status}</span>
          </div>
          <div class="person-actions">
            ${phone ? `<a class="icon-btn" href="https://wa.me/${phone}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(person.name)}">${icon("chat-send")}</a>` : ""}
            ${person.email ? `<a class="icon-btn" href="mailto:${esc(person.email)}" aria-label="E-mail de ${esc(person.name)}">${icon("out")}</a>` : ""}
            ${admin ? `<button class="icon-btn" type="button" data-user-link="${person.id}" aria-label="Gerar link de acesso">${icon("link")}</button><button class="icon-btn" type="button" data-user="${person.id}" aria-label="Editar conta">${icon("edit")}</button>` : ""}
          </div>
        </article>`;
      })
      .join("");
  } catch (error) {
    $("#team-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#team-list").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-user]");
  if (edit) return openUser(team.find((person) => person.id === edit.dataset.user));
  const link = event.target.closest("[data-user-link]");
  if (link) shareLink(team.find((person) => person.id === link.dataset.userLink));
});
$("#user-new").addEventListener("click", () => openUser());
function openUser(person = null) {
  editingUser = person;
  $("#us-title").textContent = person ? person.name : "Nova conta";
  $("#us-name").value = person?.name || "";
  $("#us-username").value = person?.username || "";
  $("#us-username").disabled = Boolean(person);
  $("#us-title-input").value = person?.title || "";
  $("#us-role").value = person?.role || "equipe";
  $("#us-phone").value = formatPhone(person?.phone);
  $("#us-email").value = person?.email || "";
  $("#us-active-line").hidden = !person;
  syncUserPlace().then(() => {
    $("#us-local").value = person?.localId ? String(person.localId) : "";
    $("#us-secao").value = person?.secao || "";
  });
  $("#us-active").checked = person ? person.active : true;
  $("#us-link").hidden = !person;
  errorAt("#us-error");
  $("#user-dialog").showModal();
}
$("#user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#us-error");
  const body = {
    name: $("#us-name").value,
    title: $("#us-title-input").value,
    role: $("#us-role").value,
    phone: $("#us-phone").value,
    email: $("#us-email").value,
    localId: $("#us-lugar").hidden ? null : $("#us-local").value || null,
    secao: $("#us-secao-field").hidden || $("#us-lugar").hidden ? null : $("#us-secao").value || null,
  };
  try {
    if (editingUser) {
      await api(`/api/equipe/users/${editingUser.id}`, { method: "PATCH", body: { ...body, active: $("#us-active").checked } });
      $("#user-dialog").close();
      toast("Conta atualizada.");
      loadTeam();
    } else {
      const data = await api("/api/equipe/users", { method: "POST", body: { ...body, username: $("#us-username").value } });
      $("#user-dialog").close();
      await loadTeam();
      shareLink(data.user);
    }
  } catch (error) {
    errorAt("#us-error", error.message);
  }
});
$("#us-link").addEventListener("click", () => {
  $("#user-dialog").close();
  shareLink(editingUser);
});
async function shareLink(person) {
  try {
    const data = await api(`/api/equipe/users/${person.id}/link`, { method: "POST" });
    const first = firstName(person);
    const message = `Olá, ${first}! Este é o seu acesso à área da equipe da 023ª Zona Eleitoral (Zona 023). Toque no link para entrar. Ele vale por 72 horas e funciona uma única vez:\n\n${data.url}`;
    $("#sh-title").textContent = `Enviar link para ${first}`;
    $("#sh-text").textContent = person.phone
      ? `O WhatsApp abre direto na conversa com ${formatPhone(person.phone)}.`
      : "Sem celular cadastrado: o WhatsApp vai pedir para escolher o contato.";
    $("#sh-url").textContent = data.url;
    $("#sh-whatsapp").href = `https://wa.me/${whatsappNumber(person.phone)}?text=${encodeURIComponent(message)}`;
    $("#sh-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(message);
        toast("Mensagem com o link copiada.");
      } catch {
        toast("Não foi possível copiar. Selecione o link e copie.", false);
      }
    };
    $("#share-dialog").showModal();
  } catch (error) {
    toast(error.message, false);
  }
}

/* ---------- Perfil ---------- */
async function loadProfile() {
  $("#profile-avatar").textContent = initials(plainName(me));
  $("#profile-avatar").className = `avatar avatar-xl c${seed(me.id) % 4}`;
  $("#profile-name").textContent = me.name;
  $("#profile-title").textContent = me.title || ROLE_LABEL[me.role];
  $("#account-user").textContent = `Usuário: ${me.username} · Perfil: ${ROLE_LABEL[me.role]}`;
  $("#pf-name").value = me.name;
  $("#pf-phone").value = formatPhone(me.phone);
  $("#pf-email").value = me.email;
  $("#pw-current-field").hidden = me.linkFresh;
  try {
    const { sessions } = await api("/api/auth/sessions");
    $("#sessions-list").innerHTML = sessions
      .map(
        (row) => `<div class="mini-row session-row">
          <span class="kpi-icon">${icon(row.label.startsWith("Android") || row.label.startsWith("iPhone") ? "phone-download" : "dashboard")}</span>
          <span><strong>${esc(row.label)}${row.current ? ' <small class="you">este aparelho</small>' : ""}</strong>
          <small>Entrou ${new Date(row.created_at).toLocaleDateString("pt-BR")} ${row.method === "link" ? "por link" : "com senha"} · até ${new Date(row.expires_at).toLocaleDateString("pt-BR")}</small></span>
        </div>`,
      )
      .join("");
    $("#sessions-revoke").hidden = sessions.length < 2;
  } catch (error) {
    $("#sessions-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#pf-error");
  try {
    me = {
      ...me,
      ...(await api("/api/auth/profile", {
        method: "PATCH",
        body: { name: $("#pf-name").value, phone: $("#pf-phone").value, email: $("#pf-email").value },
      })).user,
    };
    $("#top-account").innerHTML = userAvatar(me);
    toast("Dados salvos.");
    loadProfile();
  } catch (error) {
    errorAt("#pf-error", error.message);
  }
});
$("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#pw-error");
  try {
    await changePassword($("#pw-current").value, $("#pw-next").value, $("#pw-repeat").value);
    event.target.reset();
    toast("Senha trocada. Os outros aparelhos foram desconectados.");
    loadProfile();
  } catch (error) {
    errorAt("#pw-error", error.message);
  }
});
$("#sessions-revoke").addEventListener("click", async () => {
  if (!(await confirmBox("Sair dos outros aparelhos?", "As sessões abertas em outros celulares e computadores serão encerradas.", "Sair dos outros"))) return;
  try {
    const { count } = await api("/api/auth/sessions", { method: "DELETE" });
    toast(count ? `${count} ${count === 1 ? "aparelho desconectado" : "aparelhos desconectados"}.` : "Nenhum outro aparelho conectado.");
    loadProfile();
  } catch (error) {
    toast(error.message, false);
  }
});
$("#replay-onboarding").addEventListener("click", startOnboarding);

/* ---------- Locais (cache compartilhado por demandas, contas e locais) ---------- */
let locaisCache = null;
async function getLocais() {
  if (!locaisCache) locaisCache = (await api("/api/eleicao/locais")).locais;
  return locaisCache;
}
const mapsUrl = (local) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${local.endereco}, ${local.bairro}, Rio de Janeiro - RJ, ${local.cep}`)}`;
const hora = (iso) => (iso ? iso.slice(11, 16) : "");
const sinceLabel = (iso) => {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return minutes < 1 ? "agora" : minutes < 60 ? `há ${minutes} min` : minutes < 1440 ? `há ${Math.round(minutes / 60)} h` : new Date(iso).toLocaleDateString("pt-BR");
};
let refreshTimer = null;

/* ---------- Demandas ---------- */
let demandas = [],
  demandaTipos = {},
  dmStatus = "ativas",
  viewing = null;
const DM_STATUS = {
  aberta: ["Aberta", "chip-yellow"],
  em_atendimento: ["Em atendimento", "chip-blue"],
  concluida: ["Concluída", "chip-green"],
  cancelada: ["Cancelada", ""],
};
const DM_ICON = {
  localizar_eleitor: "search",
  material: "box",
  urna: "ballot",
  mesario: "users",
  infraestrutura: "school",
  policiamento: "police",
  filas: "clock",
  procedimento: "help",
  outro: "ticket",
};
async function loadDemandas() {
  const cartorio = EDITORS.includes(me.role);
  $("#dm-new").hidden = !(cartorio || ["presidente", "adm_predio"].includes(me.role));
  $("#dm-sub").textContent = cartorio
    ? "Pedidos dos locais de votação: título, seção, material, urna, mesário, estrutura. Registre, assuma e conclua com a resposta."
    : AUTORIDADES.includes(me.role)
      ? "Acompanhe os pedidos dos locais e o atendimento do cartório."
      : "Peça ao cartório o que precisar. A resposta chega aqui, sem lotar o grupo.";
  try {
    const data = await api("/api/eleicao/demandas");
    demandas = data.demandas;
    demandaTipos = data.tipos;
    $("#dm-count-ativas").textContent = (data.contagem.aberta || 0) + (data.contagem.em_atendimento || 0);
    $("#dm-count-concluida").textContent = data.contagem.concluida || 0;
    renderDemandas();
  } catch (error) {
    $("#dm-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => section === "demandas" && !$("#dm-view").open && !$("#dm-dialog").open && loadDemandas(), 30000);
}
function renderDemandas() {
  const list = demandas.filter((d) =>
    dmStatus === "ativas" ? ["aberta", "em_atendimento"].includes(d.status) : !dmStatus || d.status === dmStatus,
  );
  $("#dm-list").innerHTML = list.length
    ? list
        .map((d) => {
          const [label, chip] = DM_STATUS[d.status];
          return `<button type="button" class="dm-card prio-${d.prioridade} st-${d.status}" data-demanda="${d.id}">
            <span class="dm-icon">${icon(DM_ICON[d.tipo] || "ticket")}</span>
            <span class="dm-main">
              <span class="dm-top"><b>#${d.numero}</b> ${esc(d.tipoNome)}${d.prioridade !== "normal" ? ` <span class="chip chip-tag chip-red">${d.prioridade === "urgente" ? "Urgente" : "Alta"}</span>` : ""}</span>
              <strong>${esc(d.descricao)}</strong>
              <small>${esc([d.local?.nome, d.secao ? `seção ${d.secao}` : "", d.solicitante].filter(Boolean).join(" · "))}</small>
              ${d.resposta ? `<small class="dm-answer">${icon("check-circle")}${esc(d.resposta)}</small>` : ""}
            </span>
            <span class="dm-side"><span class="chip chip-tag ${chip}">${label}</span><small>${sinceLabel(d.criada_em)}</small>${d.responsavel_nome ? `<small>${esc(d.responsavel_nome.replace(/^(dra?|sra?)\.?\s+/i, "").split(" ")[0])}</small>` : ""}</span>
          </button>`;
        })
        .join("")
    : `<div class="empty-state">${icon("ticket")}<strong>${dmStatus === "ativas" ? "Nenhuma demanda em aberto" : "Nada por aqui"}</strong><p>No dia da eleição, cada pedido dos locais vira um cartão com responsável e resposta.</p></div>`;
}
for (const button of $$("[data-dm-status]"))
  button.addEventListener("click", () => {
    dmStatus = button.dataset.dmStatus;
    for (const other of $$("[data-dm-status]")) other.setAttribute("aria-pressed", String(other === button));
    renderDemandas();
  });
$("#dm-new").addEventListener("click", async () => {
  const cartorio = EDITORS.includes(me.role);
  const tipos = Object.keys(demandaTipos).length ? demandaTipos : (await api("/api/eleicao/demandas")).tipos;
  $("#dm-tipos").innerHTML = Object.entries(tipos)
    .map(([key, label], index) => `<label class="dm-tipo"><input type="radio" name="dm-tipo" value="${key}"${index === 0 ? " checked" : ""} />${icon(DM_ICON[key])}<span>${esc(label)}</span></label>`)
    .join("");
  const locais = await getLocais();
  $("#dm-local").innerHTML = `<option value="">Escolha</option>` + locais.map((l) => `<option value="${l.id}">${esc(l.nome)}</option>`).join("");
  $("#dm-lugar").hidden = !cartorio;
  $("#dm-origem").hidden = !cartorio;
  $("#dm-form").reset();
  $("#dm-form [name=dm-tipo]").checked = true;
  syncEleitorField();
  errorAt("#dm-error");
  $("#dm-dialog").showModal();
});
function syncEleitorField() {
  $("#dm-eleitor-field").hidden = $("#dm-form [name=dm-tipo]:checked")?.value !== "localizar_eleitor";
}
$("#dm-tipos").addEventListener("change", syncEleitorField);
$("#dm-secao").addEventListener("input", async () => {
  const secao = Number($("#dm-secao").value);
  const local = (await getLocais()).find((l) => l.secoes.some((x) => x.secao === secao));
  if (local) $("#dm-local").value = String(local.id);
});
$("#dm-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#dm-error");
  try {
    await api("/api/eleicao/demandas", {
      method: "POST",
      body: {
        tipo: $("#dm-form [name=dm-tipo]:checked")?.value,
        descricao: $("#dm-descricao").value,
        localId: $("#dm-local").value,
        secao: $("#dm-secao").value,
        dadosEleitor: $("#dm-eleitor-field").hidden ? "" : $("#dm-eleitor").value,
        solicitante: $("#dm-solicitante").value,
        canal: $("#dm-canal").value,
        prioridade: $("#dm-prioridade").value,
      },
    });
    $("#dm-dialog").close();
    toast("Demanda registrada.");
    loadDemandas();
  } catch (error) {
    errorAt("#dm-error", error.message);
  }
});
$("#dm-list").addEventListener("click", (event) => {
  const card = event.target.closest("[data-demanda]");
  if (card) openDemanda(demandas.find((d) => d.id === card.dataset.demanda));
});
function openDemanda(d) {
  viewing = d;
  const cartorio = EDITORS.includes(me.role);
  const [label] = DM_STATUS[d.status];
  $("#dv-kicker").textContent = `#${d.numero} · ${label}`;
  $("#dv-title").textContent = d.tipoNome;
  const linha = (nome, valor) => (valor ? `<div><dt>${nome}</dt><dd>${esc(valor)}</dd></div>` : "");
  const quandoLabel = (iso) => (iso ? `${new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "");
  $("#dv-info").innerHTML = `<p class="dv-desc">${esc(d.descricao)}</p><dl>
    ${linha("Local", d.local?.nome)}${linha("Seção", d.secao)}${linha("Quem pediu", d.solicitante)}${linha("Chegou por", d.canal)}
    ${linha("Dados do eleitor", d.dados_eleitor)}${linha("Aberta", `${quandoLabel(d.criada_em)} · ${d.aberta_por_nome || ""}`)}
    ${linha("Responsável", d.responsavel_nome)}${linha("Concluída", quandoLabel(d.concluida_em))}${!cartorio ? linha("Resposta", d.resposta) : ""}</dl>`;
  $("#dv-resposta").value = d.resposta || "";
  $("#dv-resposta-field").hidden = !cartorio;
  const botao = (acao, texto, classe) => `<button class="btn ${classe}" type="button" data-acao="${acao}">${texto}</button>`;
  $("#dv-actions").innerHTML = cartorio
    ? d.status === "aberta"
      ? botao("cancelar", "Cancelar", "btn-outline") + botao("assumir", "Assumir", "btn-outline") + botao("concluir", "Concluir", "btn-primary btn-grow")
      : d.status === "em_atendimento"
        ? botao("atualizar", "Salvar resposta", "btn-outline") + botao("concluir", "Concluir", "btn-primary btn-grow")
        : botao("reabrir", "Reabrir", "btn-outline btn-grow")
    : d.status === "aberta" && d.aberta_por === me.id
      ? botao("cancelar", "Cancelar pedido", "btn-outline btn-grow")
      : `<button class="btn btn-outline btn-grow" type="button" data-close>Fechar</button>`;
  errorAt("#dv-error");
  $("#dm-view").showModal();
}
$("#dv-actions").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-acao]");
  if (!button || !viewing) return;
  try {
    await api(`/api/eleicao/demandas/${viewing.id}`, {
      method: "PATCH",
      body: { acao: button.dataset.acao, resposta: $("#dv-resposta").value },
    });
    $("#dm-view").close();
    toast({ assumir: "Demanda assumida.", concluir: "Demanda concluída.", cancelar: "Demanda cancelada.", reabrir: "Demanda reaberta.", atualizar: "Resposta salva." }[button.dataset.acao]);
    loadDemandas();
  } catch (error) {
    errorAt("#dv-error", error.message);
  }
});

/* ---------- Totalização ---------- */
let tt = null;
async function loadTotalizacao(pleito = $("#tt-pleito").value || "") {
  try {
    tt = await api("/api/eleicao/totalizacao" + (pleito ? `?pleito=${pleito}` : ""));
    renderTotalizacao();
  } catch (error) {
    $("#tt-body").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => section === "totalizacao" && loadTotalizacao(), 60000);
}
function renderTotalizacao() {
  if (!tt.atual) {
    $("#tt-body").innerHTML = `<div class="empty-state">${icon("ballot")}<strong>Aguardando o TSE</strong><p>Os dados aparecem quando o portal de resultados publica o pleito.</p></div>`;
    return;
  }
  $("#tt-pleito").innerHTML = tt.pleitos.map((p) => `<option value="${p.pleito}"${p.pleito === tt.atual.pleito ? " selected" : ""}>${esc(p.rotulo)}</option>`).join("");
  const pct = Math.round((tt.totalizadas / tt.total) * 1000) / 10;
  const R = 54,
    C = 2 * Math.PI * R;
  // Gráfico de seções acumuladas por horário (barras de 10 minutos).
  const max = tt.total;
  const W = 420,
    H = 190,
    n = Math.max(tt.serie.length, 1),
    bw = Math.min(40, (W - 40) / n - 6);
  const bars = tt.serie
    .map((p, i) => {
      const h = Math.max(2, (p.acumulado / max) * (H - 40));
      const x = 30 + i * ((W - 40) / n);
      return `<g><rect class="tt-bar" x="${x}" y="${H - 22 - h}" width="${bw}" height="${h}" rx="5"><title>${p.hora}: ${p.acumulado} seções</title></rect>
        <text class="tt-x" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${p.hora}</text>
        <text class="tt-v" x="${x + bw / 2}" y="${H - 28 - h}" text-anchor="middle">${p.acumulado}</text></g>`;
    })
    .join("");
  const locais = [...tt.locais].sort((a, b) => a.totalizadas / a.total - b.totalizadas / b.total || a.nome.localeCompare(b.nome));
  $("#tt-body").innerHTML = `
    <div class="tt-grid">
      <article class="tt-hero">
        <svg class="tt-ring" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r="${R}" class="tt-ring-bg" />
          <circle cx="64" cy="64" r="${R}" class="tt-ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - tt.totalizadas / tt.total)}" />
        </svg>
        <div>
          <p class="cd-kicker">${icon("ballot")}${esc(tt.atual.rotulo)}</p>
          <strong class="tt-count">${tt.totalizadas}<span>/${tt.total}</span></strong>
          <p class="cd-sub">seções totalizadas · ${String(pct).replace(".", ",")}%</p>
          <p class="cd-detail">${tt.primeira ? `Primeira às ${hora(tt.primeira)} · última às ${hora(tt.ultima)}` : "Nenhuma seção totalizada ainda"} · consultado ${sinceLabel(tt.atual.consultado_em)}</p>
          ${tt.atual.erro ? `<p class="tt-error">${icon("alert")}${esc(tt.atual.erro)}</p>` : ""}
        </div>
      </article>
      <article class="a-card tt-chart">
        <div class="card-head"><h2>${icon("clock")}Seções totalizadas ao longo da noite</h2></div>
        ${tt.serie.length ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Seções acumuladas por horário">${bars}</svg>` : `<p class="empty-line">O gráfico aparece com as primeiras seções.</p>`}
      </article>
    </div>
    <h2 class="tt-sub">Por local de votação</h2>
    <div class="tt-locais">${locais
      .map((l) => {
        const done = l.totalizadas === l.total;
        return `<details class="tt-local${done ? " done" : ""}">
          <summary>
            <span class="tt-area">${l.area}</span>
            <span class="tt-name"><strong>${esc(l.nome)}</strong><small>${l.totalizadas}/${l.total} seções${l.ultima ? ` · última às ${hora(l.ultima)}` : ""}</small></span>
            <span class="tt-meter"><span style="width:${(l.totalizadas / l.total) * 100}%"></span></span>
          </summary>
          <div class="tt-secoes">${l.secoes
            .map((x) => `<span class="tt-secao ${x.status === "Totalizada" ? "ok" : x.status === "Aguardando" ? "wait" : "rec"}" title="${esc(x.status)}"><b>${x.secao}</b>${x.recebido ? hora(x.recebido) : "—"}</span>`)
            .join("")}</div>
        </details>`;
      })
      .join("")}</div>
    <p class="muted small tt-source">Fonte: portal público de resultados do TSE (arquivos de urna por seção, município 60011, zona 0023). O horário é o do recebimento do boletim pelo TSE.</p>`;
}
$("#tt-pleito").addEventListener("change", () => loadTotalizacao($("#tt-pleito").value));
$("#tt-refresh").addEventListener("click", async () => {
  $("#tt-refresh").disabled = true;
  try {
    tt = await api("/api/eleicao/totalizacao/atualizar" + ($("#tt-pleito").value ? `?pleito=${$("#tt-pleito").value}` : ""), { method: "POST" });
    renderTotalizacao();
    toast("Totalização atualizada.");
  } catch (error) {
    toast(error.message, false);
  } finally {
    $("#tt-refresh").disabled = false;
  }
});

/* ---------- Locais e seções ---------- */
let editingLocal = null;
async function loadLocais() {
  try {
    locaisCache = (await api("/api/eleicao/locais")).locais;
    renderLocais();
  } catch (error) {
    $("#lc-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function renderLocais() {
  const q = normalizeText($("#lc-search").value);
  const canEdit = EDITORS.includes(me.role);
  const list = locaisCache.filter(
    (l) => !q || normalizeText(`${l.nome} ${l.bairro} ${l.endereco}`).includes(q) || l.secoes.some((x) => String(x.secao) === q),
  );
  $("#lc-sub").textContent = `${locaisCache.length} colégios · ${locaisCache.reduce((n, l) => n + l.secoes.length, 0)} seções · áreas A a N`;
  $("#lc-list").innerHTML = list.length
    ? list
        .map(
          (l) => `<article class="lc-card">
          <header>
            <span class="tt-area">${l.area}</span>
            <div><strong>${esc(l.nome)}</strong><small>${esc(l.endereco)} · ${esc(l.bairro)} · ${esc(l.bpm)} BPM</small></div>
          </header>
          <div class="lc-secoes">${l.secoes.map((x) => `<span class="lc-secao${String(x.secao) === q ? " hit" : ""}"><b>${x.secao}</b>${x.sala ? esc(x.sala) : ""}</span>`).join("")}</div>
          ${l.guarda || l.acessibilidade || l.observacao ? `<p class="lc-info">${[l.guarda && `Guarda: ${l.guarda}`, l.acessibilidade && `Acessibilidade: ${l.acessibilidade}`, l.observacao].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
          <footer>
            <span class="muted small">${l.secoes.length} seções${l.demandasAbertas ? ` · <b class="lc-alert">${l.demandasAbertas} demanda(s) aberta(s)</b>` : ""}</span>
            <span class="lc-actions">
              <a class="icon-btn" href="${mapsUrl(l)}" target="_blank" rel="noopener" aria-label="Abrir no mapa">${icon("out")}</a>
              ${canEdit ? `<button class="icon-btn" type="button" data-local="${l.id}" aria-label="Editar local">${icon("edit")}</button>` : ""}
            </span>
          </footer>
        </article>`,
        )
        .join("")
    : `<div class="empty-state">${icon("school")}<strong>Nenhum local encontrado</strong><p>Busque pelo número da seção, o nome do colégio ou o bairro.</p></div>`;
}
const normalizeText = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
$("#lc-search").addEventListener("input", () => locaisCache && renderLocais());
$("#lc-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-local]");
  if (!button) return;
  editingLocal = locaisCache.find((l) => l.id === Number(button.dataset.local));
  $("#lc-title").textContent = editingLocal.nome;
  $("#lc-kicker").textContent = `Área ${editingLocal.area} · ${editingLocal.bairro}`;
  $("#lc-guarda").value = editingLocal.guarda;
  $("#lc-acess").value = editingLocal.acessibilidade;
  $("#lc-obs").value = editingLocal.observacao;
  $("#lc-salas").innerHTML = editingLocal.secoes
    .map((x) => `<label class="lc-sala"><b>${x.secao}</b><input data-sala="${x.secao}" maxlength="60" value="${esc(x.sala)}" placeholder="Sala" /></label>`)
    .join("");
  errorAt("#lc-error");
  $("#lc-dialog").showModal();
});
$("#lc-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#lc-error");
  try {
    await api(`/api/eleicao/locais/${editingLocal.id}`, {
      method: "PATCH",
      body: { guarda: $("#lc-guarda").value, acessibilidade: $("#lc-acess").value, observacao: $("#lc-obs").value },
    });
    for (const input of $$("[data-sala]")) {
      const atual = editingLocal.secoes.find((x) => x.secao === Number(input.dataset.sala));
      if (atual.sala !== input.value.trim())
        await api(`/api/eleicao/secoes/${input.dataset.sala}`, { method: "PATCH", body: { sala: input.value, observacao: atual.observacao } });
    }
    $("#lc-dialog").close();
    toast("Local atualizado.");
    loadLocais();
  } catch (error) {
    errorAt("#lc-error", error.message);
  }
});

/* ---------- Documentos ---------- */
let docs = [],
  docCategorias = {},
  editingDoc = null;
const DOC_ICON = { pdf: "doc", xls: "dashboard", xlsx: "dashboard", csv: "dashboard", ods: "dashboard", jpg: "photos", jpeg: "photos", png: "photos" };
const VIS_LABEL = { cartorio: "Só o cartório", autoridades: "Cartório e autoridades", todos: "Todos" };
async function loadDocumentos() {
  try {
    const data = await api("/api/documentos");
    docs = data.documentos;
    docCategorias = data.categorias;
    $("#doc-new").hidden = !data.podeEnviar;
    const grupos = {};
    for (const d of docs) (grupos[d.categoria] ||= []).push(d);
    $("#doc-list").innerHTML = docs.length
      ? Object.entries(docCategorias)
          .filter(([key]) => grupos[key])
          .map(
            ([key, label]) => `<section class="doc-group"><h2>${esc(label)}</h2>${grupos[key]
              .map(
                (d) => `<article class="doc-card">
                <span class="doc-icon ext-${d.extensao}">${icon(DOC_ICON[d.extensao] || "doc")}<b>${d.extensao.toUpperCase()}</b></span>
                <div class="doc-main"><strong>${esc(d.titulo)}</strong>${d.descricao ? `<p>${esc(d.descricao)}</p>` : ""}
                  <small>${size(d.bytes)} · ${new Date(d.criado_em).toLocaleDateString("pt-BR")}${data.podeEnviar ? ` · ${VIS_LABEL[d.visibilidade]}` : ""}</small></div>
                <div class="doc-actions">
                  ${d.extensao === "pdf" ? `<a class="icon-btn" href="${d.url}?ver" target="_blank" rel="noopener" aria-label="Abrir">${icon("eye")}</a>` : ""}
                  <a class="icon-btn" href="${d.url}" aria-label="Baixar">${icon("download")}</a>
                  ${data.podeEnviar ? `<button class="icon-btn" type="button" data-doc="${d.id}" aria-label="Editar">${icon("edit")}</button>` : ""}
                </div>
              </article>`,
              )
              .join("")}</section>`,
          )
          .join("")
      : `<div class="empty-state">${icon("doc")}<strong>Biblioteca vazia</strong><p>${data.podeEnviar ? "Envie o planejamento logístico, manuais e avisos." : "Os documentos do cartório aparecem aqui."}</p></div>`;
  } catch (error) {
    $("#doc-list").innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}
function openDoc(doc = null) {
  editingDoc = doc;
  $("#doc-title").textContent = doc ? "Editar documento" : "Enviar arquivo";
  $("#doc-file-field").hidden = Boolean(doc);
  $("#doc-file").value = "";
  $("#doc-titulo").value = doc?.titulo || "";
  $("#doc-descricao").value = doc?.descricao || "";
  $("#doc-categoria").innerHTML = Object.entries(docCategorias).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("#doc-categoria").value = doc?.categoria || "orientacoes";
  $("#doc-visibilidade").value = doc?.visibilidade || "cartorio";
  $("#doc-delete").hidden = !doc;
  $("#doc-submit").textContent = doc ? "Salvar" : "Enviar";
  errorAt("#doc-error");
  $("#doc-dialog").showModal();
}
$("#doc-new").addEventListener("click", () => openDoc());
$("#doc-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-doc]");
  if (button) openDoc(docs.find((d) => d.id === button.dataset.doc));
});
$("#doc-file").addEventListener("change", () => {
  const file = $("#doc-file").files[0];
  if (file && !$("#doc-titulo").value) $("#doc-titulo").value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
});
$("#doc-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorAt("#doc-error");
  const button = $("#doc-submit");
  button.disabled = true;
  try {
    if (editingDoc) {
      await api(`/api/documentos/${editingDoc.id}`, {
        method: "PATCH",
        body: { titulo: $("#doc-titulo").value, descricao: $("#doc-descricao").value, categoria: $("#doc-categoria").value, visibilidade: $("#doc-visibilidade").value },
      });
    } else {
      const file = $("#doc-file").files[0];
      if (!file) throw new Error("Escolha um arquivo.");
      const form = new FormData();
      form.set("arquivo", file);
      for (const key of ["titulo", "descricao", "categoria", "visibilidade"]) form.set(key, $("#doc-" + key).value);
      const response = await fetch("/api/documentos", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar.");
    }
    $("#doc-dialog").close();
    toast(editingDoc ? "Documento atualizado." : "Documento enviado.");
    loadDocumentos();
  } catch (error) {
    errorAt("#doc-error", error.message);
  } finally {
    button.disabled = false;
  }
});
$("#doc-delete").addEventListener("click", async () => {
  if (!editingDoc || !(await confirmBox("Excluir documento?", `“${editingDoc.titulo}” sai da biblioteca de todos.`))) return;
  try {
    await api(`/api/documentos/${editingDoc.id}`, { method: "DELETE" });
    $("#doc-dialog").close();
    toast("Documento excluído.");
    loadDocumentos();
  } catch (error) {
    errorAt("#doc-error", error.message);
  }
});

/* ---------- Contas: local e seção de quem é de campo ---------- */
async function syncUserPlace() {
  const role = $("#us-role").value;
  const campo = ["presidente", "adm_predio", "ase"].includes(role);
  $("#us-lugar").hidden = !["presidente", "adm_predio"].includes(role);
  $("#us-secao-field").hidden = role !== "presidente";
  if (!campo) return;
  if ($("#us-local").options.length < 2)
    $("#us-local").innerHTML = `<option value="">—</option>` + (await getLocais()).map((l) => `<option value="${l.id}">${esc(l.nome)}</option>`).join("");
}
$("#us-role").addEventListener("change", syncUserPlace);

boot();
