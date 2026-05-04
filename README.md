# 🌎 GlebasNord (CGRN v2.0)

Ferramenta web para **cálculo, visualização e análise de glebas rurais** na região Nordeste do Brasil, com suporte a validações geoespaciais e integração com bases públicas.

---

## 📌 Sobre o Projeto

O **GlebasNord** é uma aplicação front-end que permite:

- 📍 Desenhar glebas diretamente no mapa
- 📐 Calcular áreas automaticamente
- 📊 Validar geometrias (polígonos)
- 🗺️ Visualizar dados geoespaciais relevantes
- ⚠️ Verificar sobreposição com:
  - Terras Indígenas (FUNAI)
  - Unidades de Conservação (ICMBio)
  - Áreas embargadas (IBAMA)

O sistema foi pensado para apoiar análises voltadas a critérios de conformidade (ex: BACEN/INCRA).

---

## 🚀 Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript (Vanilla)
- Bootstrap 5
- Leaflet.js
- Leaflet Draw

---

## 📂 Estrutura do Projeto

CGRN_v2.0/
│
├── index.html
├── css/
│   └── style.css
│
├── js/
│   ├── main.js
│   ├── map.js
│   ├── ui.js
│   ├── validation.js
│   ├── export.js
│   ├── persistence.js
│   ├── state.js
│   ├── upload.js
│   ├── sudene.js
│   ├── terras_indigenas.js
│   └── config.js
│
├── api/
│   ├── areas_embargo_ibama.json
│   └── limite_ucs_federais_a_ICMBIO.json
│
└── terras_indigenas_nordeste.geojson

---

## ⚙️ Como Executar

1. Baixe ou clone o repositório:

git clone https://github.com/manuseiro/cgrn.git

2. Acesse a pasta:

cd CGRN_v2.0

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
