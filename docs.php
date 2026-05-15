<!DOCTYPE html>
<html lang="pt-BR" data-bs-theme="light">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentação | GlebasNord - Cálculo e análise de glebas da Região Nordeste</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="css/style.css">
  <link rel="canonical" href="https://glebasnord.com.br/docs.html" />
  <meta name="description"
    content="Aprenda a usar o GlebasNord: importe KML, Shapefile ou CSV, desenhe glebas no mapa e verifique conformidade BACEN/SICOR com Terras Indígenas, IBAMA e CAR." />
  <meta property="og:title" content="Documentação | GlebasNord - Cálculo e análise de glebas da Região Nordeste" />
  <meta property="og:description" content="Guia completo de uso da ferramenta de análise de glebas rurais." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://glebasnord.com.br/docs.html" />
  <meta property="og:image" content="https://glebasnord.com.br/img/og-image.jpg" />
  <meta property="og:locale" content="pt_BR" />
  <link rel="icon" href="img/favicon-16x16.png" />
  <link rel="apple-touch-icon" href="img/apple-touch-icon-iphone-60x60.png">
  <link rel="apple-touch-icon" sizes="60x60" href="img/apple-touch-icon-ipad-76x76.png">
  <link rel="apple-touch-icon" sizes="114x114" href="img/apple-touch-icon-iphone-retina-120x120.png">
  <link rel="apple-touch-icon" sizes="144x144" href="img/apple-touch-icon-ipad-retina-152x152.png">
  <style>
    html,
    body {
      height: 100%;
      margin: 0;
    }

    .main-wrapper {
      min-height: 100vh;
    }

    .main-container {
      height: calc(100vh - 85px);
      overflow-y: auto;
      scroll-behavior: smooth;
    }

    .doc-section {
      scroll-margin-top: 90px;
    }

    .step-number {
      background: #0d6efd;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
  </style>
</head>

<body>
  <div class="main-wrapper">
    <div class="container-fluid px-4 py-3">
      <!-- Navbar -->
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm mb-4 rounded-4 px-3">
        <a class="navbar-brand d-flex align-items-center gap-2" href="./">
          <img src="img/logo.png" alt="GlebasNord Logo">
          <span class="fw-bold fs-4 text-white">GlebasNord</span>
        </a>
        <div class="ms-auto">
          <a href="./" class="btn btn-outline-light btn-sm px-3">
            <i class="bi bi-arrow-left me-2"></i>Voltar ao App
          </a>
        </div>
      </nav>

      <div class="main-container">
        <div class="row g-4">
          <!-- Sidebar -->
          <div class="col-lg-3">
            <div class="sticky-top" style="top: 20px;">
              <div class="card p-3">
                <h6 class="fw-bold text-uppercase text-muted small mb-3">Índice</h6>
                <nav class="nav flex-column gap-1">
                  <a class="nav-link" href="#introducao">1. Introdução</a>
                  <a class="nav-link" href="#primeiros-passos">2. Primeiros Passos</a>
                  <a class="nav-link" href="#adicionar-gleba">3. Adicionar Gleba</a>
                  <a class="nav-link" href="#validacao">4. Validação e Conformidade</a>
                  <a class="nav-link" href="#mapa">5. Explorando o Mapa</a>
                  <a class="nav-link" href="#exportar">6. Exportar Resultados</a>
                  <a class="nav-link" href="#dicas">7. Dicas Úteis</a>
                </nav>
              </div>
            </div>
          </div>

          <!-- Conteúdo Principal -->
          <div class="col-lg-9">
            <div class="card">
              <div class="card-body p-5">

                <section id="introducao" class="doc-section mb-5">
                  <h1 class="fw-bold mb-3">Como Usar o GlebasNord</h1>
                  <p class="lead">Guia completo e prático para calcular, validar e analisar glebas rurais com foco na
                    conformidade BACEN/SICOR.</p>
                  <hr>
                  <p><strong>Versão atual:</strong> 3.7.2</p>
                </section>

                <section id="primeiros-passos" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">Primeiros Passos</h3>
                  <ol class="list-group list-group-numbered">
                    <li class="list-group-item">Abra o arquivo <code>index.html</code> no navegador (Chrome ou Edge
                      recomendado)</li>
                    <li class="list-group-item">Você verá o mapa da Região Nordeste já carregado</li>
                    <li class="list-group-item">Escolha uma das formas de adicionar sua gleba (veja abaixo)</li>
                  </ol>
                </section>

                <section id="adicionar-gleba" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">3. Como Adicionar uma Gleba</h3>

                  <div class="row g-4">
                    <div class="col-md-6">
                      <div class="card h-100">
                        <div class="card-body">
                          <h5><i class="bi bi-pencil-square"></i> Digitação Manual</h5>
                          <p>Cole os pontos no formato correto no campo de texto e clique em <strong>"Adicionar
                              Gleba"</strong>.</p>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card h-100">
                        <div class="card-body">
                          <h5><i class="bi bi-file-earmark-arrow-up"></i> Importar Arquivo</h5>
                          <p>Arraste ou selecione arquivos TXT, CSV, KML ou Shapefile (.zip).</p>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card h-100">
                        <div class="card-body">
                          <h5><i class="bi bi-search"></i> Buscar pelo CAR (SICAR)</h5>
                          <p>Informe o código do CAR e clique em buscar. A geometria será importada automaticamente.</p>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card h-100">
                        <div class="card-body">
                          <h5><i class="bi bi-pencil"></i> Desenhar no Mapa</h5>
                          <p>Clique no botão de edição no mapa e desenhe o polígono diretamente.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="validacao" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">Validação e Conformidade BACEN/SICOR</h3>
                  <p>Assim que você adicionar a gleba, o sistema faz automaticamente:</p>
                  <ul>
                    <li>Verifica se o polígono está fechado e tem o mínimo de vértices</li>
                    <li>Calcula área (ha), perímetro (m) e centroide</li>
                    <li>Analisa sobreposição com Terras Indígenas, Unidades de Conservação, Embargos IBAMA, etc.</li>
                  </ul>
                  <div class="alert alert-info">
                    <strong>Resultado:</strong> Verde = OK | Amarelo = Atenção | Vermelho = Bloqueio
                  </div>
                </section>

                <section id="mapa" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">Explorando o Mapa</h3>
                  <ul>
                    <li>Use o painel flutuante à direita para ligar/desligar camadas (Terras Indígenas, Embargos,
                      Biomas...)</li>
                    <li>Clique na legenda das Terras Indígenas para ver os nomes</li>
                    <li>Passe o mouse sobre as glebas para ver informações detalhadas</li>
                    <li>Clique no botão <strong>"Conformidade"</strong> para ver o relatório completo</li>
                  </ul>
                </section>

                <section id="exportar" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">Exportar Resultados</h3>
                  <div class="row text-center">
                    <div class="col-sm-4 mb-3"><strong>CSV</strong><br><small>Planilha completa</small></div>
                    <div class="col-sm-4 mb-3"><strong>GeoJSON</strong><br><small>Formato técnico</small></div>
                    <div class="col-sm-4 mb-3"><strong>KML</strong><br><small>Google Earth</small></div>
                    <div class="col-sm-4 mb-3"><strong>PNG</strong><br><small>Imagem do mapa</small></div>
                    <div class="col-sm-4 mb-3"><strong>Projeto .cgrn</strong><br><small>Salvar e voltar depois</small>
                    </div>
                  </div>
                </section>

                <section id="dicas" class="doc-section mb-5">
                  <h3 class="fw-bold mb-4">Dicas Úteis</h3>
                  <ul>
                    <li>Você pode trabalhar com várias glebas ao mesmo tempo</li>
                    <li>O modo escuro/claro é lembrado automaticamente</li>
                    <li>Use o botão <strong>"Limpar Tudo"</strong> para começar um novo projeto</li>
                    <li>Para melhor precisão, prefira importar KML ou Shapefile</li>
                  </ul>
                </section>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    if (localStorage.getItem('cgrn_theme') === 'dark') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
    /* Ativação automática do link no sumário (opcional)
    document.querySelectorAll('#doc-nav a').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('#doc-nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });*/

  </script>
</body>

</html>
<script>