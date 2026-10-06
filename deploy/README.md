# Publicação Zona 23

Endereço: https://zona23.msccompany.com.br/.
Publicado em 06/10/2026, por autorização do titular neste chat.

## Serviço

- VPS Hostinger `srv1654842`, acessada por `ssh hostinger-msc` (Tailscale).
- Código da aplicação: commit original `c883fad` da worktree MSC, imagem `msc/zona23:c883fad`.
  O repositório independente `Msc-Company-Org/zona23` foi criado em 06/10/2026;
  o histórico Git novo possui seus próprios hashes.
- Pacote Git SHA256: `e755639ccd18be1ec385aa9c76cfdf6977b1591b9e979d1e1f214ba985fc66d2`.
- Fontes na VPS: `/srv/msc/src/tre-memoria/c883fad`.
- Compose próprio: `/srv/msc/stack/zona23.compose.yaml`, projeto `zona23`.
- Container: `zona23-acervo-1`, rede `web`, porta 3023 sem publicação direta no host.
- Dados persistentes: `/srv/msc/data/zona23`, proprietário UID/GID 1000.
- Traefik existente roteia o subdomínio e emite certificado Let's Encrypt.
- Registro A: `zona23.msccompany.com.br` → `76.13.163.168`, TTL 300.
  A zona autoritativa ainda está no Google Cloud DNS, `zone-msccompany-com-br`,
  projeto `msc-company-platform`; incluir este registro na futura migração DNS.
- `TRUST_PROXY=false`: limite de 120 escritas/hora considera o IP do proxy,
  compartilhado pelos visitantes. A aplicação não aceita cabeçalhos de IP arbitrários.

```sh
docker compose -f /srv/msc/stack/zona23.compose.yaml ps
docker compose -f /srv/msc/stack/zona23.compose.yaml logs --tail 100 acervo
docker compose -f /srv/msc/stack/zona23.compose.yaml up -d --wait
```

## Backup

Script: `/srv/msc/bin/backup-zona23.sh`; cron próprio `/etc/cron.d/zona23-backup`,
diariamente às 07:15 UTC (04:15 de Brasília). Logs: `/var/log/zona23-backup.log`.
Snapshot consistente de SQLite por `VACUUM INTO`, seguido da cópia de `media/`.
As imagens publicadas são imutáveis nesta versão; correções alteram apenas metadados.
O processo usa trava `flock` e verifica hashes. A primeira execução passou.

Backups locais: `/srv/msc/backups/zona23/<data-UTC>/`, com `acervo.sqlite`,
`media.tar.gz` e `SHA256SUMS`. Diretórios com mais de três dias são removidos
após um backup bem-sucedido. Não foi configurada cópia externa neste deploy.

Para restaurar, verificar `sha256sum -c SHA256SUMS`, parar apenas este compose,
preservar todo o diretório atual de dados e recriar um diretório vazio com UID/GID
1000. Copiar o snapshot como `acervo.sqlite`, extrair `media.tar.gz` nesse diretório
e reiniciar. Não misturar WAL/SHM antigos com o banco restaurado.

## Reversão

Para retirar o acervo do ar sem perder fotos:

```sh
docker compose -f /srv/msc/stack/zona23.compose.yaml stop acervo
```

Banco e mídias permanecem no volume. Reativar com `up -d --wait`.
Nenhuma alteração foi feita no compose principal ou nos serviços existentes.

## Verificação

- Imagem construída na VPS com Bun 1.4.2 e Sharp 0.34.5.
- 6 testes / 91 verificações passaram dentro da imagem Linux, com dados isolados.
- Container saudável; HTTPS válido, home e APIs retornando 200.
- Home, assets e formulário de envio conferidos no navegador público.
- API inicial: zero fotos, zero pessoas. Dados sintéticos de teste não publicados.
- Site MSC e `/capsula/` retornaram 200 após a ativação.
- Evidência visual local: `local/evidence/publicado.png`.
