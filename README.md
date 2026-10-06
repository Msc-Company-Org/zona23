# 📸 Memórias da 023ª Zona Eleitoral

![Arte do acervo Memórias da 023ª Zona Eleitoral](public/assets/zon023-compartilhar-v1.jpg)

**Cartório TRE-RJ · Marechal Hermes**

Um acervo colaborativo para reunir fotografias, identificar as pessoas e preservar a memória da equipe da 023ª Zona Eleitoral. Consulte, contribua e reencontre momentos no celular ou no computador.

[![Bun](https://img.shields.io/badge/runtime-Bun-1b305a)](https://bun.sh/)
[![SQLite](https://img.shields.io/badge/dados-SQLite-4671c8)](https://sqlite.org/)
[![Interface](https://img.shields.io/badge/interface-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-ffda59)](public/)
[![Deploy](https://img.shields.io/badge/publica%C3%A7%C3%A3o-Docker-47c77d)](deploy/README.md)

**[🌐 Abrir o acervo](https://zon023.com.br/)** · **[📖 Como usar](docs/guia-do-acervo.md)** · **[🛠️ Desenvolver](#-rodar-no-computador)** · **[🚀 Publicar](deploy/README.md)**

> **Domínio principal:** `zon023.com.br`. O endereço `zona23.msccompany.com.br` permanece disponível como alternativa. Este projeto colaborativo não presume homologação institucional pelo TRE-RJ.

## 🧭 O que você encontra

| Área | Para que serve |
| --- | --- |
| **Galeria** | Explorar a linha do tempo e filtrar fotos por pessoa ou período. |
| **Pessoas** | Encontrar nomes e as fotografias em que aparecem. |
| **Enviar fotos** | Compartilhar imagens com título, data opcional e identificação das pessoas. |
| **Baixar fotos** | Guardar imagens individualmente ou em ZIP, com uma planilha CSV. |
| **Área da equipe** | Organizar fotos, pessoas, eventos e textos, quando o acesso estiver habilitado. |

### ✨ Feito para o dia a dia

- **No celular:** formulário adaptado, botões acessíveis e navegação entre fotos por gestos.
- **Com organização:** anos, filtros combinados e seleção de fotografias.
- **Com imagens leves:** miniaturas WebP e visualização de até 1600 pixels.
- **Com contexto:** nomes, datas, títulos e descrições acompanham as imagens.
- **Com acessibilidade:** rótulos nos controles, foco visível e respeito a movimento reduzido.

## 💬 Compartilhar no WhatsApp

Envie **https://zon023.com.br/** para compartilhar o acervo. A página inclui título, descrição e uma imagem própria para a prévia do link.

Também é possível baixar a [arte de compartilhamento](public/assets/zon023-compartilhar-v1.jpg) ou usar **Imagem para WhatsApp** no menu do site. A arte é uma ilustração digital; não representa uma fotografia histórica documental.

## 📖 Comece por aqui

1. Abra a **Galeria** e explore a linha do tempo.
2. Pesquise uma pessoa e combine filtros, quando precisar.
3. Toque em uma foto para consultar os detalhes, compartilhar o link ou baixar a imagem.
4. Para contribuir, escolha **Enviar fotos**, revise as informações e confirme a publicação.

**As fotos são públicas.** Envie apenas imagens que você tem autorização para compartilhar. Fotografias, banco de produção e credenciais ficam fora deste repositório.

Consulte os limites de arquivos e as instruções no [guia do acervo](docs/guia-do-acervo.md).

## 💻 Rodar no computador

Pré-requisitos: [Bun](https://bun.sh/) e Git. O processamento de imagens usa Sharp.

```sh
git clone https://github.com/Msc-Company-Org/zona23.git
cd zona23
bun install --frozen-lockfile
bun run dev
```

Abra **http://127.0.0.1:3023/**. Por padrão, o servidor escuta somente no computador local.

Para personalizar a configuração, copie `.env.example` para `.env`. O Bun carrega o arquivo automaticamente; ele não deve entrar no Git.

### ⚙️ Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Endereço em que o servidor escuta. |
| `PORT` | `3023` | Porta da aplicação. |
| `DATA_DIR` | `./local/data` | Diretório do banco e das imagens. |
| `PUBLIC_ORIGIN` | vazio | Origens HTTPS permitidas, separadas por vírgula. Obrigatório fora do loopback. |
| `TRUST_PROXY` | `false` | Habilitar apenas com proxy confiável controlando o IP recebido. |
| `MAX_STORAGE_MB` | `10240` | Limite de armazenamento do acervo. |
| `ADMIN_BOOTSTRAP_PASSWORD` | vazio | Habilita a primeira conta administrativa; exige ao menos 12 caracteres. |

Sem senha de bootstrap, o acervo funciona e o login da equipe fica desabilitado. **Nenhuma senha padrão é criada automaticamente.** A primeira conta habilitada precisa trocar a senha antes de acessar o painel. Nunca inclua credenciais reais em exemplos, issues ou commits.

## ✅ Verificar uma mudança

```sh
bun run check
bun test
```

Os testes usam dados isolados e cobrem persistência, uploads, filtros, paginação, edição, downloads e proteção administrativa. A validação de 06/10/2026 passou com **11 testes de integração**.

Mudanças de interface também precisam de conferência visual no celular e no computador. Testes do servidor não substituem essa revisão.

## 🗂️ Organização do projeto

| Caminho | Conteúdo |
| --- | --- |
| `public/` | Páginas, estilos, JavaScript, ícones e fontes. |
| `src/app.js` | Aplicação HTTP, banco, imagens, filtros e downloads. |
| `src/admin.js` | Sessões, administração, eventos e textos editáveis. |
| `src/server.js` | Inicialização pelas variáveis de ambiente. |
| `tests/` | Testes automatizados com dados temporários. |
| `docs/` | Guias de uso e manutenção. |
| `deploy/` | Configuração e orientações de operação. |

O código foi extraído do projeto `tre-memoria` e mantido em um repositório independente. Enviar commits ao GitHub **não executa deploy automático**.

## 🤝 Contribuir e acompanhar

Leia o [guia de contribuição](CONTRIBUTING.md). Uma boa proposta explica o problema, mostra o resultado esperado e inclui evidências da validação.

| Documento | Quando consultar |
| --- | --- |
| [Guia do acervo](docs/guia-do-acervo.md) | Para encontrar, enviar, corrigir ou baixar fotos. |
| [Textos e navegação](docs/textos-e-navegacao.md) | Para manter títulos, botões e ícones consistentes. |
| [Arquitetura](docs/arquitetura.md) | Para entender dados, rotas e desempenho. |
| [Identidade visual](docs/identidade.md) | Para consultar a origem dos ativos visuais. |
| [Publicação e recuperação](deploy/README.md) | Para publicar, verificar e recuperar uma versão. |
| [Histórico de mudanças](CHANGELOG.md) | Para acompanhar as entregas. |

### 📌 Próximas entregas

- Criar os usuários solicitados, a tela de perfil e o fluxo individual de primeiro acesso.
- Configurar e documentar os canais de operação da VPS.

Esses itens são planejamento, não funcionalidades já disponíveis.

## 🎨 Créditos e uso do código

Projeto mantido pela **MSC Company**. A identidade reúne elementos próprios do acervo e referências visuais documentadas do TRE-RJ. Consulte [origens e limites de uso](docs/identidade.md).

A visibilidade pública não transfere direitos sobre fotografias, marcas ou ativos de terceiros. O projeto ainda não define uma licença geral de redistribuição do código.
