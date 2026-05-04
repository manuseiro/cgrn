# GlebasNord — Cálculo e Análise de Glebas do Nordeste

**Aplicação web especializada no cálculo, validação e análise geoespacial de glebas rurais, com foco nas exigências normativas da Região Nordeste do Brasil.**

## ✨ Principais Funcionalidades

- **Cálculo de Precisão**: Área e perímetro calculados via **Turf.js**.
- **Validação Geométrica**: Fechamento de polígono, autointerseção, duplicidade de pontos e limites do Nordeste.
- **Conformidade SICOR/BACEN Avançada**:
  - Verificação automática de limite de municípios (máximo 4).
  - Detecção de sobreposição em **Terras Indígenas (FUNAI)**.
  - Consulta a **Unidades de Conservação** (Proteção Integral e Uso Sustentável).
  - Verificação de **Embargos IBAMA** e alertas de desmatamento (**PRODES/DETER**).
  - **Análise aprimorada do CAR** com barras de cobertura visual, área descoberta, imóveis individuais e links diretos para o SICAR.
- **Geografia Regional**: Camada **SUDENE 2021** com detecção automática de Semiárido.
- **Manipulação de Dados**:
  - **Importação**: TXT, CSV e **KML** (Google Earth).
  - **Exportação**: CSV, GeoJSON, **KML** e captura do mapa em PNG.
- **Interface e Usabilidade**: Desenho direto no mapa (Leaflet Draw), modo escuro, layout responsivo e otimizado para uso em campo.

## 🗂️ Tecnologias

- **Frontend**: HTML5, Bootstrap 5.3, Leaflet 1.9
- **Geoprocessamento**: Turf.js 6
- **Fontes Governamentais**:
  - SUDENE, FUNAI, ICMBio, IBAMA, IBGE, SICAR e INPE (TerraBrasilis)

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
- KML
Suporte a arquivos gerados no Google Earth contendo múltiplos Placemark do tipo Polygon.

## 🎯 Requisitos BACEN/SICOR Atendidos

- [x] Polígono fechado (primeiro e último pontos idênticos).
- [x] Mínimo de 4 vértices.
- [x] Máximo de 4 municípios por operação.
- [x] Detecção de Terras Indígenas
- [x] Unidades de Conservação de Proteção Integral
- [x] Análise detalhada de CAR (cobertura espacial + área descoberta)
- [x] Embargos IBAMA e desmatamento

## 📂 Estrutura do Projeto
```
cgrn/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── map.js
│   ├── validation.js
│   ├── conformidade.js          # Motor de conformidade BACEN/SICOR
│   ├── terras_indigenas.js
│   ├── camadas_externas.js
│   ├── sudene.js
│   ├── kml.js
│   ├── ui.js
│   ├── export.js
│   └── ...
├── api/
│   ├── proxy.php                # Proxy para contornar CORS
│   └── terras_indigenas_nordeste.geojson
└── README.md
```
## 🛠️ Configuração do Proxy (CORS)

Algumas APIs governamentais possuem restrições de CORS. O arquivo api/proxy.php atua como uma ponte necessária para que a aplicação web consiga buscar esses dados em tempo real. Certifique-se de que seu ambiente de hospedagem suporte PHP.

## 📄 Licença

Este projeto é open source sob a licença MIT.

## 👨‍💻 Desenvolvimento

**Equipe GlebasNord** — Desenvolvido para apoiar projetistas, assistência técnica rural (ATER), cooperativas e agentes financeiros no desenvolvimento do agronegócio nordestino.

## ⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
Qualquer sugestão ou bug, abra uma Issue.

---
