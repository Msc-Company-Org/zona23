# 🧭 Governança e continuidade

Este documento explica como manter o **Memórias da 023ª Zona Eleitoral** compreensível, recuperável e fácil de continuar. A **MSC Company** mantém o projeto colaborativo; sua identificação com o cartório não presume homologação institucional pelo TRE-RJ.

## 📍 O que existe e o que está planejado

| Tema | Estado documentado em 06/10/2026 |
| --- | --- |
| Código principal | Mantido no [GitHub](https://github.com/Msc-Company-Org/zona23). |
| Aplicação | Bun, SQLite e Sharp; interface em HTML, CSS e JavaScript. |
| Produção | Um serviço Docker, com HTTPS pelo proxy e dados persistentes fora do Git. |
| Validação | Testes de integração e verificação de sintaxe executados antes de publicar. |
| Publicação | Atualização explícita do serviço; enviar commits não dispara deploy. |
| GitLab | Espelho proposto; configuração e sincronização ainda não confirmadas. |
| Acessos operacionais | Inventário e configuração em andamento; não presumir acesso em toda sessão. |
| Recuperação externa | Cópia externa e teste de restauração ainda precisam de confirmação operacional. |

O estado de uma integração deve ser registrado com uma verificação concreta. Instalar uma ferramenta, salvar uma configuração ou escrever um plano não confirma que ela esteja autenticada e funcionando.

## 🌱 Mudanças e versões

O GitHub é a fonte principal do código. Para uma mudança:

1. Abra uma branch curta, como `feat/perfil`, `fix/galeria` ou `docs/guia`.
2. Explique o problema, faça a alteração e atualize os documentos afetados.
3. Execute as verificações do [guia de contribuição](../CONTRIBUTING.md).
4. Registre a revisão em um pull request, com resultado dos testes e captura quando a interface mudar.
5. Publique uma versão identificada pelo commit e confira o serviço depois.

Essa é a convenção de trabalho; ela não afirma que proteções de branch ou automações estejam configuradas. Preserve alterações de outras pessoas antes de trocar de branch ou preparar uma publicação.

Cada publicação deve registrar **commit, imagem, data, validação e referência do backup** no controle operacional privado. O [histórico de mudanças](../CHANGELOG.md) resume o que mudou para quem usa o acervo.

### 🔁 Espelho proposto no GitLab

A proposta é copiar o histórico do GitHub para o GitLab e conferir se o commit publicado está presente nos dois. O espelho não terá uma linha de desenvolvimento independente. Falhas de sincronização devem ficar registradas até a correção.

Esse espelho protege o histórico do código; fotos e banco precisam de backup próprio.

## 🧪 Desenvolvimento e produção

- **Desenvolvimento:** banco separado, imagens sintéticas e configuração local.
- **Produção:** dados persistentes, uma instância da aplicação e publicação de uma versão validada.
- **Verificação:** testes usam dados temporários; não alteram o acervo real.

O desenvolvimento não deve montar o diretório de dados de produção. Uma mudança de código não justifica trocar a stack, reiniciar outros serviços ou ampliar permissões de acesso. Consulte a [arquitetura](arquitetura.md) antes de acrescentar componentes.

## 🔐 Pessoas e ferramentas

As permissões devem acompanhar a tarefa de cada pessoa. O vínculo com uma organização não concede administração automaticamente. A criação dos usuários, dos perfis e das respectivas permissões será documentada conforme a implementação.

SSH, CLI, API e MCP são canais de operação. Cada canal precisa de identidade autorizada, escopo conhecido e uma consulta de verificação. Aproveite integrações existentes antes de criar novas credenciais.

A configuração em uma VPS ou sessão não garante disponibilidade em outras sessões do ChatGPT, Codex ou Prometheus. Registre separadamente onde cada acesso foi validado. Consentimentos OAuth, validade e revogação pertencem ao controle operacional privado.

Nunca publique senhas, tokens, chaves privadas ou dados reais de autenticação em código, exemplos, issues ou documentação.

## 💾 Backup e recuperação

O conjunto recuperável inclui **banco SQLite e mídias**, com consistência entre ambos. Mantenha uma cópia externa ao servidor e confirme a restauração em um diretório isolado antes de depender dela.

A política de retenção precisa ser definida antes de ativar qualquer remoção automática. Preservar uma imagem Docker ou espelhar o Git não preserva o acervo. O procedimento detalhado está no [guia de publicação e recuperação](../deploy/README.md).

## 📚 Documentação para cada público

| No repositório público | No controle operacional privado |
| --- | --- |
| Guias de uso, arquitetura e contribuição. | Inventário dos ambientes e acessos autorizados. |
| Código, testes e exemplos sem credenciais. | Referências de credenciais, validade e revogação, sem expor seus valores. |
| Identidade visual e histórico de mudanças. | Registros de publicação, backups, restauração e incidentes. |

Fotografias originais, exportações de produção, bancos e backups ficam fora do repositório. A publicação do código não altera os direitos sobre imagens, marcas ou dados de terceiros.

## ✅ Próximos passos

1. Confirmar os canais operacionais existentes e documentar apenas os que funcionam.
2. Configurar e verificar o espelho GitLab.
3. Confirmar backup externo, retenção e restauração.
4. Concluir usuários, perfil e primeiro acesso.

Mantenha cada etapa pequena, com responsável e resultado verificável. Atualize este documento quando uma proposta se tornar uma capacidade disponível.

[← Voltar ao projeto](../README.md)
