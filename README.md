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
- Cada arquivo tem sua própria data obrigatória, título, descrição e conjunto de pessoas.
- Nomes ficam em SQLite e são reutilizados por todos; busca ignora acentos e caixa.
- Nome completo mais identificação opcional distingue homônimos. Identidade normalizada
  igual reutiliza o registro existente, evitando duplicação acidental.
- Consulta combina pessoa/nome e período inclusivo; ordenação pela data da foto.
- Galeria usa miniaturas e paginação em lotes de 48. Ampliação, download e link individual.
- Fotos sem pessoas identificadas também são aceitas. A data pertence à fotografia,
  e não à data do envio.
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
