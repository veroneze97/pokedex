-- Permite múltiplas linhas em `sets` para o mesmo tcgdex_id (uma por idioma/locale).
-- Antes: 1 set da TCGdex = 1 linha. Agora: 1 set da TCGdex pode virar N coleções
-- independentes no catálogo (ex: 'me04' PT-BR = "Caos Ascendente" e 'me04-en' EN = "Chaos Rising").
-- A unicidade real do catálogo continua garantida por `sets.id` (PRIMARY KEY).

ALTER TABLE sets DROP CONSTRAINT sets_tcgdex_id_key;
