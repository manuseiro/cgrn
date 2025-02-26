# Calculo de Glebas da Região do Nordeste

Este projeto exibe um mapa interativo dos municípios brasileiros, colorindo-os de acordo com sua Unidade Federativa (UF). Utiliza dados fornecidos pelo IBGE e pela SUDENE para mapear e visualizar municípios de forma eficiente.

## 📌 Funcionalidades
- Carrega e exibe municípios do Brasil em um mapa interativo utilizando **Leaflet.js**.
- Atribui cores distintas para cada UF automaticamente.
- Integração com as APIs do **IBGE** para obter dados geográficos.
- Identificação de municípios pertencentes à área da **SUDENE**.
- Melhorias de desempenho na renderização do mapa usando **FeatureGroup**.

## 🚀 Tecnologias Utilizadas
- **HTML, CSS e JavaScript**
- **Leaflet.js** para renderização do mapa
- **APIs do IBGE** para dados geográficos e administrativos
- **GeoJSON** para representação espacial dos municípios

## 🛠️ Configuração e Uso
1. Clone este repositório:
   ```sh
   git clone https://github.com/seu-usuario/seu-repositorio.git
   ```
2. Abra o arquivo `index.html` em um navegador ou utilize um servidor local.
3. O mapa será carregado automaticamente com os dados obtidos das APIs.

## 🔍 Melhorias Implementadas
- **Verificação da estrutura dos dados JSON** antes de processá-los.
- **Correção na identificação dos municípios da SUDENE** (`CD_GEOCMU` ao invés de `CD_MUN`).
- **Melhoria no desempenho do carregamento** utilizando `L.featureGroup()` para otimizar a exibição dos municípios.
- **Ajuste na geração de cores** para melhor visualização dos polígonos.

## 📌 Contribuições
Contribuições são bem-vindas! Para sugerir melhorias ou reportar problemas, abra uma **issue** ou envie um **pull request**.

## 📜 Licença
Este projeto está sob a licença MIT. Sinta-se à vontade para utilizá-lo e modificá-lo conforme necessário.

---
Projeto desenvolvido para aprimorar a visualização de municípios brasileiros com dados do IBGE e SUDENE. 🌎📊

