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
