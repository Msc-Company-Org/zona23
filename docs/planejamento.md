# 🧭 Planejamento da área da equipe

Plano vivo das funcionalidades da Zona 023 para o cartório da 23ª ZE. Os estados são:

- ✅ **disponível**: já está no código;
- 🛠️ **em construção**;
- 📅 **planejado**, com a data-alvo.

Atualize este arquivo quando um item mudar de estado.

> Princípios: **dados reais** sempre que existirem (TSE, planejamento do cartório, documentos), **celular primeiro**, **WhatsApp como canal de entrega** (não como banco de dados), mínimo de dados pessoais e nada disso no Git.

## 1. Perfis e composição

| Perfil | Quem | Entra por | Escopo |
| --- | --- | --- | --- |
| `chefe` | Chefe do Cartório | Senha ou link | Tudo, mais contas, aprovações e relatórios. |
| `equipe` | Servidores do cartório | Senha ou link | Todos os módulos de trabalho. |
| `admin` | Administração do sistema | Senha ou link | Igual à chefia, mais configuração técnica. |
| `juiz` | Juiz(a) eleitoral | Senha ou link | Consulta; decide o que o cartório encaminha. |
| `promotor` | Promotor(a) eleitoral | Senha ou link | Consulta e acompanhamento. |
| `ase` | Auxiliares de Serviços Eleitorais | Link (pode criar senha) | A própria escala, presença e declarações. |
| `presidente` | Presidentes de seção | Link de acesso | A própria seção e as próprias demandas. |
| `adm_predio` | Administradores de prédio e coordenadores de acessibilidade | Link de acesso | O próprio local e as próprias demandas. |

O pessoal de campo vem das **convocações**: uma conta por pessoa convocada, ligada à seção (presidente) ou ao local (administrador). O cartório envia os links em lote pelo WhatsApp.

### Matriz de acesso

L = lê · E = edita · P = próprio (só o que é seu) · — = não vê

| Módulo | Chefia/Admin | Equipe | Juiz | Promotoria | ASE | Presidente | ADM prédio | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início | E | L | L | L | L | L | L | ✅ |
| Agenda (marcos) | E | E | L | L | L | L | L | ✅ |
| Equipe e contas | E (contas) | L | L | L | L (cartório) | L (cartório) | L (cartório) | ✅ |
| Demandas do dia | E | E | L* | L* | — | P (abre) | P (abre) | ✅ |
| Totalização (TSE) | E (atualizar) | E | L | L | — | — | — | ✅ |
| Locais e seções | E | E | L | L | L | — | L | ✅ |
| Documentos | E | E | L† | L† | L† | L† | L† | ✅ |
| Tarefas | E (delegar) | E | — | — | — | — | — | 🛠️ 12/10 |
| Escala ASE | E (aprovar trocas) | E | — | — | P | — | — | 📅 12/10 |
| Presença | E | E | — | — | P | P (mesários) | P (local) | 📅 16/10 |
| Declarações | E | E | — | — | P | P | P | 📅 16/10 |
| Convocações e presença | E (aprovar) | E | L | L | — | — | — | ✅ lista e presença · 📅 dispensas |
| Sala de situação | E | E | L | L | — | P (seção) | P (local) | 📅 21/10 |
| Para decidir | E (encaminhar) | E | E (decidir) | — | — | — | — | 📅 16/10 |
| Acompanhamento | E | E | — | E | — | — | — | 📅 21/10 |
| Relatórios e painéis | E | L | L | L | — | — | — | 📅 22/10 |
| Memórias (acervo) | E | E | — | — | — | — | — | ✅ |

\* Autoridades não veem dados de eleitor nas demandas. † Cada documento define quem vê: só o cartório, cartório e autoridades, ou todos.

## 2. Chefia do cartório

**Painel da chefia (Início):**
- contagem para o turno;
- demandas em aberto por prioridade e há quanto tempo estão paradas;
- tarefas atrasadas por pessoa;
- pedidos de troca de escala e de dispensa aguardando aprovação;
- totalização em andamento.

| Workflow | Passos | Estado |
| --- | --- | --- |
| Montar a equipe | Criar conta → definir cargo e perfil → enviar link pelo WhatsApp → acompanhar “aguardando 1º acesso”. | ✅ |
| Delegar trabalho | Criar tarefa (ou a partir de modelo) → responsável e apoio → prazo → referência SEI/PJe → aviso no WhatsApp → acompanhar até concluir. | 🛠️ |
| Dividir lotes | Modelo “Justificativas pós-turno” → dividir por critério (dias pares/ímpares, faixas de seção) → uma tarefa por pessoa, com o mesmo procedimento anexado. | 🛠️ |
| Aprovar trocas e dispensas | Fila única de pedidos → aprovar ou recusar com motivo → escala e convocações se atualizam. | 📅 |
| Dia da eleição | Demandas em tela cheia → distribuir (assumir/atribuir) → acompanhar totalização e checklist dos locais. | ✅ / 📅 |
| Fechar o turno | Relatório: demandas por tipo e tempo de resposta, faltosos, horários de totalização, declarações emitidas. | 📅 |

## 3. Equipe do cartório

| Workflow | Descrição | Estado |
| --- | --- | --- |
| Minhas tarefas | Lista do que está comigo e do que apoio, com prazo, checklist e comentários. | 🛠️ |
| Colaborar | Comentar, marcar colegas, anexar documento, passar a tarefa adiante com histórico. | 🛠️ |
| Escala e presença | Registrar presença do dia, gerar declarações em lote, conferir o limite de 10 dias. | 📅 |
| Atendimento no dia | Assumir demanda, consultar (ELO/e-Título fora do sistema), responder e concluir. | ✅ |
| Documentos | Publicar planejamento, avisos, manuais e modelos com a visibilidade certa. | ✅ |

## 4. Autoridades

- **Juiz(a):**
  - *Para decidir*: dispensas de mesários com motivo e substituto sugerido, blocos de assinatura avisados pelo cartório e audiências públicas.
  - Acompanhamento da totalização e das demandas.
- **Promotoria:**
  - *Acompanhamento*: ocorrências que envolvam possível crime eleitoral, credenciamento de fiscais (sem dados pessoais) e audiências.
  - Totalização e demandas em leitura.

## 5. Pessoal de campo

| Perfil | Antes da eleição | Sábado | Domingo | Depois |
| --- | --- | --- | --- | --- |
| ASE | Minha escala, horários, trocas | Atividade do dia (ex.: roteiro de urnas) | Presença | Declarações |
| Presidente | Minha seção, sala, mesários, orientações | Checklist da urna (no lugar da foto no grupo) | Demandas, encerramento | Declaração |
| ADM de prédio | Meu local, seções, presidentes | Checklist: urnas recebidas/testadas, salas trancadas, policiamento | Demandas, filas pós-17h, recolhimento | Faltosos do local |

## 6. Módulos em detalhe

### 6.1 Tarefas: delegação, cooperação e acompanhamento (🛠️)

- **Campos:**
  - título, tipo (SEI, PJe, FILIA, ELO, Conseg, chamado de TI, edital, justificativas, credenciamento, ofício, outro);
  - referência (nº SEI ou PJe com classe);
  - responsável, apoio (várias pessoas), prazo, prioridade, status;
  - checklist, comentários com @menção, anexos da biblioteca.
- **Fluxos:**
  - criar → atribuir → em andamento → aguardando terceiro (ex.: resposta da Central de Mandados) → concluída;
  - histórico de quem mudou o quê.
- **Modelos:** justificativas pós-turno (divisão em lote), editais de audiência pública, frequência e declarações do dia, credenciamento de fiscais.
- **Visões:** minhas, que apoio, da equipe, atrasadas; quadro (kanban) no computador.

### 6.2 Escala, presença e declarações (📅)

- **Importação:** colar o texto da escala do WhatsApp (`*DIA, dd/mm/aaaa*` + `▫️ NOME`) cria os dias e as pessoas.
- **Escala:**
  - horário e atividade por pessoa;
  - contador de 10 convocações nos dois turnos, com alerta no 9º dia e bloqueio acima de 10;
  - pedido de troca com aprovação da chefia.
- **Presença:** presente, faltou ou substituído, com entrada e saída.
- **Declarações:**
  - lote em PDF (impressão do navegador) no modelo do cartório;
  - envio individual pelo WhatsApp.
  - *Pendência:* modelo atual da declaração.

### 6.3 Convocações (📅)

- **Funções:** presidente, 1º/2º mesário, secretário, suplente, ADM de prédio, coordenador de acessibilidade, coletor de justificativa, ASE, apoio logístico, coordenador de área/técnico, motorista.
- **Importação:** relatório do ELO (planilha), **sem CPF nem título**.
- **Fluxo de dispensa:** pedido → informação do cartório → decisão do juiz → substituto.

### 6.4 Sala de situação (📅)

- **Sábado:** urnas recebidas → testadas → salas trancadas → policiamento, por local.
- **Domingo:** abertura → filas após 17h (escala 0–4 do TRE) → mídias entregues → material recolhido.
- **Por seção:** teste da urna com resumo da correspondência, digitado ou lido da foto da tela.
- **Painel:** mapa de calor dos 32 locais e alertas do que está atrasado.

### 6.5 Demandas do dia da eleição (✅)

- **Tipos:** título, seção ou local; material ou ata; urna; mesário; estrutura; policiamento; filas; procedimento; outro.
- **Ciclo:** aberta → em atendimento → concluída ou cancelada, com resposta registrada.
- **Prioridade:** normal, alta, urgente.
- **Privacidade:**
  - título de eleitor e CPF aparecem **mascarados** para todos (ex.: `•••• •••• 0353`);
  - só a equipe do cartório revela o número completo, em uma demanda por vez, com registro na auditoria;
  - dados de eleitor visíveis só para o cartório e para quem abriu, e apagados 7 dias após a conclusão.
  - Convocações não guardam título nem CPF.
- **Próximo:**
  - respostas rápidas (modelos);
  - atribuir a um colega;
  - tempo de atendimento no relatório;
  - aviso no celular de quem abriu.

### 6.6 Totalização (✅)

- **Fonte:** portal público de resultados do TSE, arquivos de urna por seção (município 60011, zona 0023), com status e hora de recebimento de cada boletim.
- **Consulta:** a cada 3 minutos, com poucas requisições simultâneas; o pleito do 2º turno é descoberto sozinho quando o TSE o publicar.
- **Dados de 2026:**
  - 1º turno conferido: 225/225 seções, da primeira às 18h00 à última às 20h01;
  - o 2º turno aparece ao lado, para comparar.
- **Próximo:** alerta de seções atrasadas por local e comparação de horários entre turnos.

### 6.7 Documentos e procedimentos (✅ / 📅)

- **Biblioteca:**
  - categorias: planejamento, orientações, avisos, normas, modelos, listas;
  - visibilidade por perfil e downloads registrados na auditoria.
- **Procedimentos** (📅): páginas curtas do tipo “como fazer”, ligadas a tarefas e demandas, marcadas como:
  - **manual:** feito por pessoa, fora do sistema (ex.: consulta no ELO, despacho no SEI);
  - **automático:** feito pelo sistema (ex.: totalização, apagamento de dados de eleitor, lembretes).

### 6.8 Painéis e relatórios (📅)

| Painel | Para quem | Conteúdo |
| --- | --- | --- |
| Turno | Chefia, autoridades | Seções totalizadas por horário, demandas por tipo e tempo médio de resposta, locais com pendência. |
| Equipe | Chefia | Tarefas por pessoa e status, atrasos, carga da semana. |
| Escala | Chefia, equipe | Dias por ASE (X/10), cobertura por dia, trocas. |
| Locais | Chefia, equipe | Checklist por local no sábado e no domingo, faltosos, ocorrências. |
| Relatório do turno (PDF) | Chefia, juiz | Resumo para arquivo ou processo: horários, ocorrências, faltas, declarações. |

### 6.9 Integração com WhatsApp

| Etapa | Como | Estado |
| --- | --- | --- |
| 1. Links prontos | Botões “Enviar no WhatsApp” (link pessoal, aviso de tarefa, resposta de demanda) e “Copiar para o grupo” no formato atual. Sem custo, sem conta nova. | ✅ links de acesso · 📅 demais |
| 2. Notificações no celular | Web Push no app instalado: nova demanda, tarefa atribuída, troca aprovada. | 📅 |
| 3. API oficial (WhatsApp Business / Cloud API) | Número do cartório como remetente, mensagens-modelo aprovadas pela Meta. Exige conta Business verificada, número dedicado e custo por conversa; decisão da chefia. | Em avaliação |

Ler grupos ou automatizar o WhatsApp pessoal não está nos planos: viola os termos do serviço e expõe as conversas.

## 7. Dados reais e origem

| Dado | Origem | Onde fica | Estado |
| --- | --- | --- | --- |
| 32 locais, 225 seções, áreas, BPM, endereços | Planejamento Logístico 2026; seções conferidas com o TSE | Código (`src/locais.js`), por serem públicos | ✅ |
| Códigos, bairros, eleitores aptos (79.560) e seções acessíveis | ELO · Endereço das Seções (06/10/2026) | Código (`src/locais.js`) | ✅ |
| Salas por seção (224 de 225) | Planejamento Logístico 2026 | Banco (importação privada) | ✅ carga pronta |
| Totalização por seção | Portal do TSE | Banco (automático) | ✅ |
| Datas do turno (preparação, conferência, entrega, eleição) | Planejamento e avisos do cartório | Agenda | ✅ estrutura · 📅 lançar |
| Roteiros de distribuição e recolhimento | Planejamento Logístico 2026 | Banco | 📅 |
| Escala de ASE | Texto do WhatsApp | Banco (importação) | 📅 |
| Convocados | ELO/Convoca+ · Relatório de Mesários por Situação | Banco (importação privada, sem título) | ✅ coletores do 1º turno (123) · 📅 demais funções |
| Documentos (planejamento, avisos, e-book) | Drive e grupos | Biblioteca | ✅ envio · 📅 carga inicial |

## 8. Cronograma até o 2º turno (25/10)

| Até | Entrega |
| --- | --- |
| 08/10 | Publicação na VPS com login, perfis, demandas, totalização, locais e documentos; carga inicial de documentos e da agenda. |
| 12/10 | Tarefas (delegação, apoio, comentários, modelos) e Escala ASE. |
| 16/10 | Convocações, presença, declarações em lote e *Para decidir*. |
| 21/10 | Sala de situação, *Meu local* e *Minha seção*, contas de campo enviadas por link. |
| 22/10 | Painéis e relatório do turno. Congelamento: só correções até 26/10. |

## 9. Decisões pendentes

- Modelo atual da declaração de comparecimento.
- Relatório de convocados do ELO (formato e campos).
- Acesso do pessoal de campo no 2º turno: todos os presidentes e ADMs, ou só ADMs e coordenadores.
- WhatsApp Cloud API: seguir ou ficar com os links prontos.
- Provedor de e-mail para o link de acesso.

[← Voltar ao projeto](../README.md)
