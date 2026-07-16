# Versão desktop responsiva

## Contexto

O app foi construído mobile-first e nunca teve um layout de desktop de verdade: `App.jsx` tem `max-w-md mx-auto` hardcoded, então em qualquer tela ≥768px o conteúdo fica preso numa coluna estreita de celular no meio da tela, com espaço vazio nas laterais. Ao abrir o site num navegador de computador, a experiência é literalmente o app mobile encolhido — sem aproveitar a largura, sem hierarquia de página web.

Objetivo desta rodada: um layout de desktop dedicado (não responsivo "encolhido", um **template desenhado pra tela grande**) que preserve a identidade visual premium já estabelecida (dark OLED, dourado como cor de marca, "palco de revelação", ver [2026-07-08-premium-visual-redesign-design.md](2026-07-08-premium-visual-redesign-design.md)) e evite a sensação de "planilha"/dashboard genérico — layout deve ter assimetria, luz ambiente, respiro generoso, não uma grade uniforme de caixinhas iguais.

## Escopo

Breakpoint `lg:` (≥1024px) = desktop. Abaixo disso (celular e tablet retrato), zero mudança — a experiência mobile atual continua exatamente como é.

Cobre: `App.jsx` (shell), novo componente `Sidebar.jsx`, `Dashboard.jsx`, `Pokedex.jsx`, `CardDetail.jsx`, `Camera.jsx` (bloqueio no desktop). `BottomNav.jsx` passa a ser `lg:hidden`.

Fora de escopo: PWA/manifest (o app continua sendo instalável só no mobile), qualquer funcionalidade nova de dados — isso é puramente uma segunda pele de layout pra telas grandes, reaproveitando os mesmos dados/serviços.

## Direção visual — "não parecer planilha"

Referência: páginas de produto/portfólio premium (Apple, apps fintech dark, Collectr web) — não um admin dashboard genérico. Elementos que evitam a sensação de planilha:

- **Assimetria proposital**: sidebar estreita fixa + conteúdo largo, nunca colunas de mesma largura repetidas. No CardDetail, a coluna da carta e a coluna de dados têm proporções diferentes (carta ~42%, dados ~58%), não 50/50.
- **Luz ambiente contínua**: o glow radial dourado que hoje só aparece atrás do hero do Dashboard se estende como uma "atmosfera" sutil fixa atrás da sidebar no desktop (gradiente muito suave, `blur` alto, opacidade baixa) — dá sensação de profundidade em vez de fundo chapado.
- **Arte gerada pontual**: 2 ilustrações via Higgsfield (`generate_image`), mesma paleta preto/dourado, estilo minimalista/geométrico (não fotorrealista, não cartoon) —
  1. **Marca da Sidebar**: ícone pequeno (~32px) no topo da sidebar, aplicado com `.silhouette`-like treatment se necessário pra bater com o resto (traço fino, monocromático dourado).
  2. **Ilustração do bloqueio de Escanear no desktop**: cena minimalista sugerindo "celular escaneando uma carta", usada na tela cheia central quando `/camera` é acessada em `lg:`.
- **Sem grid genérico de cards repetidos ocupando a tela toda**: no Dashboard desktop, hero de patrimônio fica grande e sozinho numa faixa superior; métricas e "Mais Valiosas" ficam abaixo em blocos de tamanhos diferentes, não uma grade N×N.

## Tokens/breakpoint

Nenhum token de cor novo — reaproveita a paleta existente (`--color-gold`, `--color-bg`, etc). Único adicional: constante de breakpoint `1024px` (Tailwind `lg:`), usada tanto em CSS (`lg:` classes) quanto em JS onde for preciso decisão condicional (ex: bloqueio da Camera via `matchMedia`).

## Telas

### Shell (`App.jsx`)

- `<lg`: inalterado — `max-w-md mx-auto`, `BottomNav` fixa embaixo.
- `≥lg`: `flex` horizontal — `Sidebar` fixa à esquerda (largura ~240px, `position: sticky`/`fixed`, altura total), conteúdo à direita com `max-w-6xl mx-auto` + padding generoso (`px-12 py-10` como ponto de partida), scroll independente do conteúdo (sidebar não rola).
- Camada de "atmosfera": um único `div` fixo com radial-gradient dourado bem sutil atrás da sidebar, `pointer-events-none`, só renderizado em `≥lg`.

### Sidebar (novo componente)

- Mesmos 5 destinos do `BottomNav` (Início, Coleção, Escanear, Decks, Mercado) — mesmos ícones SVG já existentes, reaproveitados (extrair pra um arquivo compartilhado ou duplicar os componentes de ícone; decisão de implementação, não de design).
- Item ativo: pill dourada de fundo (mesmo tratamento visual do botão central do BottomNav), não apenas cor de texto — reforça a identidade de marca também no desktop.
- Ícone/marca gerado (Higgsfield) no topo, acima da lista de itens, com um espaço de respiro claro antes do primeiro item.
- Sem rodapé/copyright/user info — mantém minimalista, não vira um admin panel com avatar+menu.

### Escanear no desktop (`Camera.jsx`)

- Ao montar a rota `/camera` com `matchMedia('(min-width: 1024px)')` verdadeiro: não solicita `getUserMedia` nem monta a UI de câmera. Mostra uma tela central com a ilustração gerada, título curto ("Escaneie pelo celular") e uma frase explicando que a captura por câmera é exclusiva da versão mobile/PWA instalada.
- Sem tentativa de fallback de upload nem de webcam — é um bloqueio direto e amigável (decisão já validada com o usuário).

### Pokédex (`Pokedex.jsx`)

- Grade de cartas: `grid-cols-2` (mobile) → `sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` dentro do `max-w-6xl` do shell.
- Filtros/chips de set (se existirem acima da grade) continuam iguais, só se beneficiam da largura maior.

### CardDetail (`CardDetail.jsx`)

- `<lg`: inalterado — palco de revelação vertical, hero ~58vh, dados ao rolar.
- `≥lg`: `lg:flex lg:flex-row lg:items-start`, duas colunas com proporção ~42/58:
  - Esquerda: carta grande, `position: sticky` (acompanha o scroll até o fim do conteúdo da direita), mantém spotlight direcional + `holo-sheen`.
  - Direita: preço, gráfico (`PriceChart`), metadados (`MetaBadge` grid) — sem precisar rolar pra ver a carta, já que ela é sticky.
- Botão de voltar flutuante mantém posição (topo esquerdo), independente da coluna.

### Dashboard (`Dashboard.jsx`)

- Header + hero de patrimônio: mesma composição vertical central, só que numa faixa mais larga (`max-w-2xl` centralizado dentro do `max-w-6xl` do shell, pra não esticar os números até a borda).
- Métricas (Cartas/Progresso) e "Mais Valiosas": no desktop, "Mais Valiosas" deixa de ser carrossel de scroll horizontal (não faz sentido sem swipe) e vira uma linha de cards de tamanho fixo (`flex flex-wrap` ou grid com no máximo 3-4 colunas), lado a lado com o bloco de métricas numa composição assimétrica (ex: métricas ocupando uma faixa estreita à esquerda, "Mais Valiosas" ocupando o restante) em vez de empilhado.

## Testes/verificação

Verificação visual manual via Browser pane em 3 larguras: mobile (375px, comportamento inalterado), tablet (768px, ainda deve cair no layout mobile já que breakpoint é 1024px), desktop (1280px+, novo layout). Confirmar: sidebar não sobrepõe conteúdo, scroll independente funciona, CardDetail sticky não quebra com telas de conteúdo curto, bloqueio da Camera não tenta pedir permissão de câmera no desktop.
