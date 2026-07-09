# Câmera com auto-captura (estilo Collectr)

**Data:** 2026-07-09
**Escopo:** `src/pages/Camera.jsx` (arquivo único, sem libs novas)

## Objetivo

Eliminar o toque no botão de foto: a câmera detecta quando a carta está
posicionada e estável na moldura e captura sozinha, como no app Collectr.
O fluxo em lote (várias cartas seguidas) fica mais rápido.

## Como funciona

### Detecção de estabilidade

- A cada ~180ms, o frame atual do vídeo é desenhado num canvas **em memória**
  (32×32, nunca o `canvasRef` de captura — reutilizá-lo corromperia a resolução
  de uma captura manual concorrente) e comparado com a amostra anterior por
  diferença média de luminância por pixel.
- Máquina de estados: `aguardando-movimento → estabilizando → captura`.
  - **Aguardando movimento:** nada dispara até a cena mudar (diff acima do
    limiar). Isso impede re-captura imediata da mesma carta quando a câmera
    reabre no fluxo em lote, e captura falsa ao abrir apontando para cena
    parada.
  - **Estabilizando:** após movimento, quando a cena fica estável, um
    progresso de 0→100% corre em ~900ms. Instabilidade no meio zera e volta
    a estabilizar (sem exigir novo movimento).
  - **Captura:** progresso completo dispara `captureFrame()` — a mesma função
    do botão manual; todo o pipeline (identificar → confirmar → salvar)
    permanece intocado.
- Carência de ~600ms após a câmera ativar (ignora autofoco inicial).

### Ciclo de vida do loop

- Interval inicia só com `camState === 'active'` e `state === PREVIEW`.
- Limpo em `stopCamera()`, unmount e qualquer troca de estado.
- Estado da detecção (movimento visto, progresso) reseta a cada (re)abertura
  da câmera.

### Feedback visual

- Cantos da moldura: brancos quando aguardando/instável → **dourados**
  (#F5A623, cor de marca; verde é exclusivo de variação de preço — regra da
  Fase 2) com glow crescente conforme o progresso.
- Texto de dica muda de "Centralize a carta na moldura" para "Segure firme…"
  durante a estabilização.
- Flash branco rápido (~120ms) ao capturar, simulando obturador.
- Botão manual mantido como fallback — toque captura na hora, cancelando a
  contagem.

### Fluxo em lote

- Delay de reabertura da câmera após salvar: 300ms → 150ms.
- Nada muda no pós-captura (confirmação continua manual).

## O que NÃO muda

- `processImage`, `handleConfirm`, `reset`, guard de `scanId`, APIs.
- O caminho de salvamento (bug do "confirma e não salva" foi corrigido na
  raiz em `bb7f3db`, no backend; este trabalho não toca nele).

## Limitação aceita

Detecção por estabilidade (não por bordas do cartão): apontar parado para
qualquer cena estática após movimento também dispara. Troca consciente por
leveza (sem libs, 100% navegador).

## Teste

Verificação real exige device com câmera (iPhone). Antes do deploy:
`npm run build` limpo + revisão de código. Validação funcional pelo usuário
no PWA em produção.
