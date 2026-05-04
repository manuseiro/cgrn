# GlebasNord — Cálculo e Análise de Glebas do Nordeste

**Aplicação web especializada no cálculo, validação e análise geoespacial de glebas rurais, com foco nas exigências normativas da Região Nordeste do Brasil.**

---

## ✨ Principais Novidades da v3.5

- **Análise CAR Revolucionada**: Cobertura espacial detalhada (união + melhor imóvel individual), área descoberta (`uncoveredHa`), barras visuais de progresso, suporte completo a **MultiPolygon** e glebas multi-UF.
- **Importação Ampliada**: TXT/CSV, **KML** (Google Earth) e **Shapefile (.zip)**.
- **Exportação Completa**: CSV, GeoJSON, **KML** (com estilos por conformidade) e PNG do mapa.
- **Camadas Governamentais Aprimoradas**:
  - Terras Indígenas (FUNAI) com fases (Regularizada, Homologada, etc.) e índice espacial.
  - Unidades de Conservação (ICMBio), Embargos IBAMA, Biomas (IBGE) e PRODES/DETER.
  - SUDENE 2021 com detecção automática de Semiárido.
- **Cache Inteligente**: Resultados CAR com TTL de 30 minutos + invalidação manual.
- **Interface Moderna**: Modo escuro, desenho no mapa (Leaflet Draw), modais ricos e toasts.
- **Conformidade BACEN/SICOR** com status claros: `ok` ✅ | `info` ℹ️ | `alerta` ⚠️ | `bloqueio` 🚫.

---

## 🎯 Funcionalidades Principais

- **Cálculo Preciso**: Área, perímetro e centroid via **Turf.js**.
- **Validação Rigorosa**:
  - Polígono fechado, sem autointerseções, mínimo 4 vértices.
  - Máximo de 4 municípios por gleba.
  - Limites geográficos do Nordeste.
- **Verificações Automáticas**:
  - **Terras Indígenas** (bloqueio).
  - **UC de Proteção Integral** (bloqueio) × Uso Sustentável (alerta).
  - Embargos IBAMA ativos.
  - Alertas de desmatamento (PRODES/DETER).
  - **CAR** com análise espacial detalhada.
  - Bioma e enquadramento legal.
- **Manipulação de Glebas**: Edição manual, importação em lote e exportação completa.

---

## 🗂️ Tecnologias

- **Frontend**: HTML5, Bootstrap 5.3, Leaflet 1.9+
- **Geoprocessamento**: Turf.js 6
- **Fontes Oficiais**:
  - SUDENE, FUNAI, ICMBio, IBAMA, IBGE, SICAR (geoserver.car.gov.br), INPE (TerraBrasilis)
- **Proxy CORS**: `api/proxy.php` (whitelist de domínios governamentais)

---

## 📥 Como usar
1. **Clone o repositório**:
   ```bash
   git clone https://github.com/manuseiro/cgrn.git
   cd cgrn
   ```
2. Execução:
Abra o arquivo 'index.html' no seu navegador (recomendado Chrome ou Edge).

Dica importante: Para pleno funcionamento das APIs governamentais e camadas externas, utilize um servidor local:

- VS Code + extensão Live Server
- Ou via terminal: python -m http.server

---

## 📋 Formatos de Entrada Aceitos
- TXT / CSV
O formato deve seguir o padrão: `[ID_Gleba] [Ordem_Vértice] [Latitude] [Longitude]`
```
1 1 -6.2410 -38.9140
1 2 -6.2410 -38.8980
1 3 -6.2270 -38.8980
1 4 -6.2270 -38.9140
1 5 -6.2410 -38.9140
```
- KML: Suporte a arquivos gerados no Google Earth contendo múltiplos Placemark do tipo Polygon.
- Shapefile: Suporte a arquivos Shapefile, enviando o .zip contendo .shp + .dbf + arquivos auxiliares.

---

## 🎯 Requisitos BACEN/SICOR Atendidos

- [x] Polígono fechado (primeiro e último pontos idênticos).
- [x] Área entre limites configuráveis
- [x] Mínimo de 4 vértices.
- [x] Máximo de 4 municípios por operação.
- [x] Detecção de Terras Indígenas
- [x] Unidades de Conservação de Proteção Integral
- [x] Embargos IBAMA
- [x] Análise detalhada de CAR (cobertura espacial + área descoberta)
- [x] Bioma e marco legal
- [x] Região Semiárida (SUDENE)

---

## 📂 Estrutura do Projeto

```
cgrn/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── map.js
│   ├── services/
│   │   ├── camadas_externas.js
│   │   ├── conformidade.js
│   │   ├── spatial_analysis.js
│   │   ├── terras_indigenas.js
│   │   ├── sudene.js
│   │   └── ...
│   ├── utils/ (kml.js, shapefile.js, export.js, etc.)
│   └── ...
├── api/
│   ├── proxy.php
│   └── terras_indigenas_nordeste.geojson
└── README.md
```

---

## 🛠️ Configuração do Proxy (CORS)

Algumas APIs governamentais possuem restrições de CORS. O arquivo api/proxy.php atua como uma ponte necessária para que a aplicação web consiga buscar esses dados em tempo real. Certifique-se de que seu ambiente de hospedagem suporte PHP.

---

## 📄 Licença

Este projeto é open source sob a licença MIT.

---

## 👨‍💻 Desenvolvimento

**Equipe GlebasNord** — Desenvolvido para apoiar projetistas, assistência técnica rural (ATER), cooperativas e agentes financeiros no desenvolvimento do agronegócio nordestino.

---

## ⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
Qualquer sugestão ou bug, abra uma Issue.

---
