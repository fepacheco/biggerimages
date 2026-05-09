# Gelato Week 2026 Berlin — Checklist 🍦🗺️

Single-page web app com mapa de todas as sorveterias da Gelato Week 2026 em Berlim e checklist persistido no navegador.

Fonte dos dados: <https://true-italian.com/gelato-week-2026-berlin/>

## Como abrir

Abra com qualquer servidor estático na raiz do repo:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000/
```

(Precisa servir via HTTP por causa do `fetch('data/places.geocoded.json')` — abrir o `index.html` direto pelo `file://` não funciona.)

## Funcionalidades

- 52 sorveterias com endereço, sabor da semana e bairro.
- Mapa Leaflet (OpenStreetMap) com marcadores rosa/verde para "falta visitar" / "visitada".
- Sidebar com busca por texto, filtro por bairro, filtro por status (todas / faltam / visitadas).
- Clicar num item da lista voa o mapa até o pino e abre o popup.
- Checklist salvo em `localStorage` — fica entre sessões no mesmo navegador.
- Barra de progresso (X de 52 visitadas).

## Estrutura

- `index.html` — app inteiro (HTML + CSS + JS, Leaflet via CDN).
- `data/places.json` — dataset bruto (nome, bairro, endereço, sabor).
- `data/places.geocoded.json` — dataset + lat/lon (consumido pelo app).
- `scripts/geocode.mjs` — script Node que geocoda via Nominatim (1 req/s).

## Atualizar dataset

1. Edite `data/places.json`.
2. Apague (ou edite as entradas alteradas em) `data/places.geocoded.json`.
3. Rode:

   ```bash
   node scripts/geocode.mjs
   ```

   O script faz cache: só geocoda IDs que ainda não estão em `places.geocoded.json`.
