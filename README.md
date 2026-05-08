# GlebasNord — Cálculo e Análise de Glebas do Nordeste

**Aplicação web especializada no cálculo, validação e análise geoespacial de glebas rurais, com foco nas exigências normativas da Região Nordeste do Brasil e conformidade BACEN/SICOR.**

---

## ✨ Novidades da v3.6.5

- **Correção Crítica no SICAR (Limites de URL)**: Substituição de `INTERSECTS(POLYGON)` por filtro `BBOX`, estabilizando a validação de conformidade para imóveis rurais com alta complexidade geométrica (>500 vértices).
- **Pré-Cache Espacial (CAR)**: Introdução do `seedCarCache` para evitar consultas redundantes ao GeoServer durante a validação de glebas recém-importadas, otimizando a velocidade do processo.
- **Automação de Fluxo (UX)**: A aplicação agora executa o processamento e renderização automaticamente no mapa assim que um imóvel CAR é importado.
- **Estabilidade e Limpeza**: Correção de erro fatal de importação duplicada no arquivo principal e remoção de artefatos inativos.

---

## 🎯 Funcionalidades

### Entrada de dados
| Método | Descrição |
|---|---|
| **Digitação manual** | Textarea com formato padrão `GlebaID OrdemPonto Lat Lon` |
| **Importação TXT/CSV** | Suporte a separadores espaço, tab, vírgula e ponto-e-vírgula |
| **Importação KML** | Google Earth — múltiplos `Placemark` do tipo `Polygon` |
| **Importação Shapefile** | Arquivo `.zip` com `.shp` + `.dbf` + auxiliares |
| **Importação via SICAR** | Busca imóvel por código CAR e importa geometria diretamente |
| **Desenho no mapa** | Leaflet.Draw para criação e edição interativa de polígonos |

### Cálculo e Geoprocessamento
- **Área** em hectares com precisão de 2 casas decimais (padrão INCRA/SICAR)
- **Perímetro** em metros
- **Centroide** com 8 casas decimais de precisão (SIRGAS 2000)
- **Autointerseções** detectadas com `turf.kinks()`
- **Pontos duplicados consecutivos** sinalizados como avisos

### Validação de Polígonos (BACEN/SICOR)
- ✅ Polígono fechado (primeiro = último ponto)
- ✅ Mínimo de 4 vértices
- ✅ Área entre limites configuráveis (padrão 0,1 ha – 50.000 ha)
- ✅ Máximo de 4 municípios por operação
- ✅ Limites geográficos da Região Nordeste
- ✅ Detecção de duplicatas e autointerseções

### Verificações de Conformidade BACEN/SICOR
| Verificação | Fonte | Resultado |
|---|---|---|
| **Terras Indígenas** | FUNAI (GeoServer) | Bloqueio |
| **UC Proteção Integral** | ICMBio (local + fallback) | Bloqueio |
| **UC Uso Sustentável** | ICMBio | Alerta |
| **Embargos IBAMA** | IBAMA (local + fallback) | Bloqueio |
| **Alertas PRODES/DETER** | TerraBrasilis/INPE | Alerta |
| **CAR — Cobertura Espacial** | SICAR/geoserver.car.gov.br | Detalhado |
| **CAR — Área Descoberta** | SICAR | Calculada |
| **Bioma e Marco Legal** | IBGE | Informativo |
| **Região Semiárida (SUDENE)** | SUDENE (local + fallback) | Informativo |
| **Geometria inválida** | turf.kinks() | Bloqueio |
| **Gleba já Financiada** | BCB (SICOR Microdados) | Bloqueio |

### Camadas do Mapa
| Camada | Controle |
|---|---|
| Glebas (polígonos coloridos por ID) | Sempre visível |
| Marcadores de vértices | Painel flutuante |
| Centroides com rótulo de área | Painel flutuante |
| Terras Indígenas (com legenda) | Painel flutuante |
| Unidades de Conservação | Painel flutuante |
| Embargos IBAMA | Painel flutuante |
| Bioma (Caatinga, Cerrado, etc.) | Painel flutuante |
| CAR consultado | Resultado da busca |

### Exportação
| Formato | Conteúdo |
|---|---|
| **CSV** | Tabela com área, perímetro, centroide, municípios, conformidade |
| **GeoJSON** | Geometria + propriedades completas |
| **KML** | Estilos por status de conformidade (verde/amarelo/vermelho) |
| **PNG** | Captura do mapa com camadas visíveis |
| **Projeto `.cgrn`** | Estado completo para reabertura posterior |

### Interface
- Modo escuro / claro com persistência por `localStorage`
- Painel flutuante de camadas (direita do mapa)
- Legenda de Terras Indígenas expansível (esquerda do mapa)
- Barra de status com coordenadas, área total e estado dos serviços
- Toast notifications para feedback de ações
- Modal de conformidade detalhado com tabela por gleba
- Suporte a múltiplas glebas simultâneas com cores distintas

---

## 🏗️ Arquitetura

```
cgrn/
├── index.html                  # Interface principal
├── changelog.html              # Histórico de versões
├── docs.html                   # Documentação de uso
├── css/
│   └── style.css               # Estilos (complementa Bootstrap 5.3)
├── js/
│   ├── main.js                 # Orquestrador principal (boot + eventos)
│   ├── components/
│   │   ├── dom.js              # Referências aos elementos HTML (getters)
│   │   ├── map.js              # Leaflet: inicialização, renderização, draw
│   │   ├── modal.js            # ModalManager (abertura/fechamento)
│   │   └── ui.js               # Toast, mensagens, tabela, status bar
│   ├── services/
│   │   ├── bioma.js            # NOVO: Serviço de Biomas (IBGE)
│   │   ├── camadas_externas.js # CAR (SICAR), detecção de UF, cache
│   │   ├── conformidade.js     # Verificações BACEN/SICOR (orquestração)
│   │   ├── ibama.js            # Embargos IBAMA (local + fallback)
│   │   ├── icmbio.js           # Unidades de Conservação (local + fallback)
│   │   ├── persistence.js      # Salvar/carregar projeto (.cgrn)
│   │   ├── sicor.js            # NOVO: Consulta de Glebas BCB/SICOR
│   │   ├── spatial_analysis.js # Análise de intersecção CAR × Gleba
│   │   ├── sudene.js           # Região Semiárida SUDENE (proxy + fallback)
│   │   ├── terras_indigenas.js # Terras Indígenas FUNAI (GeoServer + local)
│   │   ├── upload.js           # Importação de arquivos (TXT/CSV/KML/SHP)
│   │   └── validation.js       # Validação de polígonos + cálculos geométricos
│   └── utils/
│       ├── config.js           # Constantes globais, URLs, limites
│       ├── export.js           # CSV, GeoJSON, KML, PNG, Projeto
│       ├── geo.js              # Utilitários geométricos (bboxIntersects)
│       ├── kml.js              # Parser e gerador KML
│       ├── shapefile.js        # Parser Shapefile (.shp/.dbf)
│       └── state.js            # Estado global da aplicação
└── api/
    ├── proxy.php               # Proxy CORS com whitelist, cache e decompress
    ├── vw_brasil_adm_embargo_a.json        # Embargos IBAMA (~4 MB)
    ├── limiteucsfederais_a.json            # UCs federais ICMBio (~4.3 MB)
    ├── qg_2025_240_bioma_nordeste.json    # Biomas Nordeste (~0.1 MB)
    ├── SUDENE_2021.json        # Polígono da Região Semiárida (~1.6 MB)
    ├── terras_indigenas_nordeste.geojson    # TIs do Nordeste (FUNAI)
    └── cache/                  # Cache automático do proxy (TTL 1h)
```

---

## 📋 Formato de Entrada (TXT/CSV)

Cada linha representa um vértice. O polígono deve ser fechado (último ponto = primeiro):

```
[ID_Gleba] [Ordem_Vértice] [Latitude] [Longitude]
```

```
1 1 -6.24100000 -38.91400000
1 2 -6.24100000 -38.89800000
1 3 -6.22700000 -38.89800000
1 4 -6.22700000 -38.91400000
1 5 -6.24100000 -38.91400000
```

Múltiplas glebas: use IDs distintos (1, 2, 3…). Separadores aceitos: espaço, tab, vírgula, ponto-e-vírgula.

---

## 🚀 Como Usar

### 1. Clone e abra

```bash
git clone https://github.com/manuseiro/cgrn.git
cd cgrn
```

Abra `index.html` diretamente no navegador (Chrome ou Edge recomendado).

### 2. Para funcionalidade completa das APIs (requer servidor PHP)

```bash
# Python (apenas frontend, sem proxy PHP)
python -m http.server 8080

# VS Code: instale a extensão Live Server
# Servidor PHP real: Apache/Nginx com PHP 7.4+
```

> **As camadas IBAMA, ICMBio, Bioma e SUDENE funcionam mesmo offline**, pois os dados estão em arquivos locais na pasta `api/`. O proxy PHP é necessário apenas para consultas ao SICAR, FUNAI, SICOR e TerraBrasilis em tempo real.

---

## ⚙️ Requisitos do Servidor (Produção)

- PHP 7.4+ com extensão `curl` e `zlib` (para descompressão GZIP)
- Certificados SSL configurados (para verificação HTTPS das APIs governamentais)
- Pasta `api/cache/` com permissão de escrita (`chmod 755`)

---

## 🔒 Segurança do Proxy

O `api/proxy.php` implementa:
- **Whitelist de domínios**: apenas APIs governamentais autorizadas
- **Detecção automática dev/prod**: SSL e CORS ajustados por ambiente
- **Rate limiting**: 60 requisições por minuto por sessão
- **Cache Stale-While-Revalidate**: respostas cacheadas por 1 hora com revalidação assíncrona
- **Proteção SSRF**: rejeita domínios não listados na whitelist

---

## 🗺️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | HTML5, Bootstrap 5.3, Bootstrap Icons |
| Mapa | Leaflet 1.9, Leaflet.Draw |
| Geoprocessamento | Turf.js 6 |
| Módulos JS | ES Modules nativos (sem bundler) |
| Backend proxy | PHP com cURL |
| Dados geoespaciais | FUNAI, ICMBio, IBAMA, IBGE, SICAR, INPE, SUDENE, BCB |

---

## 🎯 Requisitos BACEN/SICOR Atendidos

- [x] Polígono fechado (primeiro e último pontos idênticos)
- [x] Área mínima e máxima configuráveis
- [x] Mínimo de 4 vértices distintos
- [x] Máximo de 4 municípios por operação
- [x] Detecção de Terras Indígenas (bloqueio)
- [x] Unidades de Conservação de Proteção Integral (bloqueio)
- [x] Embargos IBAMA ativos (bloqueio)
- [x] Análise detalhada de CAR (cobertura espacial + área descoberta)
- [x] Bioma e marco legal (Código Florestal)
- [x] Região Semiárida SUDENE
- [x] Autointerseções e geometria inválida (bloqueio)
- [x] Detecção de glebas já financiadas (duplicidade no SICOR/BCB)

---

## 📄 Licença

MIT — uso livre com atribuição.

---

## 👨‍💻 Desenvolvimento

**Equipe GlebasNord** — Desenvolvido para apoiar projetistas, assistência técnica rural (ATER), cooperativas e agentes financeiros no desenvolvimento do agronegócio nordestino.

Sugestões, bugs e contribuições: abra uma [Issue](https://github.com/manuseiro/cgrn/issues) ou envie um Pull Request.

---

⭐ Se este projeto foi útil, considere dar uma estrela no repositório!
