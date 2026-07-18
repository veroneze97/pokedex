# Navegação anterior/próxima no CardDetail

## Contexto

Adicionar cartas manualmente (via `CardDetail.jsx`) hoje exige voltar pra Coleção, achar a próxima carta faltante, abrir, adicionar preço/quantidade, e repetir — um ciclo de navegação completo por carta. Isso trava um fluxo que deveria ser rápido (folhear um binder e ir preenchendo).

## Escopo

Adiciona navegação anterior/próxima dentro do `CardDetail.jsx`, entre as cartas do mesmo set, ordenadas por número. Não muda a Coleção/Pokedex nem cria nenhuma rota nova — só dois botões na tela de detalhe.

## Design

**UI:** dois botões circulares translúcidos (mesmo tratamento visual do botão de voltar já existente: `rgba(20,20,20,0.5)` + `backdrop-blur`), posicionados nas laterais verticais do palco da carta (esquerda "‹", direita "›"), sobre o hero de revelação. Desabilitados (opacidade reduzida, sem `onClick`) quando a carta atual é a primeira/última do set.

**Dados de navegação:** `CardDetail.jsx` passa a chamar `getCachedData()` (o mesmo cache stale-while-revalidate já usado por `Dashboard.jsx`/`Pokedex.jsx`, sem custo de rede extra na maioria das vezes) para obter a lista completa de cartas do catálogo. Filtra por `set_code === card.set_code`, ordena por `number` (numérico), localiza o índice da carta atual e deriva `prevId`/`nextId`.

**Navegação:** clicar em "‹"/"›" chama `navigate(`/card/${id}`, { viewTransition: true })` — mesma rota já existente, só troca o parâmetro. `useEffect` que carrega a carta já reage a mudanças de `id` (`useEffect(() => { loadCard() }, [id])`), então a troca de carta funciona sem mudança adicional nesse mecanismo.

**Ordem:** sempre por número dentro do mesmo set — independente do filtro/ordenação que estava ativo na tela da Coleção antes de abrir a carta. Navega por todas as cartas do set (possuídas ou não), não só as faltando.

**Fora de escopo:** gestos de swipe (decisão explícita — evita conflito com o tilt 3D já existente na imagem da carta), navegação cross-set, e respeitar a ordenação/filtro da tela anterior.

## Testes/verificação

Sem lógica pura nova que justifique teste unitário isolado (é essencialmente slice+sort+index de um array já carregado) — verificação é visual: abrir uma carta do meio de um set, confirmar que "‹"/"›" levam às cartas number-1/number+1 corretas, e que nas pontas do set o botão correspondente fica desabilitado.
