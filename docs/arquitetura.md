# 🧩 Arquitetura do acervo

## Visão geral

A aplicação usa **Bun**, **SQLite** e **Sharp**, com interface em HTML, CSS e JavaScript. Um serviço HTTP entrega interface, API e imagens; o proxy de produção cuida do HTTPS.

| Camada | Responsabilidade |
| --- | --- |
| Interface | Galeria, pessoas, envio, visualizador, downloads e administração. |
| Aplicação | Validação, busca, permissões e preparação dos downloads. |
| SQLite | Fotos, pessoas, vínculos, eventos, sessões, usuários e configurações. |
| Mídia | Cópias completas processadas, miniaturas e versões de visualização. |
| Proxy HTTPS | Certificado, domínio e isolamento da porta interna. |

## 💾 Persistência

`DATA_DIR` contém `acervo.sqlite` e `media/`. Esses dados ficam fora do Git e precisam de backup conjunto.

O navegador guarda a chave de edição recebida no envio; o servidor mantém apenas seu hash. A consulta e os nomes compartilhados dependem do banco, não do armazenamento local do navegador.

## ⚡ Desempenho

- Galeria em lotes de 48 fotos.
- Miniaturas WebP na listagem.
- Visualização de até 1600 px, produzida no envio ou sob demanda para fotos antigas.
- HTML, CSS e JavaScript preparados em memória, com Brotli/gzip e ETag.
- CSS e JavaScript com hash na URL e cache imutável.
- Fontes e ícones servidos localmente.
- Movimento reduzido respeitado; efeitos de mouse são opcionais.

Alterações em `public/` exigem reinício ou nova publicação, pois os recursos são preparados na inicialização.

## 🔐 Acesso e limites

O acervo (`/memorias`) permite consulta e contribuição públicas. A área da equipe (`/`) usa sessão por cookie HttpOnly e `SameSite=Strict`, senha com Argon2, troca obrigatória da senha inicial e link de acesso de uso único (só o hash do token é guardado). Perfis `admin`, `equipe` e `autoridade` controlam as rotas `/api/equipe/*` e `/api/admin/*`; as escritas da equipe ficam em `audit_log`. Detalhes em [Área da equipe](area-da-equipe.md).

As escritas verificam a origem. `PUBLIC_ORIGIN` aceita origens separadas por vírgula. `TRUST_PROXY` exige um proxy confiável controlando o cabeçalho de IP e ausência de acesso direto à aplicação.

Os limites de envio e login em memória reiniciam com o processo. Múltiplas réplicas exigiriam uma estratégia compartilhada.

## 📦 Downloads

`GET /api/download.zip` aceita filtros da galeria, ano e IDs. O ZIP inclui `fotos.csv`, com limite de 1000 fotos e três downloads simultâneos.

## 🧪 Verificação

`bun test` usa bancos e imagens temporários. A interface requer validação adicional no navegador, especialmente após mudanças em navegação, formulários e layout.

[Guia de publicação →](../deploy/README.md)
