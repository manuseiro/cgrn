# GlebasNord — Cálculo e Análise de Glebas do Nordeste (v3.3)

**Aplicação web especializada no cálculo, validação e análise geoespacial de glebas rurais, com foco nas exigências normativas da Região Nordeste do Brasil.**

## ✨ Funcionalidades

- **Cálculo de Precisão**: Área e perímetro calculados via **Turf.js**.
- **Validação Geométrica**: Verificação de fechamento de polígono, autointerseção e duplicidade de pontos.
- **Conformidade SICOR/BACEN**: 
  - Verificação automática de limite de municípios (máximo 4).
  - Identificação de sobreposição em **Terras Indígenas (FUNAI)**.
  - Consulta a **Unidades de Conservação** (Proteção Integral e Uso Sustentável).
  - Verificação de **Embargos IBAMA** e alertas de desmatamento (**PRODES/DETER**).
  - Integração com dados do **CAR (Cadastro Ambiental Rural)**.
- **Geografia Regional**: Camada **SUDENE 2021** com detecção automática de áreas do Semiárido.
- **Manipulação de Dados**:
  - **Importação**: TXT, CSV e KML (Google Earth).
  - **Exportação**: CSV, GeoJSON, KML e captura do mapa em PNG.
- **Interface e Usabilidade**: Desenho direto via Leaflet Draw, modo escuro, layout responsivo e otimizado para uso em campo.

## 🗂️ Tecnologias

- **Frontend**: HTML5, Bootstrap 5.3, Leaflet 1.9.
- **Geoprocessamento**: Turf.js 6.
- **Fontes de Dados e APIs**:
  - SUDENE, FUNAI, ICMBio, IBAMA, IBGE, SICAR e INPE (TerraBrasilis).

## 📥 Como usar
1. **Clone o repositório**:
   ```bash
   git clone [https://github.com/SEU_USUARIO/glebasnord.git](https://github.com/SEU_USUARIO/glebasnord.git)
   cd glebasnord
   ```
2. Execução:
Abra o arquivo 'index.html' no seu navegador (recomendado Chrome ou Edge).

Dica: Para garantir o funcionamento pleno das requisições de API e camadas externas, utilize um servidor local (como a extensão Live Server do VS Code ou o comando 'python -m http.server').

## 📋 Formatos de Entrada Aceitos
- TXT / CSV
O formato deve seguir o padrão: '[ID_Gleba] [Ordem_Vértice] [Latitude] [Longitude]'
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
- [x] Cruzamento com áreas restritivas (Indígenas e Proteção Integral).
- [x] Análise de sobreposição com a base do CAR.
- [x] Verificação de passivos ambientais (Embargos/Desmatamento).

## 📂 Estrutura do Projeto
```
cgrn/
├── index.html              # Página principal
├── css/
│   └── style.css           # Estilizações customizadas e temas
├── js/
│   ├── main.js             # Inicialização e orquestração
│   ├── map.js              # Configuração do mapa e camadas
│   ├── validation.js       # Lógica de validação geométrica
│   ├── conformidade.js     # Regras de negócio SICOR/BACEN
│   ├── terras_indigenas.js # Lógica de busca em áreas FUNAI
│   ├── sudene.js           # Delimitação do Semiárido
│   ├── kml.js              # Parser de arquivos KML
│   ├── ui.js               # Manipulação da interface e alertas
│   └── ...                 # Outros módulos auxiliares
├── api/
│   ├── proxy.php           # Bridge para contornar restrições de CORS
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
