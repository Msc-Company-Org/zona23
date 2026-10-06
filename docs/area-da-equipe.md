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
| `admin` | Chefia do cartório e administração do sistema | Tudo da equipe + criar contas, gerar links e desativar acessos. |
| `equipe` | Servidores e auxiliares | Todos os módulos do cartório e o acervo. |
| `autoridade` | Juiz(a) e promotor(a) eleitoral | Consultar Início, agenda, equipe e os módulos de acompanhamento. Não altera dados. |

O **cargo** (por exemplo, “Chefe do Cartório” ou “Juiz Eleitoral”) é um texto exibido no topo e na equipe; o perfil é o que define o acesso. O menu muda por perfil: autoridades veem **Para decidir** (juiz) ou **Acompanhamento** (promotoria) no lugar de Tarefas e Escala.

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
| Memórias: visão do acervo, fotos, eventos, pessoas e textos | Disponível para `admin` e `equipe`. |
| Tarefas, Escala ASE | Em preparação. |
| Frequência, Convocações, Locais e seções, Para decidir | Em preparação. |
| Sala de situação, Acompanhamento | Em preparação. |

Módulos em preparação aparecem com o chip **Em breve** e mostram o que vão fazer, sem link quebrado.

## 🛠️ Criar as contas

Os nomes e a senha inicial são informados na linha de comando, fora do Git:

```sh
INITIAL_PASSWORD='…' DATA_DIR=/data bun scripts/seed-equipe.js \
  "fulano:admin:Fulano:Chefe do Cartório" \
  "beltrana::Beltrana:Servidora do Cartório" \
  "sicrano:autoridade:Dr. Sicrano:Juiz Eleitoral"
```

Formato: `usuario[:perfil][:Nome de exibição][:Cargo]`. Contas existentes são mantidas. Depois, prefira enviar a cada pessoa o **link de acesso** em vez da senha.

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
