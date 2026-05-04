# GlebasNord — Cálculo e Análise de Glebas do Nordeste

**Aplicação web especializada no cálculo, validação e análise geoespacial de glebas rurais, com foco nas exigências normativas da Região Nordeste do Brasil.**

---

## ✨ Principais Novidades da v3.5.2

- **Precisão Coordenada Configurável**: Adicionado `COORD_PRECISION` (padrão 8 casas decimais) em todo o sistema para máxima compatibilidade com bases oficiais (SICAR, INCRA, Google Earth).
- **Importação e Exportação de Alta Precisão**:
  - KML (import/export) agora respeita precisão configurada.
  - Shapefile (.zip) corrigido e otimizado.
  - Melhor tratamento de MultiPolygon e geometrias complexas.
- **Validação Inteligente**:
  - Mantém pontos duplicados consecutivos (aviso em vez de erro).
  - Detecta e reporta autointerseções como **warnings** (não bloqueia mais automaticamente).
  - Mensagens mais claras e úteis para o usuário.
- **Análise CAR Avançada**: Cobertura espacial (união + melhor CAR individual), área descoberta (`uncoveredHa`), suporte robusto a MultiPolygon.
- **Melhorias em Camadas**:
  - Terras Indígenas com fallback aprimorado e precisão de coordenadas.
  - SUDENE, ICMBio, IBAMA e PRODES mais estáveis.
- **Interface e Experiência**:
  - Suporte a marcadores de validação no mapa.
  - Exportações mais ricas (CSV, GeoJSON, KML com estilos por status, PNG).
  - Cache inteligente e performance aprimorada.

---

## 🎯 Funcionalidades Principais

- **Cálculo Preciso**: Área, perímetro e centroid usando **Turf.js** com alta precisão.
- **Validação Rigorosa**:
  - Polígono fechado, mínimo 4 vértices, máximo 4 municípios.
  - Detecção de duplicatas e autointerseções com **warnings**.
  - Limites geográficos do Nordeste.
- **Verificações Automáticas de Conformidade BACEN/SICOR**:
  - **Terras Indígenas** (bloqueio)
  - **UC Proteção Integral** (bloqueio) × Uso Sustentável (alerta)
  - Embargos IBAMA ativos
  - Alertas de desmatamento (PRODES/DETER)
  - **CAR** com análise espacial detalhada (cobertura, área descoberta, etc.)
  - Bioma e enquadramento legal
  - Região Semiárida (SUDENE)
- **Importação em Lote**:
  - TXT / CSV (formato padrão)
  - **KML** (Google Earth)
  - **Shapefile** (.zip)
- **Exportação Completa**:
  - CSV, GeoJSON, **KML** (com estilos por conformidade), PNG do mapa e Projeto (.cgrn)

---

## 🗂️ Tecnologias

- **Frontend**: HTML5, Bootstrap 5.3, Leaflet 1.9+
- **Geoprocessamento**: Turf.js 6
- **Fontes Oficiais**: FUNAI, ICMBio, IBAMA, IBGE, SICAR, INPE (TerraBrasilis), SUDENE
- **Proxy CORS**: `api/proxy.php` (whitelist segura de domínios governamentais)

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
├── css/
├── js/
│   ├── main.js
│   ├── services/          # conformidade, camadas, spatial_analysis...
│   ├── utils/             # kml, shapefile, export, config...
│   └── components/
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
