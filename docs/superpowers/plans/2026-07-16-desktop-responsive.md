# Versão Desktop Responsiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao PokéDex PT-BR um template de desktop dedicado (sidebar, layout wide, split-view no CardDetail) para telas ≥1024px, sem alterar em nada a experiência mobile existente.

**Architecture:** Um breakpoint único (`lg:` do Tailwind, 1024px) decide entre o shell mobile atual (BottomNav + `max-w-md`) e um novo shell desktop (Sidebar fixa + conteúdo largo). Páginas existentes ganham classes `lg:` adicionais e, no caso do CardDetail, um layout alternativo condicional — sem duplicar componentes de dados, só o wrapper visual. Um hook compartilhado (`useIsDesktop`) decide comportamento condicional em JS (bloqueio da Camera).

**Tech Stack:** React 19, Tailwind CSS 4 (utilities `lg:`), React Router 6 (`useNavigate`/`useLocation`), `node:test` para lógica pura (sem DOM).

## Global Constraints

- Breakpoint desktop = `1024px` (Tailwind `lg:`). Abaixo disso, ZERO mudança de comportamento ou classes existentes.
- Paleta e tokens de `src/index.css` não mudam — reaproveitar `--color-bg`, `--color-gold` (`#F5A623`/`#E8871E`), `--color-surface` (`#101014`), bordas `border-white/[0.06]`.
- Assets de imagem gerados já existem em `public/desktop/sidebar-brand.png` (1024×1024, fundo transparente) e `public/desktop/camera-desktop-blocked.png` (1200×896, fundo escuro) — usar esses arquivos, não gerar novos.
- Nenhuma mudança de schema/API — puramente front-end.
- Estilo de código do projeto: sem ponto-e-vírgula ao final de statements simples é aceito em ambos os estilos presentes no repo — siga o arquivo que estiver editando (`Pokedex.jsx`/`Dashboard.jsx` usam sem `;` na maioria das linhas JSX/lógica; siga esse padrão em arquivos novos).

---

### Task 1: `useIsDesktop` hook com lógica pura testável

**Files:**
- Create: `src/hooks/useIsDesktop.js`
- Test: `test/useIsDesktop.test.js`

**Interfaces:**
- Produces: `isDesktopWidth(width: number): boolean` (função pura exportada, `width >= 1024`), e `useIsDesktop(): boolean` (hook React, usa `window.matchMedia('(min-width: 1024px)')`, atualiza em `resize`/mudança de media query).
- Consumes: nada (task independente).

- [ ] **Step 1: Escrever o teste da função pura**

```js
// test/useIsDesktop.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { isDesktopWidth } from '../src/hooks/useIsDesktop.js'

test('considera desktop a partir de 1024px', () => {
  assert.equal(isDesktopWidth(1023), false)
  assert.equal(isDesktopWidth(1024), true)
  assert.equal(isDesktopWidth(1440), true)
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test test/useIsDesktop.test.js`
Expected: FAIL — `Cannot find module '../src/hooks/useIsDesktop.js'`

- [ ] **Step 3: Implementar o hook e a função pura**

```js
// src/hooks/useIsDesktop.js
import { useEffect, useState } from 'react'

export function isDesktopWidth(width) {
  return width >= 1024
}

export function useIsDesktop() {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false

  const [isDesktop, setIsDesktop] = useState(getMatch)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `node --test test/useIsDesktop.test.js`
Expected: PASS (1 teste, 3 assertions)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIsDesktop.js test/useIsDesktop.test.js
git commit -m "feat: hook useIsDesktop com predicado testável para breakpoint 1024px"
```

---

### Task 2: Extrair ícones/tabs de navegação para módulo compartilhado

**Files:**
- Create: `src/components/navTabs.jsx`
- Modify: `src/components/BottomNav.jsx`

**Interfaces:**
- Produces: `export const tabs` — array `{ path, label, Icon, center? }` (mesma forma já usada em `BottomNav.jsx`), e os componentes `HomeIcon`, `CollectionIcon`, `CameraIcon`, `DecksIcon`, `MarketIcon` (todos recebem prop `{ heavy }`).
- Consumes: nada.

Motivo: a Task 3 (Sidebar) precisa dos mesmos ícones e da mesma lista de destinos — hoje eles só existem dentro de `BottomNav.jsx`. Extrair evita duplicar 5 SVGs.

- [ ] **Step 1: Criar o módulo compartilhado com o conteúdo movido de BottomNav.jsx**

Copie exatamente as linhas 4–57 do `BottomNav.jsx` atual (helper `strokeProps`, os 5 componentes de ícone `HomeIcon`/`CollectionIcon`/`CameraIcon`/`DecksIcon`/`MarketIcon`, e o array `tabs`) para o novo arquivo:

```jsx
// src/components/navTabs.jsx
// Ícones outline (traço), estilo SF Symbols/Lucide.
// Ativo = traço mais pesado + cor clara; inativo = traço fino + cinza.
const strokeProps = heavy => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: heavy ? 2.4 : 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export const HomeIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
)

export const CollectionIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m12 2 10 5-10 5L2 7z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
)

export const CameraIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-6 h-6">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
)

export const DecksIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="m3.29 7 8.71 5 8.71-5" />
    <path d="M12 22V12" />
  </svg>
)

export const MarketIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
)

export const tabs = [
  { path: '/',        label: 'Início',   Icon: HomeIcon },
  { path: '/pokedex', label: 'Coleção',  Icon: CollectionIcon },
  { path: '/camera',  label: 'Escanear', Icon: CameraIcon, center: true },
  { path: '/decks',   label: 'Decks',    Icon: DecksIcon },
  { path: '/market',  label: 'Mercado',  Icon: MarketIcon },
]
```

- [ ] **Step 2: Atualizar BottomNav.jsx para importar do módulo novo em vez de definir os ícones**

Substitua as linhas 1–57 de `src/components/BottomNav.jsx` (imports + ícones + `tabs`) por:

```jsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tabs } from './navTabs'
```

O resto do arquivo (função `BottomNav`, a partir de `export default function BottomNav()`) permanece idêntico.

- [ ] **Step 3: Verificar que o app ainda builda sem erros**

Run: `npm run build`
Expected: build conclui sem erro (nenhum símbolo não resolvido)

- [ ] **Step 4: Commit**

```bash
git add src/components/navTabs.jsx src/components/BottomNav.jsx
git commit -m "refactor: extrai ícones/tabs de navegação para módulo compartilhado"
```

---

### Task 3: Componente Sidebar (navegação desktop)

**Files:**
- Create: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `tabs` de `./navTabs` (Task 2).
- Produces: `export default function Sidebar()` — nenhum prop, sem estado externo (lê rota via `useLocation`, navega via `useNavigate`, igual ao `BottomNav`).

- [ ] **Step 1: Criar o componente**

```jsx
// src/components/Sidebar.jsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tabs } from './navTabs'

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <aside
      className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full px-4 py-8 gap-1"
      style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3 px-2 mb-8">
        <img src="/desktop/sidebar-brand.png" alt="" className="w-9 h-9" />
        <span className="text-[#F4F4F6] text-[15px] font-bold tracking-tight">PokéDex</span>
      </div>

      {tabs.map(({ path, label, Icon }) => {
        const active = pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path, { viewTransition: true })}
            className={`pressable flex items-center gap-3 px-4 rounded-xl text-[14px] font-medium transition-colors ${
              active ? 'text-[#000000]' : 'text-[#8E8E93] hover:text-[#F4F4F6]'
            }`}
            style={{
              minHeight: 46,
              background: active ? 'linear-gradient(135deg, #F5A623, #E8871E)' : 'transparent',
            }}
          >
            <Icon heavy={active} />
            {label}
          </button>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: componente Sidebar para navegação desktop"
```

---

### Task 4: Shell responsivo em App.jsx + atmosfera de luz

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Sidebar` (Task 3, default export de `./components/Sidebar`).
- Produces: nada consumido por outras tasks — é o nó raiz do layout.

- [ ] **Step 1: Editar o componente `Inner` em `src/App.jsx`**

Troque o corpo de `Inner` (a `div` com `max-w-md mx-auto` e tudo dentro) por:

```jsx
import Sidebar from './components/Sidebar'

function Inner() {
  const location = useLocation()
  const hideNav = location.pathname === '/camera'

  return (
    <div className="h-full lg:flex relative">
      {/* Atmosfera: glow dourado sutil fixo atrás da sidebar, só no desktop */}
      <div
        className="hidden lg:block absolute pointer-events-none"
        style={{
          top: -200, left: -200, width: 500, height: 700,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(245,166,35,0.10), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <Sidebar />

      <div className="h-full max-w-md mx-auto lg:max-w-none lg:mx-0 lg:flex-1 relative overflow-hidden">
        <div className="h-full overflow-y-auto scroll-hide lg:px-12 lg:py-10">
          <div className="lg:max-w-6xl lg:mx-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full bg-[#000000]">
                <PokeballLoader text="Carregando..." />
              </div>
            }>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pokedex" element={<Pokedex />} />
                <Route path="/card/:id" element={<CardDetail />} />
                <Route path="/camera" element={<Camera />} />
                <Route path="/decks" element={<ComingSoon title="Decks" />} />
                <Route path="/market" element={<ComingSoon title="Mercado" />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>

      {!hideNav && (
        <div className="vt-nav lg:hidden absolute bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  )
}
```

Note: o `<Suspense>` com as `<Routes>` continua exatamente igual por dentro — só a estrutura de wrappers ao redor mudou. Mantenha os imports já existentes de `Dashboard`, `Pokedex`, `CardDetail`, `Camera`, `ComingSoon`; adicione só `import Sidebar from './components/Sidebar'` no topo do arquivo.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 3: Checagem visual manual (mobile continua igual)**

Suba o dev server (`npm run dev`), abra em 375px de largura, confirme visualmente que nada mudou: BottomNav visível, conteúdo em coluna estreita, sem sidebar.

- [ ] **Step 4: Checagem visual manual (desktop)**

Redimensione para 1280px+, confirme: sidebar visível à esquerda com marca+5 itens, BottomNav sumiu, conteúdo centralizado e largo (não mais uma coluna estreita de celular no meio da tela).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: shell desktop responsivo com Sidebar fixa e conteúdo wide (>=1024px)"
```

---

### Task 5: Grade da Pokédex responsiva

**Files:**
- Modify: `src/pages/Pokedex.jsx:232`

**Interfaces:**
- Consumes: nada novo (task isolada de CSS).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Trocar a classe fixa da grade**

Em `src/pages/Pokedex.jsx`, linha 232, troque:

```jsx
<div className="grid grid-cols-2 gap-4">
```

por:

```jsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
```

- [ ] **Step 2: Checagem visual manual**

No Browser pane, abra `/pokedex` em 375px (deve continuar 2 colunas), depois 1280px (deve virar 4 colunas) e 1600px (5 colunas). Confirme que os `CardTile` não esticam de forma estranha (devem manter `aspectRatio` da carta).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Pokedex.jsx
git commit -m "feat: grade de cartas responsiva na Pokédex desktop"
```

---

### Task 6: CardDetail — split 2 colunas no desktop

**Files:**
- Modify: `src/pages/CardDetail.jsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: nada consumido por outras tasks.

O hero (linhas 140–241 do arquivo atual) e o bloco de dados (linhas 243 em diante, dentro de `<div className="px-5 pt-6 space-y-4">`) precisam ficar lado a lado no desktop em vez de empilhados. Estratégia: envolver os dois blocos existentes num wrapper flex que só ativa em `lg:`, sem duplicar JSX.

- [ ] **Step 1: Envolver hero + bloco de dados num wrapper flex**

Troque a abertura do `return` (linha 140):

```jsx
  return (
    <div className="min-h-full bg-[#000000] pb-32">
```

por:

```jsx
  return (
    <div className="min-h-full bg-[#000000] pb-32 lg:flex lg:gap-10 lg:items-start lg:pb-16">
```

- [ ] **Step 2: Tornar o hero sticky e com largura própria no desktop**

Na `div` do hero (linha 146-149 atual):

```jsx
      <div
        className="safe-top relative flex flex-col items-center justify-end overflow-hidden"
        style={{ height: '58vh', paddingBottom: 28 }}
      >
```

troque por:

```jsx
      <div
        className="safe-top relative flex flex-col items-center justify-end overflow-hidden lg:w-[42%] lg:flex-shrink-0 lg:sticky lg:top-10 lg:rounded-3xl"
        style={{ height: '58vh' }}
      >
```

(Removido o `paddingBottom: 28` inline fixo do mobile-only — no desktop o hero fica sticky e não precisa da folga para o "indício de scroll"; no mobile isso é puramente cosmético, então adicione de volta condicionalmente via classe: use `className="... pb-7 lg:pb-0"` em vez de remover — ou seja, a linha final fica:)

```jsx
      <div
        className="safe-top relative flex flex-col items-center justify-end overflow-hidden pb-7 lg:w-[42%] lg:flex-shrink-0 lg:sticky lg:top-10 lg:rounded-3xl lg:pb-10"
        style={{ height: '58vh' }}
      >
```

- [ ] **Step 3: Dar largura própria ao bloco de dados**

Na `div` que abre o bloco de dados (linha 243 atual):

```jsx
      <div className="px-5 pt-6 space-y-4">
```

troque por:

```jsx
      <div className="px-5 pt-6 space-y-4 lg:flex-1 lg:pt-10">
```

- [ ] **Step 4: Esconder o "indício de scroll" no desktop**

Esse elemento (por volta da linha 232, `{/* Indício de scroll */}`) só faz sentido quando o conteúdo abaixo exige rolar — no desktop, com sticky, ele é ruído visual. Ache:

```jsx
        <div className="relative z-[2] flex flex-col items-center gap-1 mt-5 opacity-50">
```

troque por:

```jsx
        <div className="relative z-[2] flex flex-col items-center gap-1 mt-5 opacity-50 lg:hidden">
```

- [ ] **Step 5: Checagem visual manual**

No Browser pane, abra uma carta em `/card/:id`:
- 375px: idêntico a antes (hero em cima, dados ao rolar, indício de scroll visível).
- 1280px+: carta à esquerda (~42% de largura) fixa durante o scroll, dados de preço/gráfico/metadados à direita, sem indício de scroll, botão de voltar continua no canto superior esquerdo funcionando.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CardDetail.jsx
git commit -m "feat: CardDetail em split 2 colunas no desktop (carta sticky + dados ao lado)"
```

---

### Task 7: Dashboard — composição assimétrica no desktop

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Limitar a largura do hero de patrimônio no desktop**

Na `div` do hero (linha 168 atual):

```jsx
        <div className="relative text-center py-4 overflow-hidden">
```

troque por:

```jsx
        <div className="relative text-center py-4 overflow-hidden lg:max-w-2xl lg:mx-auto">
```

- [ ] **Step 2: Composição assimétrica métricas + Mais Valiosas**

Hoje métricas (linha 211) e "Mais Valiosas" (linha 225) são duas seções empilhadas independentes. Envolva as duas numa `div` flex que só ativa no desktop, com métricas ocupando uma coluna estreita e "Mais Valiosas" o restante.

Ache a abertura da seção de métricas:

```jsx
        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3">
```

troque por (abre o wrapper):

```jsx
        <div className="lg:flex lg:gap-8 lg:items-start">

        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3 lg:flex-col lg:w-56 lg:flex-shrink-0">
```

Ache o fechamento da seção "Mais Valiosas" (o `</div>` que fecha o bloco `{top3.length > 0 && ( ... )}`, logo antes de `{/* ── Confirm update ─────... */}`) e feche o wrapper logo depois dele, adicionando uma `</div>` extra:

```jsx
        )}

        </div>

        {/* ── Confirm update ─────────────────────────────────────────────────── */}
```

No desktop, dentro de `lg:flex-col lg:w-56`, os dois chips de métrica (`flex-1 bg-[#101014]...`) ficam um embaixo do outro (o `lg:flex-col` do pai já cuida disso, sem precisar mudar as classes internas dos chips).

- [ ] **Step 3: Remover o comportamento de carrossel de "Mais Valiosas" no desktop**

Ache a `div` com `overflow-x-auto` do carrossel (por volta de `className="overflow-x-auto scroll-hide -mx-5"`):

```jsx
            <div
              className="overflow-x-auto scroll-hide -mx-5"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
              }}
            >
              <div className="flex gap-3 px-5 pb-1" style={{ width: 'max-content' }}>
```

troque por (mask só no mobile, e o container interno vira wrap no desktop):

```jsx
            <div
              className="overflow-x-auto scroll-hide -mx-5 lg:overflow-visible lg:mx-0"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
              }}
            >
              <div className="flex gap-3 px-5 pb-1 lg:flex-wrap lg:px-0" style={{ width: 'max-content' }}>
```

Nota: a `maskImage` inline continua aplicada mesmo com `lg:overflow-visible` — isso é cosmético e inofensivo (máscara sem overflow não corta nada), não precisa de lógica condicional em JS.

- [ ] **Step 4: Checagem visual manual**

No Browser pane: 375px idêntico a antes (carrossel com swipe horizontal). 1280px+: hero centralizado em coluna mais estreita, métricas numa coluna à esquerda empilhadas verticalmente, "Mais Valiosas" à direita em cards que quebram linha (wrap) em vez de scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: Dashboard com composição assimétrica no desktop (métricas + Mais Valiosas lado a lado)"
```

---

### Task 8: Bloqueio da Camera no desktop

**Files:**
- Modify: `src/pages/Camera.jsx`

**Interfaces:**
- Consumes: `useIsDesktop` de `../hooks/useIsDesktop` (Task 1).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Importar o hook e checar desktop antes de qualquer lógica de câmera**

No topo de `src/pages/Camera.jsx`, adicione o import:

```jsx
import { useIsDesktop } from '../hooks/useIsDesktop'
```

Logo após a linha `export default function Camera() {`, adicione:

```jsx
  const isDesktop = useIsDesktop()
```

- [ ] **Step 2: Renderizar a tela de bloqueio antes do JSX normal, sem montar `<video>`/câmera**

Localize o `return` principal do componente (linha `return ( <div className="relative flex flex-col h-full bg-[#000000] overflow-hidden">`). Logo antes desse `return`, adicione:

```jsx
  if (isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#000000] gap-6 px-8 text-center">
        <img
          src="/desktop/camera-desktop-blocked.png"
          alt=""
          className="w-full max-w-sm rounded-2xl"
        />
        <div>
          <p className="text-[#F4F4F6] text-[19px] font-bold mb-2">Escaneie pelo celular</p>
          <p className="text-[#8E8E93] text-sm leading-relaxed max-w-xs mx-auto">
            A captura de cartas por câmera é exclusiva da versão mobile/PWA instalada no seu celular.
          </p>
        </div>
        <button
          onClick={() => navigate('/', { viewTransition: true })}
          className="pressable h-12 px-6 rounded-xl bg-[#F4F4F6] text-[#000000] text-sm font-semibold"
        >
          Voltar ao início
        </button>
      </div>
    )
  }
```

Isso garante que `startCamera()`/`getUserMedia` nunca são chamados no desktop — o early return acontece antes de qualquer `useEffect` de câmera rodar (React ainda executa os hooks já declarados acima no corpo da função, mas nenhum deles chama `getUserMedia` no mount; quem chama é `startCamera`, disparado só por clique no botão "Ativar Câmera" que não existe mais nesse branch).

- [ ] **Step 3: Checagem visual manual**

No Browser pane: acesse `/camera` em 375px — comportamento de câmera idêntico a antes (pede permissão, mostra "Ativar Câmera"). Em 1280px+, acesse `/camera` (pelo ícone da Sidebar) — deve mostrar a ilustração + texto de bloqueio, sem nenhum prompt de permissão de câmera do navegador.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Camera.jsx
git commit -m "feat: bloqueia captura por câmera no desktop, direciona para o celular"
```

---

## Verificação final (todas as tasks aplicadas)

Com o dev server rodando (`npm run dev`), percorrer no Browser pane:
1. 375px: Dashboard, Pokédex, CardDetail, Camera — tudo pixel-idêntico ao comportamento antes deste plano.
2. 768px (tablet): ainda deve cair no layout mobile (breakpoint é 1024px, não 768px).
3. 1280px: Sidebar visível, sem BottomNav; Dashboard com composição assimétrica; grade da Pokédex em 4 colunas; CardDetail em split 2 colunas com carta sticky; `/camera` mostra bloqueio sem pedir permissão.
4. 1600px: grade da Pokédex em 5 colunas, layout não estica ao ponto de ficar com espaços vazios enormes (limitado por `lg:max-w-6xl` no shell).
