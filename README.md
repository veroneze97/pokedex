# PokéDex PT-BR

PWA mobile-first para catalogar cartas **Pokémon TCG em português (PT-BR)** com scanner por IA, preços em tempo real e acompanhamento do valor da coleção estilo portfólio.

## Funcionalidades

- 📷 **Scanner de cartas** — fotografe a carta e o Claude Vision identifica nome, número, set e raridade (aceita apenas impressões PT-BR)
- 💰 **Preços automáticos** — busca na Pokémon TCG API com conversão USD→BRL pela cotação do dia (AwesomeAPI, cache de 1h)
- 📈 **Portfólio** — valor total da coleção com histórico diário (sparkline), top cartas mais valiosas e variação por atualização
- 📚 **Coleção visual** — grade de cartas com silhueta para as faltantes, progresso por set
- 📴 **Offline** — último payload fica em cache no localStorage; sem rede o app segue utilizável com banner de aviso
- 📱 **PWA instalável** — dark mode OLED (`#0A0A0C`), ícones e theme-color no tema

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Vercel Serverless Functions (`/api`) |
| Banco | Supabase (PostgreSQL, RLS total — acesso só via service role) |
| IA | Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| Deploy | Vercel (push na `main` → deploy automático) |

Sets suportados: **Fogo Fantasmagórico** (`PFLpt`, 130 cartas) e **Mega Evolution** (`ME1pt`, 188 cartas).

## Setup

1. **Banco**: crie um projeto no Supabase e rode [supabase-schema.sql](supabase-schema.sql) no SQL Editor (tabelas + RLS).
2. **Env vars**: copie `.env.example` para `.env` e preencha. No Vercel, configure as mesmas variáveis em *Settings → Environment Variables*:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — servidor
   - `ANTHROPIC_API_KEY` — servidor (scanner)
   - `APP_SECRET` + `VITE_APP_SECRET` (mesmo valor) — proteção dos endpoints POST
3. **Seed do catálogo**: os SQLs de seed dos sets são aplicados direto no Supabase (ver `scripts/`).
4. **Rodar local**:

```bash
npm install
npm run dev        # frontend (as rotas /api só rodam no Vercel)
npm run lint       # ESLint
npm run build      # build de produção
```

> Para testar as functions localmente: `npx vercel dev`.

## Arquitetura

```
src/
  pages/        Dashboard, Pokedex, CardDetail, Camera
  components/   BottomNav, CardTile, PriceChart, OfflineBanner...
  services/     api.js (fetch → /api/*), http.js (header de auth)
api/
  cards.js               GET catálogo + coleção + preços + portfólio
  card-detail.js         GET detalhe de uma carta
  collection.js          GET coleção / POST adicionar carta (+ snapshot)
  identify.js            POST scanner via Claude Vision (rate limit + auth)
  price.js               POST preço via Pokémon TCG API (cotação dinâmica)
  save-price.js          POST grava preço no histórico
  portfolio-snapshot.js  POST snapshot diário do valor total
  _auth.js / _portfolio.js   helpers (não viram rotas)
```

**Regra de ouro:** o frontend nunca fala com o Supabase — todo acesso passa pelas functions com a service role key. As tabelas têm RLS habilitado sem policies, então a anon key não acessa nada.
