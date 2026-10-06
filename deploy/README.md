# 🚀 Publicar e operar o acervo

Este guia separa o código, a imagem em execução e os dados persistentes. Um push no GitHub não publica o site automaticamente.

## 📍 Endereços e estado

| Item | Estado confirmado em 06/10/2026 |
| --- | --- |
| Domínio principal | https://zon023.com.br/ |
| Endereço alternativo | https://zona23.msccompany.com.br/ |
| Registro e DNS | Ativação confirmada; raiz e `www` resolvem para a VPS |
| DNS preparado | A do domínio raiz para a VPS; `www` como CNAME do domínio raiz |
| Serviço | `acervo`, projeto Compose `zona23`, container `zona23-acervo-1` |
| Porta | `3023`, interna à rede do proxy |
| Publicação | Docker e Traefik, com HTTPS |

O compose neste diretório é um **modelo configurável**. O arquivo efetivo da produção é mantido no servidor. Identificadores de acesso, tokens e senhas não pertencem à documentação pública.

## 🧰 Preparar uma versão

1. Confira branch, alterações locais e versão em produção.
2. Preserve trabalho não commitado antes de trocar de branch.
3. Execute testes e verificação de sintaxe.
4. Faça backup consistente do banco **e** das mídias.
5. Gere uma imagem identificada pelo commit.

```sh
git status --short --branch
bun install --frozen-lockfile
bun run check
bun test
git diff --check
```

## ⚙️ Configurar o serviço

No modelo `compose.yaml`, defina:

- `ZONA23_IMAGE`: imagem construída e identificada pela versão.
- `ZONA23_DATA_DIR`: diretório persistente, gravável pelo UID/GID 1000.
- `ZONA23_HOST`: domínio utilizado pelo router.
- `ZONA23_PUBLIC_ORIGIN`: origem HTTPS exata; aceita lista separada por vírgula na aplicação.

A rede externa `web` e o resolvedor TLS `letsencrypt` precisam existir no proxy. Não publique a porta da aplicação diretamente na internet.

`TRUST_PROXY=false` mantém o comportamento conservador: o limite de escritas considera o IP do proxy, compartilhado pelos visitantes. Só altere após verificar que o proxy sobrescreve os cabeçalhos recebidos e impede acesso direto.

## 📦 Publicar

Use o caminho do compose efetivo do ambiente. O exemplo abaixo usa o arquivo deste diretório:

```sh
docker compose -p zona23 -f deploy/compose.yaml config -q
docker compose -p zona23 -f deploy/compose.yaml up -d --no-deps --no-build acervo
docker compose -p zona23 -f deploy/compose.yaml ps
```

Atualize apenas o serviço do acervo. Evite reiniciar a stack inteira para uma mudança nesta aplicação.

## ✅ Conferir depois

- Container em execução e saudável.
- HTTPS válido no endereço publicado.
- Página inicial, `/baixar`, `/api/stats` e recursos estáticos funcionando.
- Galeria e formulário conferidos no navegador.
- Quantidade de fotos preservada.
- Commit, imagem e backup registrados no controle operacional privado.

Ao trocar de domínio, verifique primeiro o registro, depois os servidores DNS, os registros A/CNAME e finalmente o certificado. Um registro aceito pelo provedor ainda pode não resolver na internet.

## 💾 Backup e recuperação

O backup precisa incluir um snapshot consistente de `acervo.sqlite` e o diretório `media/`, com verificação de integridade. O SQLite em uso não deve ser copiado isoladamente sem tratar WAL e consistência.

O script histórico `backup.sh` usa `VACUUM INTO`, copia mídias e verifica hashes. **Ele também remove backups com mais de três dias.** Revise a retenção e as regras do ambiente antes de instalar ou executar esse script; sua presença no Git não confirma que esteja instalado.

Em produção, a administração pode excluir mídias. Por isso, faça a cópia com escritas suspensas ou use snapshot do volume para manter banco e arquivos consistentes. Mantenha uma cópia externa e teste restauração antes de depender da rotina.

Para recuperar:

1. Confira os hashes do backup.
2. Pare apenas o serviço do acervo.
3. Preserve integralmente os dados atuais para investigação ou retorno.
4. Restaure banco e mídias em um diretório separado e vazio, com as permissões corretas.
5. Não misture arquivos WAL/SHM antigos com o banco restaurado.
6. Aponte o serviço para o conjunto restaurado e valide antes de reabrir escritas.

## ↩️ Voltar à versão anterior

Preserve a imagem anterior e o compose antes de publicar. Se houver regressão, volte a imagem do serviço para essa versão e reinicie somente o acervo. Confirme a compatibilidade das migrações de banco; reverter a imagem não desfaz alterações nos dados.

Não use `down -v` nem apague volumes, bancos ou backups para resolver uma falha de publicação.

[← Voltar ao projeto](../README.md)
