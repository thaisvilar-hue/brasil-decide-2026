# Brasil Decide 2026 — versão 2 (adaptador experimental TSE)

Dashboard eleitoral independente. **Não é um site oficial do TSE.**

## O que foi implementado
- Endpoint `/api/results` que tenta ler o EA20 nacional e 27 UFs da eleição presidencial de segundo turno (código 6258).
- Validação defensiva: sem dados, números inválidos ou esquema incompatível => não mostra votos como oficiais.
- Cache de 45 segundos, timeout e consulta paralela das UFs.
- Mapa do Brasil, modo demonstração e atualização periódica na interface existente.

## Limitações importantes
- **A integração ainda não foi validada ponta a ponta com resposta real do TSE.** O ambiente de execução não conseguiu acessar a CDN do TSE para testar o esquema atual.
- Municípios e exterior ainda não estão conectados ao EA20. A interface mostra ausência de dados, não inventa resultados.
- `updatedAt` é o horário da leitura do nosso servidor, não o horário de geração do arquivo pelo TSE.
- Os códigos de eleição devem ser conferidos no `ele-c.json` antes do uso público; a URL de segundo turno foi identificada em fontes externas, mas não verificada diretamente na CDN.
- A rota `/api/results` é uma função serverless e **não roda apenas abrindo `index.html` ou no AppBlock do ChatGPT**. Requer ambiente compatível com funções serverless, como Vercel.

## Publicação
1. Suba os arquivos para um repositório GitHub.
2. Importe na Vercel como projeto Other.
3. Faça Deploy e abra `/api/results` para validar o retorno.
4. Confirme que `status` é `live`, que os votos batem com `https://resultados.tse.jus.br/` e que o turno está correto. Só depois compartilhe como painel de apuração.

## Referências
- https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados
