# 🌍 GlebasNord v3.3 — Cálculo e Análise de Glebas do Nordeste

**Ferramenta completa para cálculo, validação e conformidade de glebas rurais para crédito agrícola no Nordeste Brasileiro.**

---

## ✨ Funcionalidades

- **Cálculo preciso de área e perímetro** (usando Turf.js)
- **Validação completa de polígonos** (fechamento, autointerseção, duplicidade de pontos)
- **Verificação automática de municípios** (máximo 4 — exigência SICOR)
- **Camada SUDENE 2021** com detecção de Semiárido
- **Terras Indígenas (FUNAI)** — detecção de sobreposição
- **Conformidade BACEN/SICOR completa**:
  - Terras Indígenas
  - Unidades de Conservação (Proteção Integral e Uso Sustentável)
  - Embargos IBAMA
  - Alertas de desmatamento (PRODES/DETER)
  - Cadastro Ambiental Rural (CAR) com análise espacial
  - Bioma e marco legal
- **Importação**: TXT, CSV e **KML** (Google Earth)
- **Exportação**: CSV, GeoJSON, **KML** e PNG do mapa
- **Desenho direto no mapa** (Leaflet Draw)
- **Modo escuro**, responsivo e otimizado para campo

---

## 🗂️ Tecnologias

- **Frontend**: HTML5, Bootstrap 5.3, Leaflet 1.9
- **Geoprocessamento**: Turf.js 6
- **APIs Governamentais**:
  - SUDENE
  - FUNAI (Terras Indígenas)
  - ICMBio (Unidades de Conservação)
  - IBAMA (Embargos)
  - IBGE (Biomas)
  - SICAR (Cadastro Ambiental Rural)
  - INPE TerraBrasilis

---

## 📥 Como usar

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/cgrn.git
   cd cgrn
```

Ou usar servidor:
```
python -m http.server
```
2. Abra o arquivo index.html no navegador (recomendado Chrome/Edge).
3. Pronto! Não é necessário instalar nada.

Dica: Para melhor experiência, sirva os arquivos com um servidor local (Live Server do VS Code, Python, etc.).

---

## 📌 Uso

- Crédito rural
- Regularização fundiária
- Geoprocessamento

---

## ⚠️ Limitações

- Não substitui validação oficial
- Depende da qualidade dos dados

---

## 🔮 Roadmap

- Integração com CAR
- Exportação PDF
- Backend + banco
- Login GOV.br

---

## 🤝 Contribuição

Pull Requests são bem-vindos!

---

## 📄 Licença

MIT

---

## 👨‍💻 Autor

Manuel Ribeiro
