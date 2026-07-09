# Performance & Navegação — ajustes cirúrgicos

**Data:** 2026-07-09
**Status:** Aprovado

## Problema

App lento em 4 pontos: carregamento inicial, troca de aba (Dashboard ↔ Coleção), scroll na grade de cartas, botão de atualizar preços. Já era lento antes do redesign visual (Fase 2) e piorou desde então.

Causas identificadas:
1. `Dashboard` e `Pokedex` chamam `fetchAllData()` de forma independente a cada mount — toda troca de aba refaz a chamada de rede inteira do zero, sem cache compartilhado.
2. `/api/cards` (api/cards.js) devolve payload maior do que o necessário: `collection` traz o objeto completo da carta via join (`cards(*)`), duplicando dados já presentes no array `cards`; `price_history` é buscado sem filtro/limite (1044 linhas hoje, cresce a cada atualização de preço) e deduplicado no client, quando poderia vir já filtrado do banco.
3. `App.jsx` importa `Dashboard`, `Pokedex`, `CardDetail` e `Camera` de forma síncrona — o bundle inicial carrega código da Câmera mesmo quando o usuário nunca abre essa aba.
4. `CardTile` não é memoizado e as listas derivadas (`filtered`, `sorted`) em `Pokedex.jsx` são recalculadas em todo re-render — qualquer digitação na busca ou troca de filtro recria todos os até ~859 tiles.

## Escopo

Só os 4 ajustes acima. Sem dependências novas (nada de React Query, sem virtualização de lista, sem paginação de API). Não mexe no custo de `box-shadow` + `holo-sheen` animado nas cartas possuídas — item conhecido, fora de escopo aqui.

## Mudanças

### 1. Cache compartilhado (`src/services/dataCache.js`, novo arquivo)
Módulo em memória por cima de `fetchAllData()`: primeira chamada busca da rede; chamadas seguintes na mesma sessão devolvem o cache imediatamente e revalidam em background (stale-while-revalidate). Invalidado por qualquer mutação (adicionar/remover/atualizar carta na coleção, salvar preço, snapshot de portfólio). `Dashboard.jsx` e `Pokedex.jsx` passam a usar esse módulo em vez de chamar `fetchAllData()` direto.

### 2. Payload enxuto (`api/cards.js`)
- `collection` deixa de trazer `cards(*)` completo; passa a selecionar só os campos que `Dashboard` usa do objeto aninhado (`name, image_url, type, set_code`) ou remove o join e casa por `card_id` no client contra o array `cards` já carregado.
- `price_history`: query troca de "todas as linhas, dedup no client" para trazer só a linha mais recente por `card_id` (via SQL, ex. `distinct on`), reduzindo de ~1044 para ~125 linhas hoje.

### 3. Code-splitting de rotas (`App.jsx`)
`Dashboard`, `Pokedex`, `CardDetail` e `Camera` passam de import estático para `React.lazy`, envoltos em `<Suspense fallback={<PokeballLoader />}>`.

### 4. Grade memoizada (`CardTile.jsx`, `Pokedex.jsx`)
- `CardTile` envolvido em `React.memo`.
- `filtered` e `sorted` em `Pokedex.jsx` memoizados com `useMemo`, dependências corretas (cards, collection, prices, filtro, busca, set ativo, ordenação).

## Teste / verificação
Rodar `npm run build` (checar bundle dividido em chunks por rota) e testar no preview: abrir app → trocar entre Dashboard/Coleção duas vezes (2ª troca deve ser instantânea, sem spinner) → digitar na busca da Coleção (sem travar) → abrir uma carta e voltar → confirmar que dados continuam corretos (preços, quantidades, progresso).
