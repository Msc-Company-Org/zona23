# Votos e equipes

Na área da equipe, abra **Dia da eleição → Votos e equipes**. Cartório, juízo e promotoria consultam; apenas o cartório importa resultados. O módulo não aparece no acervo público nem nos menus de campo.

## Consulta

- Escolha o pleito e procure colégio, seção ou identificação da urna.
- Consulte aptos, comparecimento, abstenção e votos por cargo na seção. O resumo do colégio soma votos das seções com dados no filtro, mantendo cada cargo separado.
- Veja mesários, ASE, administradores de prédio e coletores de justificativa, com função, seção e presença disponível nas convocações.
- ASE cadastrados na escala sem lotação aparecem em **Equipe sem lotação cadastrada**. Essa relação não informa quem está escalado para uma data específica; consulte também **Escala ASE**.

Funções são agrupadas pelo texto da convocação; funções não reconhecidas permanecem em **Outras funções**. Listas vazias significam ausência de registros cadastrados, não confirmação de que a equipe não existe.

A taxa de abstenção é `100 × (aptos − comparecimento) / aptos`. No resumo, são usados os totais das seções com resultados, e a cobertura é exibida. Seções sem resultados não contam como zero. Aptos do resultado são próprios do pleito e não são substituídos pelo cadastro atual de locais.

## Importar

Este primeiro módulo recebe JSON conferido pelo cartório. A sincronização existente do TSE acompanha o status da totalização; ela ainda não importa automaticamente votos, comparecimento ou identificação de urna para este módulo.

Exemplo **sintético**, apenas para um ambiente de teste:

```json
{
  "pleito": "SIMULACAO",
  "fonte": "Boletim sintético para validação",
  "secoes": [
    {
      "secao": 145,
      "urna": "TESTE-145",
      "aptos": 100,
      "comparecimento": 80,
      "votos": [
        {"cargo": "Presidente", "candidato": "Candidato de teste", "numero": "00", "votos": 75},
        {"cargo": "Presidente", "candidato": "Branco", "numero": "", "votos": 3},
        {"cargo": "Presidente", "candidato": "Nulo", "numero": "", "votos": 2}
      ]
    }
  ]
}
```

1. Confira pleito, fonte, seções e identificação de urna no documento de origem.
2. Cole o JSON em **Importar resultados por seção**.
3. Confirme a gravação: as seções do lote substituem seus resultados anteriores **somente naquele pleito**. As demais seções são preservadas.
4. Confira cobertura, fonte e resultados na tela.

O lote é validado inteiro antes da gravação: seções precisam pertencer ao cadastro da Zona 023, sem duplicatas; contagens são inteiros não negativos e comparecimento não pode superar aptos. A soma dos votos por cargo depende das regras daquele cargo e deve ser conferida na fonte. Votos de cargos diferentes não devem ser somados como quantidade de eleitores.

Resultados são agregados por seção. Nenhum dado associa o voto a um eleitor. Listas nominais e os resultados importados ficam no banco privado, fora do Git. A identificação informada da urna representa o resultado importado; histórico de substituição de equipamentos ainda não está implementado.

## API e validação

`GET /api/eleicao/mapeamento?pleito=...` consulta resultados e equipes. `POST /api/eleicao/mapeamento` importa o lote, com sessão e auditoria. A migração acrescenta `resultados_secoes` sem alterar os registros anteriores do acervo.

Verificações: `bun run check`, `bun test`, `node --check public/mapeamento.js`, `node --check public/equipe.js` e `git diff --check`. A publicação exige backup, acesso à VPS e revisão visual conforme o guia de deploy; commits no GitHub não publicam automaticamente.
