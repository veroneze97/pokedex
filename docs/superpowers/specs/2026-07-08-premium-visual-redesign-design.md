# Redesign visual premium — "momento de revelação"

## Contexto

O app já passou por 3 rodadas de redesign premium (pacotes A/B/C: profundidade, glow ambiente, tilt 3D, dígitos rolantes, view transitions) e hoje é dark OLED (#000000, verde #00E676), inspirado no Collectr. Funcionalmente está completo (Dashboard, Coleção, CardDetail, Camera), mas visualmente ainda parece "planilha bonita": listas de linhas label→valor (`DetailRow`), todo bloco no mesmo container genérico (`bg-[#101014] border rounded-xl p-5`), pouca variação de escala/peso entre elementos.

Objetivo desta rodada: quebrar essa sensação de ferramenta de dados e trazer a emoção de apps de colecionáveis premium (referências: marketplace de cartas estilo Mew V, apps fintech dark com acento único, e — a referência decisiva, validada com mockups no processo — páginas de produto Apple e experiências de abertura de pacote Pokémon: o objeto respira sozinho na primeira dobra, luz direcional em vez de glow difuso uniforme, hierarquia grande→pequeno, dados vêm depois, ao rolar).

## Escopo

Um pacote único cobrindo Dashboard, Coleção (Pokedex.jsx), CardDetail e BottomNav. Camera fica sem mudanças visuais (fora do escopo). Reskin visual + duas adições pontuais: gráfico de preço mais rico no CardDetail, e migration de dado de tipo Pokémon (necessária pro glow por tipo nos CardTiles).

## Tokens de design

Paleta (mantém preto absoluto, redefine o papel do verde):

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#000000` | fundo (inalterado) |
| `--color-surface` | `#101014` | blocos secundários (inalterado) |
| `--color-surface-2` | `#1A1A20` | hover/press (inalterado) |
| `--color-gold` | `#F5A623` → gradiente `#F5A623→#E8871E` | cor de marca: CTA primário, spotlight/glow, header ativo, ícone central do nav, badges de raridade alta |
| `--color-gold-soft` | `rgba(245,166,35,0.12)` | fundos suaves de badges/pills na cor de marca |
| `--color-green` | `#00E676` | **exclusivo** para alta de preço / P&L positivo (nunca decorativo) |
| `--color-red` | `#FF3B30` | **exclusivo** para baixa de preço / P&L negativo (nunca decorativo) |
| `--color-text-primary` | `#F4F4F6` | inalterado |
| `--color-text-secondary` | `#8E8E93` | inalterado |

Tipografia: mantém Inter (confirmado como fonte recomendada para fintech/trading dark premium). Números grandes (preço, patrimônio) ganham `tracking-tight` mais agressivo e gradiente de texto (branco→dourado, via `background-clip: text`) em vez de cor plana. `tabular-nums` padronizado em todo valor numérico.

Efeitos:
- Spotlight direcional (conic/radial gradient vindo de cima) substitui o glow ambiente difuso atual nos momentos de destaque (hero da carta, valor total do portfólio)
- Sheen holográfico animado na borda da carta no CardDetail (gradiente diagonal em loop, ~4s)
- Pequenos "sparkles" (glints) estáticos ao redor do hero da carta
- Cards da grade (`CardTile`) ganham glow de 1-2px por tipo Pokémon quando possuídos; dourado é o glow padrão para cartas sem tipo mapeado (nunca quebra o layout)

## Telas

### CardDetail — palco de revelação

Reestrutura a primeira dobra como um momento de produto, não como um card de dados:
- Altura ~560px dedicada só à carta: spotlight direcional de cima (conic-gradient blur), carta centralizada com sheen holográfico e sombra dramática, glow no "chão" abaixo da carta
- Botão de voltar flutuante (círculo translúcido com blur), sem header/barra tradicional nessa área
- Abaixo da carta: nome grande (26-28px, peso 800), set + raridade em uma linha discreta acima, preço atual como frase secundária ("Vale hoje **R$ 70,14** · ↑ 12,4%")
- Indicador sutil de scroll ("Ver detalhes ↓")
- **Ao rolar**: segue o padrão atual de seções (segmented control RAW/GRADED/POP, bloco de preço, gráfico, ficha técnica, ações de coleção), mas:
  - Bloco de preço perde a borda, número fica solto com o mesmo tratamento de gradiente/glow do hero
  - `DetailRow` (lista label→valor) é substituído por badges/fichas em grid 2 colunas para metadados (raridade, número, coleção) — só "Ilustrador" e "Adicionado" continuam em formato de linha simples (fazem sentido como lista, são poucos itens)
  - CTA principal ("Adicionar à Coleção") vira gradiente dourado com sombra, substituindo o branco sólido atual

### Dashboard — o patrimônio é o produto

- Header sticky mantém estrutura atual (blur ao rolar)
- Bloco de valor total perde a borda/container: número gigante (48-52px) com o mesmo gradiente de texto dourado e glow spotlight atrás, label acima discreta, badge de P&L abaixo, sparkline leve por último — tudo respirando no fundo preto, sem caixa
- Chips de Cartas/Progresso mantêm layout de 2 colunas, mas sem borda pesada — só separação por espaço
- Carrossel "Mais Valiosas" e grid do topo: tiles ganham o mesmo tratamento holográfico + glow por tipo dos `CardTile` da Coleção
- Blocos secundários (confirmação de atualização, progresso de atualização, relatório) mantêm o estilo atual de card com borda — são utilitários, não precisam do tratamento hero

### Coleção (Pokedex.jsx)

- Seletor de set, busca e filtros mantêm estrutura atual (são controles funcionais, não "produto")
- Bloco de progresso (owned/total) ganha o mesmo tratamento de número grande sem caixa, como no Dashboard
- Grid de `CardTile`: cada tile possuído ganha sheen holográfico sutil + glow de borda na cor do tipo (dourado como fallback); tiles não possuídos continuam com o tratamento silhueta atual, sem glow

### BottomNav

- Botão central (Escanear) troca o fundo branco sólido por gradiente dourado quando ativo, mantendo o resto do nav inalterado

## Dados — migration de tipo Pokémon

- `ALTER TABLE cards ADD COLUMN type TEXT` (nullable — nunca bloqueia o app se ausente)
- `scripts/backfill-types.js`, no mesmo padrão de `scripts/seed-set.js`: itera as cartas já salvas, busca `/v2/pt/cards/{id}` na TCGdex API em lotes (mesmo throttling de 8/300ms), extrai o primeiro tipo retornado, faz upsert
- Mapa `TYPE_COLORS` (grama, fogo, água, elétrico, psíquico, lutador, sombrio, metálico, fada, dragão, incolor → cor) definido uma vez, importado por `CardTile` e `CardDetail`
- Sem tipo salvo ou tipo fora do mapa → glow dourado padrão

## Gráfico de preço (CardDetail)

Evolui `PriceChart.jsx` a partir do histórico que já existe (`price_history`/snapshots, sem novo endpoint):
- Eixo Y com marcação de min/max
- Eixo X com marcações de data (já parcialmente existente via `PERIODS`)
- Tooltip ao tocar/arrastar sobre a linha: mostra data + preço exato daquele ponto
- Linha usa gradiente dourado com glow sutil (identidade do app) em vez de verde/vermelho — variação positiva/negativa continua sinalizada só pelo badge percentual acima do gráfico, nunca pela cor da linha

## Fora de escopo

- Camera.jsx (sem mudança visual)
- Mercado e Decks continuam "Em breve" (placeholder atual mantido — mockup do Mercado fica pra outra rodada, conforme decidido nas perguntas de escopo)
- GRADED/POP no CardDetail continuam placeholder
- Cor por tipo em qualquer lugar além do glow de borda dos `CardTile` (ex: não entra em gráficos, não entra no Dashboard)

## Verificação

- Rodar `node --experimental-websocket --env-file=.env scripts/backfill-types.js` localmente e confirmar amostra de cartas com `type` preenchido antes de aplicar em produção
- Testar CardDetail com carta sem tipo mapeado → confirma fallback dourado, sem erro
- Testar CardDetail com histórico de preço insuficiente (<2 pontos) → gráfico mantém estado vazio atual, sem quebrar
- Conferir contraste do texto sobre gradiente dourado (WCAG) nos badges e no CTA
- Testar em iPhone real (PWA) — spotlight/glow não pode pesar no scroll (usar `transform`/`opacity`, evitar animar propriedades de layout)
