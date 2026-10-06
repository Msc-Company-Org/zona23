# 🗂️ Área da equipe

A raiz do domínio é a entrada da **equipe do cartório**. O acervo de fotos continua público em **[/memorias](https://zon023.com.br/memorias)**.

> Ferramenta de apoio. Não substitui ELO, SEI, PJe nem os sistemas oficiais do TRE-RJ. Este documento descreve o funcionamento; nomes, telefones e dados reais não entram no repositório.

## 🧭 Endereços

| Endereço | O que abre |
| --- | --- |
| `/` | Login. Com sessão ativa, abre direto o Início da equipe. |
| `/entrar/link#t=…` | Confirmação do link de acesso (uso único). |
| `/#inicio`, `/#agenda`, `/#equipe`, `/#conta` … | Seções da área da equipe. |
| `/memorias`, `/memorias/baixar` | Acervo público de fotos. |
| `/app` | Página do aplicativo: APK para Android e instalação pelo navegador. |
| `/baixar`, `/?photo=…` | Endereços antigos: redirecionam para `/memorias`. |
| `/equipe`, `/admin`, `/entrar` | Atalhos antigos para a mesma área. |

## 👥 Perfis

| Perfil | Para quem | Pode |
| --- | --- | --- |
| `chefe`, `admin` | Chefia do cartório e administração do sistema | Tudo da equipe + criar contas, gerar links e desativar acessos. |
| `equipe` | Servidores do cartório | Todos os módulos de trabalho e o acervo. |
| `juiz`, `promotor` | Juiz(a) e promotor(a) eleitoral | Consultar; não alteram dados nem veem dados de eleitor. |
| `ase` | Auxiliares de Serviços Eleitorais | A própria escala, presença e declarações; consulta de locais e documentos. |
| `presidente` | Presidentes de seção | A própria seção e as próprias demandas. |
| `adm_predio` | Administradores de prédio | O próprio local e as próprias demandas. |

O **cargo** (texto livre, como “Chefe do Cartório”) aparece no topo e na equipe; o **perfil** define o acesso e o menu. Presidentes têm seção; administradores de prédio têm local. A matriz completa está no [planejamento](planejamento.md).

## 🔐 Como se entra

**Senha.** Cada conta nasce com uma senha inicial definida pela administração no momento do cadastro. Ela:

- obriga a criação de uma senha própria no primeiro acesso;
- expira em 7 dias se não for usada;
- não pode ser reaproveitada como nova senha.

Oito tentativas erradas bloqueiam o usuário por 15 minutos.

**Link de acesso.** Em *Equipe*, a administração toca no ícone de link de uma pessoa e envia pelo WhatsApp.

- O link vale **72 horas** e funciona **uma única vez**.
- Gerar outro cancela o anterior.
- O token fica depois do `#`, então não aparece em logs do servidor.
- A página só consome o link quando a pessoa toca em **Entrar agora**. A prévia automática do WhatsApp não gasta o acesso.
- Quem entra por link tem 30 minutos para criar a senha sem informar a atual.

**Por e-mail (opcional).** Com `MAIL_API_KEY` e `MAIL_FROM` configurados, a aba *Link de acesso* do login permite pedir um link de 15 minutos por e-mail. Sem configuração, a aba orienta a pedir o link à chefia.

**Sessão.** “Manter conectado neste aparelho” mantém a sessão por 30 dias; sem marcar, 12 horas. Em *Perfil* aparecem os aparelhos conectados, com a opção de sair de todos os outros.

## 👋 Primeiro acesso

Etapas exibidas uma vez por pessoa:

1. Boas-vindas com cargo e o que a área oferece ao perfil.
2. Criação de senha, obrigatória se a senha for provisória.
3. Celular (WhatsApp) e e-mail, opcionais.
4. Instalação no celular: APK, navegador ou instruções do iPhone.
5. Resumo dos módulos e entrada no Início.

A apresentação pode ser revista em *Perfil → Rever a apresentação*.

## 🧩 Módulos

| Módulo | Situação |
| --- | --- |
| Início, Agenda, Equipe, Perfil | Disponíveis. |
| Demandas do dia da eleição | Disponível: abrir, assumir, responder e concluir. |
| Totalização | Disponível: portal público do TSE, seção por seção. |
| Locais e seções | Disponível: 32 locais, 225 seções e 79.560 eleitores aptos (ELO), endereços, seções acessíveis, salas e mapa. |
| Convocações | Disponível: lista importada do ELO/Convoca+ (sem título de eleitor), situação e presença do dia. |
| Documentos | Disponível: biblioteca com categorias e visibilidade por perfil. |
| Tarefas | Disponível: responsável e apoio, prazo, situação (a fazer, em andamento, aguardando terceiro, concluída), checklist, comentários com `@usuário`, documentos da biblioteca, histórico, quadro no computador, lotes por modelo (ex.: justificativas por dias pares e ímpares) e aviso pelo WhatsApp. |
| Escala ASE | Disponível: escala colada do WhatsApp, atividade e horário do dia, presença, limite de 10 convocações nos dois turnos (alerta a partir de 9, bloqueio acima de 10), trocas aprovadas pela chefia e cópia no formato do grupo. |
| Minha escala (ASE) | Disponível: dias, horário, atividade, contador de convocações e pedido de troca. A conta do ASE é ligada pelo nome igual ao da escala. |
| Memórias (acervo) | Disponível para chefia e equipe. |
| Presença, Declarações, Sala de situação, Para decidir | Em preparação; veja o [planejamento](planejamento.md). |

### Tarefas

- **Visões:** *Comigo*, *Apoio*, *Equipe*, *Atrasadas* e *Concluídas*. No computador, a visão em quadro separa *A fazer*, *Em andamento* e *Aguardando terceiro*.
- **Delegar:** escolha o responsável e quem apoia. Ao abrir a tarefa, *Avisar* monta a mensagem para o WhatsApp de quem vai executar.
- **Colaborar:** comentário com `@usuário` chama a pessoa para o apoio. Marcar o primeiro passo do checklist põe a tarefa em andamento. Toda mudança fica no histórico.
- **Aguardando terceiro:** exige dizer de quem (ex.: Central de Mandados, chamado de TI).
- **Dividir lote:** um modelo vira uma tarefa por pessoa, com o mesmo checklist, por dias pares e ímpares, por faixas de seção ou igual para todos.
- **Apagar:** só quem criou ou a chefia; no dia a dia, cancele.

### Escala ASE

- **Colar do WhatsApp:** copie a mensagem da escala no grupo (`*SEGUNDA, 12/10/2026*` + `▫️ NOME`) e cole. *Conferir* mostra quantos dias, entradas, saídas e pessoas novas; *Aplicar* grava. Os dias do texto ficam iguais ao texto; os outros não mudam.
- **Convocações:** cada dia escalado conta uma; os dias marcados com *Todos* (eleição) contam para todos os ASE. Com 9 ou 10 a pessoa aparece *no limite*; acima de 10, em vermelho, e a inclusão manual é bloqueada.
- **Um dia:** atividade, horário, observação, presença de cada pessoa, incluir e retirar.
- **Trocas:** o ASE pede pelo app (ou o cartório registra o pedido que chegou pelo grupo); a chefia aprova ou recusa, e a escala muda sozinha.
- **Copiar escala:** gera o texto dos próximos dias no formato do grupo.

## 🛠️ Criar as contas

Os nomes e a senha inicial são informados na linha de comando, fora do Git:

```sh
INITIAL_PASSWORD='…' DATA_DIR=/data bun scripts/seed-equipe.js \
  "fulano:admin:Fulano:Chefe do Cartório" \
  "beltrana::Beltrana:Servidora do Cartório" \
  "sicrano:juiz:Dr. Sicrano:Juiz Eleitoral" \
  "fulana.adm:adm_predio:Fulana:Administradora de Prédio:L2"
```

Formato: `usuario[:perfil][:Nome de exibição][:Cargo][:lugar]`. O lugar é o número da seção (presidente) ou `L` + número do local (administrador de prédio). Contas existentes são mantidas. Depois, prefira enviar a cada pessoa o **link de acesso** em vez da senha.

## 📱 Aplicativo

A página `/app` funciona sem APK: oferece a instalação pelo navegador (PWA) e as instruções do iPhone. Para publicar o APK:

1. Gere o APK assinado (Trusted Web Activity) e guarde a chave fora do repositório.
2. Copie o arquivo para `DATA_DIR/downloads/zona023-<versão>.apk`.
3. Crie `DATA_DIR/downloads/apk.json`:

   ```json
   { "version": "1.0.0", "file": "zona023-1.0.0.apk", "sha256": "<sha256 do arquivo>", "updatedAt": "2026-10-08" }
   ```

4. Configure `ANDROID_CERT_SHA256` (impressão digital do certificado) e, se preciso, `ANDROID_PACKAGE`, para servir `/.well-known/assetlinks.json`.

[← Voltar ao projeto](../README.md)
