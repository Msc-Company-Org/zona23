# 🤝 Como contribuir

Uma boa contribuição explica o problema e facilita a revisão por outra pessoa.

## 💡 Sugerir uma melhoria

Abra uma issue com:

1. **Contexto:** página ou tarefa afetada.
2. **Resultado atual:** o que acontece hoje.
3. **Resultado esperado:** o que deveria acontecer.
4. **Exemplo:** passos para reproduzir e imagem, quando útil.

Para títulos e botões, consulte [Textos e navegação](docs/textos-e-navegacao.md). Considere celular, legibilidade e acessibilidade.

## 🛠️ Preparar uma alteração

```sh
git switch -c melhoria/nome-descritivo
bun install --frozen-lockfile
bun run dev
```

Mantenha a mudança focada. Não inclua banco, fotos reais, backups, `.env`, credenciais ou dados pessoais de terceiros.

## ✅ Validar antes do pull request

```sh
bun run check
bun test
git diff --check
```

Para mudanças visuais, confira desktop e celular, teclado, nomes dos controles e movimento reduzido. Use imagens sintéticas nos testes.

## 📬 Descrever o pull request

- Explique o problema e o comportamento resultante.
- Informe os testes e resultados.
- Mostre uma captura se a interface mudou.
- Atualize os documentos afetados.
- Informe mudanças em dados, configuração ou operação.

Mesclar código **não publica automaticamente**. A implantação segue o [guia de operação](deploy/README.md).

## 🔒 Relatar falhas de segurança

Não exponha credenciais ou dados reais em issues abertas. Se o relato privado do GitHub estiver disponível, use-o; caso contrário, contate os responsáveis por um canal privado já conhecido.
