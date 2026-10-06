# Zona 23 — acervo de fotos

Acervo fotográfico colaborativo da **23ª Zona Eleitoral de Marechal Hermes**, TRE-RJ.
Consulta, cadastro de pessoas e envio de fotos públicos, conforme definido pelo usuário em 06/10/2026.
Sem mesas, prazo de encerramento ou data única de evento.

Código: [Msc-Company-Org/zona23](https://github.com/Msc-Company-Org/zona23),
repositório privado e independente, com branch principal `main`.
Site público: **https://zona23.msccompany.com.br/**.

## Rodar

```powershell
bun install --frozen-lockfile
bun run start
```

Abrir http://127.0.0.1:3023/. O servidor local escuta somente no loopback.
As variáveis da `.env.example` documentam configuração; para rodar com `.env`,
copiar o exemplo e ajustar os valores. Bun carrega `.env` automaticamente.

## Fluxo

- Fotos JPG, PNG ou WebP, até 25 MB e 40 megapixels. Até 20 fotos em um envio pelo navegador.
- Cada arquivo tem sua própria data (opcional), título, descrição e conjunto de pessoas.
  Foto sem data aparece no fim da linha do tempo e fica fora dos filtros por período.
  No envio de várias fotos, "Usar data e pessoas em todas" replica esses campos.
- Nomes ficam em SQLite e são reutilizados por todos; busca ignora acentos e caixa.
- Nome completo mais identificação opcional distingue homônimos. Identidade normalizada
  igual reutiliza o registro existente, evitando duplicação acidental.
- Consulta combina pessoa/nome e período inclusivo; ordenação pela data da foto.
- Galeria usa miniaturas e paginação em lotes de 48, com rolagem infinita. A ampliação usa uma
  versão de tela WebP de até 1600 px (`<id>.view.webp`), gerada no envio ou sob demanda para
  fotos antigas; o download continua entregando a cópia completa. Link individual por foto.
- HTML, JS e CSS saem da memória comprimidos (brotli/gzip) com ETag; JS e CSS têm hash na URL
  e cache imutável. Mudanças em `public/` exigem reiniciar o processo.
- Fotos sem pessoas identificadas também são aceitas. A data, quando informada, pertence
  à fotografia, e não à data do envio.
- Quem envia pode corrigir as informações a partir do mesmo navegador. Uma chave de
  edição é entregue apenas no envio; seu hash fica no servidor. A chave original fica
  no armazenamento do navegador. Perder esse armazenamento perde essa possibilidade de edição.
- As fotos são publicadas imediatamente após a confirmação de visibilidade pública.
  Não há login, reconhecimento facial, moderação administrativa nem exclusão na interface nesta versão.

## Persistência e publicação

`DATA_DIR` guarda `acervo.sqlite`, seus arquivos WAL/SHM e `media/`. São dados persistentes
do servidor, fora do Git. Não dependem de localStorage para consulta ou reutilização de nomes.
Sharp valida as imagens, aplica orientação e gera miniaturas. A cópia servida preserva
dimensões e formato, com recodificação e remoção de metadados EXIF; não é o arquivo original byte a byte.

Para publicar:

1. Escolher endereço do acervo e definir `PUBLIC_ORIGIN` com a origem HTTPS exata.
2. Usar o Dockerfile com volume persistente em `/data` e reverse proxy HTTPS.
3. Definir `HOST=0.0.0.0` somente no container/rede do proxy. Sem `PUBLIC_ORIGIN`,
   o servidor recusa exposição fora do loopback.
4. Ajustar `MAX_STORAGE_MB` (10 GiB por padrão); limite de corpo no proxy de ao menos 26 MB.
5. `TRUST_PROXY=true` só quando um proxy confiável sobrescrever `X-Real-IP` e bloquear
   acesso direto ao container. Há limite em memória de 120 escritas/hora/IP; ele reinicia com o processo.
6. Definir responsável pela operação e rotina de backup de banco **e** imagens. Para uma
   cópia simples consistente, interromper este serviço, copiar todo `DATA_DIR` e reiniciá-lo;
   não copiar só o SQLite com o serviço escrevendo.

Publicado em 06/10/2026: **https://zona23.msccompany.com.br/**. Build Docker e os seis
testes de integração passaram na VPS Linux. HTTPS, APIs, formulário e assets conferidos
no endereço público. A cápsula do casamento permanece em seu projeto e não compartilha
banco ou fotos com este acervo. Operação, backup e reversão em [deploy/README.md](deploy/README.md).

## Identidade visual

Logo SVG e fontes Inter obtidos do portal oficial do TRE-RJ. Azul `#1b305a`, amarelo
`#ffda59`, azul de apoio `#4671c8` e verde `#47c77d` conferidos no CSS do portal.
Fontes e logo são servidos localmente. Origem e limites de verificação em
[docs/identidade.md](docs/identidade.md). Layout e nome do acervo são a aplicação
proposta para a Zona 023, sem presumir homologação institucional.

Revisão visual solicitada em 06/10/2026: topo compacto azul, destaque amarelo para
Zona 023, contadores coloridos e filtros em amarelo claro. Slogans e blocos genéricos
de apresentação removidos. Fluxos de consulta, pessoas e envio conferidos no navegador,
sem rolagem horizontal em 320 px e desktop; `bun run check` aprovado.
O foco passou a ser a Zona 23: identificação própria no cabeçalho, título “Fotos da
Zona 23” e TRE-RJ como referência institucional secundária no rodapé.

Revisão mobile-first em 06/10/2026: marca própria Zon23 (urna estilizada com o trilho da estação
de Marechal Hermes), ícones SVG próprios em sprite no `index.html`, folhas de baixo no celular,
botão flutuante de envio, visualizador com deslizar para os lados e botão Voltar do celular
fechando janelas. O texto alterna Zona 23, Zon23, Zona 023, TRE Marechal Hermes e 23ª ZE.
Campos com 16 px para evitar zoom no iOS. Conferido em Chromium headless a 320, 390 e 1366 px.

Segunda rodada visual (06/10/2026): linha do tempo agrupada por ano, recolhível, com atalhos de ano;
cards com inclinação 3D e luz que segue o mouse (só em mouse, desligado com movimento reduzido), cor da
borda/sombra tirada da média da miniatura; card que expande até o visualizador (View Transitions);
miniatura borrada antes da versão de tela; menu expansível; filtros recolhíveis; dúvidas em acordeão;
modo de seleção com barra flutuante. Página `/baixar`: ZIP do acervo, por ano, pessoa, período ou
seleção (até 200 pela galeria), sempre com `fotos.csv` (data, título, pessoas, autor).
`GET /api/download.zip` aceita os mesmos filtros de `/api/photos` mais `year` e `ids`; até 1000 fotos
e 3 downloads simultâneos, montando um arquivo por vez na memória. Instalável no celular
(`/manifest.webmanifest`, ícones PNG gerados do `assets/icon.svg` na partida).

## Verificação e entrega

```powershell
bun run check
bun test
```

Seis testes de integração, 91 verificações: persistência/reabertura, cadastro reutilizável,
homônimos, filtros combinados, uploads e mídia, chave de edição, validação, rejeição entre
sites, reversão por limite de armazenamento e paginação.
Fluxo completo conferido no navegador com duas imagens sintéticas de teste e datas
diferentes, cadastro/reutilização, busca sem acento, correção do título e diretório.
Interface conferida em desktop e nas larguras 390 e 320 px.

Este repositório foi separado da implementação original em `apps/tre-memoria` da
worktree `feat/tre-memoria`, a partir do commit `00fcc7e` do monorepo MSC em 06/10/2026.
O código fica diretamente na raiz; comandos de instalação, teste e execução partem
desta pasta. Banco, fotos, dados de teste, dependências e credenciais ficam fora do Git.
A publicação existente continua usando a imagem descrita em `deploy/README.md`;
enviar commits ao GitHub não executa deploy automático.
