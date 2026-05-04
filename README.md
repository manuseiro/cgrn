# 🌎 GlebasNord (CGRN v2.0)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Status: Em Desenvolvimento](https://img.shields.io/badge/Status-Em%20Desenvolvimento-green)

Ferramenta web para **cálculo, visualização e análise de glebas rurais** na região Nordeste do Brasil, com suporte a validações geoespaciais e integração com bases públicas.

---

## 📌 Sobre o Projeto

O **GlebasNord** é uma aplicação front-end que permite a projetistas e analistas realizarem o mapeamento rápido de áreas rurais. O foco principal é a conformidade técnica e ambiental para processos de crédito e regularização.

### Principais recursos:
- 📍 Desenhar glebas diretamente no mapa.
- 📐 Calcular áreas automaticamente com conversão para hectares.
- 📊 Validar geometrias (detecção de polígonos inválidos).
- 🗺️ Visualizar dados geoespaciais e verificar sobreposição com:
  - Terras Indígenas (FUNAI)
  - Unidades de Conservação (ICMBio)
  - Áreas embargadas (IBAMA)

---

## 🚀 Tecnologias Utilizadas

- **Interface:** HTML5, CSS3, Bootstrap 5
- **Mapas:** [Leaflet.js](https://leafletjs.com/)
- **Desenho Geoespacial:** Leaflet Draw
- **Lógica:** JavaScript (Vanilla)

---

## 📸 Interface

> [!TIP]
> *Adicione aqui um screenshot ou GIF da sua aplicação para valorizar o projeto!*
> Exemplo: `![Snapshot da Interface](img/screenshot.png)`

---

## 📂 Estrutura do Projeto
```text
CGRN_v2.0/
│
├── index.html            # Página principal
├── css/
│   └── style.css         # Estilização personalizada
├── js/
│   ├── main.js           # Inicialização da App
│   ├── map.js            # Configurações do Leaflet
│   ├── ui.js             # Manipulação de DOM/Bootstrap
│   ├── validation.js     # Lógica de validação de glebas
│   ├── export.js         # Exportação de dados
│   ├── persistence.js    # LocalStorage
│   ├── state.js          # Gerenciamento de estado da aplicação
│   ├── upload.js         # Manipulação de arquivos externos
│   ├── sudene.js         # Regras específicas da região
│   ├── terras_indigenas.js
│   └── config.js         # Variáveis globais e chaves
├── data/                 # Camadas geoespaciais locais (JSON/GeoJSON)
│   ├── areas_embargo_ibama.json
│   ├── limite_ucs_federais_a_ICMBIO.json
│   └── terras_indigenas_nordeste.geojson
└── README.md
```
## ⚙️ Como Executar

1. Baixe ou clone o repositório:

git clone https://github.com/manuseiro/cgrn.git

2. Acesse a pasta:

cd cgrn

3. Abra o arquivo `index.html` no navegador:

# Exemplo (Windows)
start index.html

> 💡 Recomendado usar uma extensão como Live Server no VS Code para evitar problemas com CORS.

---

## 🧠 Funcionalidades

### ✏️ Manipulação de Glebas
- Desenho manual no mapa
- Importação de dados
- Edição e remoção

### 📐 Cálculo
- Área automática de polígonos
- Conversão para hectares

### ✅ Validação
- Verificação de formato do polígono
- Identificação de sobreposição

### 🗺️ Camadas Geoespaciais
- Terras Indígenas
- Unidades de Conservação
- Áreas embargadas

### 💾 Persistência
- Salvamento local (LocalStorage)

### 📤 Exportação
- Exportação de dados das glebas

---

## 📸 Interface

A aplicação conta com:

- Interface responsiva com Bootstrap
- Mapa interativo com controles intuitivos
- Menu de navegação para ações rápidas

---

## 🔧 Melhorias Futuras

- [ ] Integração com API do CAR
- [ ] Exportação em formatos (KML, GeoJSON)
- [ ] Autenticação de usuários
- [ ] Backend para persistência em banco
- [ ] Dashboard analítico

---

## ⚠️ Observações

- Os dados utilizados são públicos e podem sofrer atualizações.
- A precisão depende da qualidade dos dados geográficos inseridos.

---

## 👨‍💻 Autor

Desenvolvido por Manuel Ribeiro  
Analista de Sistemas | QA | Requisitos

---

## 📄 Licença

Este projeto está sob a licença MIT.  
Sinta-se livre para usar, modificar e contribuir.
