<?php
/**
 * @file index.php
 * @description Entry point dinâmico do GlebasNord.
 */
require_once __DIR__ . '/api/Security.php';
require_once 'api/Database.php';

Security::initSession();
Security::checkAccess(); // Verifica Firewall e Manutenção Programada

try {
  $db = Database::getInstance();
  $settings = $db->getSettings();
} catch (Exception $e) {
  $settings = [];
}

// Item 3: Modo Manutenção
if (($settings['MAINTENANCE_MODE'] ?? '0') === '1') {
  include 'admin/maintenance.php'; // Vou criar este arquivo simples
  exit;
}

// Fallbacks para SEO
$siteTitle = $settings['SEO_TITLE'] ?? 'GlebasNord | Auditoria de Glebas e Crédito Rural';
$siteDesc = $settings['SEO_DESCRIPTION'] ?? 'Análise automatizada de conformidade ambiental e BACEN para o Nordeste.';
?>
<!DOCTYPE html>
<html lang="pt-BR" data-bs-theme="light">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?php echo htmlspecialchars($siteTitle); ?></title>
  <meta name="description" content="<?php echo htmlspecialchars($siteDesc); ?>" />
  <meta name="keywords" content="<?php echo htmlspecialchars($settings['SEO_KEYWORDS'] ?? ''); ?>" />

  <?php if (!empty($settings['SEO_ANALYTICS_ID'])): ?>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=<?php echo $settings['SEO_ANALYTICS_ID']; ?>"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', '<?php echo $settings['SEO_ANALYTICS_ID']; ?>');
    </script>
  <?php endif; ?>
  <!-- Canonical -->
  <link rel="canonical" href="https://glebasnord.com.br/" />
  <!-- Open Graph / Social (muito importante para compartilhamento) -->
  <meta property="og:title" content="GlebasNord - Cálculo e Validação de Glebas Nordeste" />
  <meta property="og:description"
    content="Ferramenta completa para cálculo de área, perímetro, conformidade BACEN/SICOR e análise geoespacial de glebas rurais." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://glebasnord.com.br/" />
  <meta property="og:image" content="https://glebasnord.com.br/img/og-image.jpg" /><!-- imagem atrativa 1200x630 -->
  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="GlebasNord - Cálculo de Glebas" />
  <meta name="twitter:description"
    content="Ferramenta completa para cálculo de área, perímetro, conformidade BACEN/SICOR e análise geoespacial de glebas rurais." />
  <meta name="twitter:image" content="https://glebasnord.com.br/img/og-image.jpg" />
  <meta property="og:locale" content="pt_BR" />
  <link rel="icon" href="img/favicon-16x16.png" />
  <link rel="apple-touch-icon" href="img/apple-touch-icon-iphone-60x60.png">
  <link rel="apple-touch-icon" sizes="60x60" href="img/apple-touch-icon-ipad-76x76.png">
  <link rel="apple-touch-icon" sizes="114x114" href="img/apple-touch-icon-iphone-retina-120x120.png">
  <link rel="apple-touch-icon" sizes="144x144" href="img/apple-touch-icon-ipad-retina-152x152.png">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
  <link rel="stylesheet" href="css/style.css" />
</head>

<body>

  <?php if (($settings['GLOBAL_BANNER_SHOW'] ?? '0') === '1'): ?>
    <!-- Item 3: Banner de Aviso Global -->
    <div class="alert alert-warning alert-dismissible fade show rounded-0 mb-0 border-0 shadow-sm" role="alert"
      style="z-index: 1100; position: relative;">
      <div class="container-fluid px-3 d-flex align-items-center gap-2">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <strong>Aviso:</strong> <?php echo htmlspecialchars($settings['GLOBAL_BANNER_MSG'] ?? ''); ?>
        <button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    </div>
  <?php endif; ?>

  <!-- ══════════════════════════════════════════════════════════════
     NAVBAR
══════════════════════════════════════════════════════════════ -->
  <nav class="navbar navbar-expand-lg bg-dark navbar-dark" data-bs-theme="dark">
    <div class="container-fluid px-3">
      <a class="navbar-brand d-flex align-items-center gap-2" href="./">
        <img src="img/logo.png" alt="GlebasNord Logo">
        <h1 class="fw-bold fs-4 text-white mb-0" style="font-size: 1.5rem;">GlebasNord</h1>
      </a>

      <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navMain">
        <ul class="navbar-nav me-auto gap-1">

          <!-- Glebas -->
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle px-2" href="#" data-bs-toggle="dropdown">
              <i class="bi bi-geometry me-1"></i>Glebas
            </a>
            <ul class="dropdown-menu shadow-sm">
              <li><a class="dropdown-item" href="#" data-modal-open="adicionarGleba">
                  <i class="bi bi-plus-circle-fill me-2"></i>Adicionar Gleba</a></li>
              <li><a class="dropdown-item" href="#" id="validarGlebas">
                  <i class="bi bi-patch-check-fill me-2"></i>Validar Glebas</a></li>
              <li><a class="dropdown-item" href="#" id="calcularArea">
                  <i class="bi bi-rulers me-2"></i>Calcular Áreas</a></li>
              <li><a class="dropdown-item" href="#" id="desenharGleba">
                  <i class="bi bi-vector-pen me-2"></i>Desenhar no Mapa</a></li>
              <li>
                <hr class="dropdown-divider">
              </li>
              <li><a class="dropdown-item" href="#" data-action="conformidade">
                  <i class="bi bi-shield-lock-fill me-2"></i>Verificar Conformidade BACEN/SICOR</a></li>
            </ul>
          </li>

          <!-- Exportar -->
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle px-2" href="#" data-bs-toggle="dropdown">
              <i class="bi bi-box-arrow-up me-1"></i>Exportar
            </a>
            <ul class="dropdown-menu shadow-sm">
              <li><a class="dropdown-item" href="#" data-export="csv">
                  <i class="bi bi-file-earmark-spreadsheet me-2"></i>CSV (Planilha)</a></li>
              <li><a class="dropdown-item" href="#" data-export="geojson">
                  <i class="bi bi-globe-americas me-2"></i>GeoJSON</a></li>
              <li><a class="dropdown-item" href="#" data-export="kml">
                  <i class="bi bi-geo-alt-fill me-2"></i>KML (Google Earth)</a></li>
              <li><a class="dropdown-item" href="#" data-export="image">
                  <i class="bi bi-file-earmark-image me-2"></i>Imagem (PNG)</a></li>
              <li>
                <hr class="dropdown-divider">
              </li>
              <li><a class="dropdown-item" href="#" data-export="project">
                  <i class="bi bi-filetype-json me-2"></i>Projeto Completo (.cgrn)</a></li>
            </ul>
          </li>

          <!-- Projeto -->
          <li class="nav-item">
            <a class="nav-link px-2" href="#" data-modal-open="projetoModal">
              <i class="bi bi-folder-fill me-1"></i>Projeto
            </a>
          </li>

        </ul>

        <!-- Direita -->
        <ul class="navbar-nav align-items-center gap-2 ps-2">
          <li class="nav-item">
            <a class="nav-link px-1 opacity-75" href="#" data-modal-open="sobreModal">
              <i class="bi bi-info-circle-fill"></i>
              <span class="d-lg-none ms-1">Sobre</span>
            </a>
          </li>
          <li class="nav-item py-2 py-lg-1 col-12 col-lg-auto">
            <div class="vr d-none d-lg-flex h-100 mx-lg-2 text-white"></div>
            <hr class="d-lg-none my-2 text-white-50">
          </li>
          <li class="nav-item">
            <button id="toggleDarkMode" class="btn btn-link nav-link border-opacity-25">
              <i class="bi bi-moon-stars-fill me-1"></i>
              <span class="d-lg-none">Modo Escuro</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <!-- Mapa -->
  <div id="map" role="main" aria-label="Mapa interativo de glebas"></div>
  <!-- ── Painel flutuante de camadas (lado direito do mapa) ──────── -->
  <div id="layerControlPanel">
    <div class="lcp-header" id="btnToggleLayerPanel">
      <i class="bi bi-layers-fill me-1"></i>
      <span>Camadas</span>
      <i class="bi bi-chevron-up ms-auto" id="layerPanelIcon"></i>
    </div>
    <div id="layerPanelBody">

      <div class="lcp-section-title">Análise</div>

      <label class="lcp-item">
        <div class="lcp-swatch" style="background:#e63946;border-color:#c1121f"></div>
        <span>Embargos IBAMA</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarIbama" role="switch">
        </div>
      </label>

      <label class="lcp-item">
        <div class="lcp-swatch" style="background:#2d6a4f;border-color:#1b4332"></div>
        <span>Unid. Conservação</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarUC" role="switch">
        </div>
      </label>

      <label class="lcp-item">
        <div class="lcp-swatch" style="background:#e9c46a;border-color:#b5843a"></div>
        <span>Terras Indígenas</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarTI" role="switch">
        </div>
      </label>

      <label class="lcp-item">
        <div class="lcp-swatch" style="background:#457b9d;border-color:#1d3557"></div>
        <span>Bioma</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarBioma" role="switch">
        </div>
      </label>

      <div class="lcp-divider"></div>
      <div class="lcp-section-title">Exibição</div>

      <label class="lcp-item">
        <i class="bi bi-geo-alt-fill me-1 opacity-50" style="width:14px"></i>
        <span>Marcadores</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarMarcadores" checked role="switch">
        </div>
      </label>

      <label class="lcp-item">
        <i class="bi bi-crosshair me-1 opacity-50" style="width:14px"></i>
        <span>Centroides</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="mostrarCentroids" checked role="switch">
        </div>
      </label>

      <div class="lcp-divider"></div>
      <div class="lcp-section-title">Validação</div>

      <label class="lcp-item">
        <i class="bi bi-shield-check me-1 opacity-50" style="width:14px"></i>
        <span>Validar Pontos</span>
        <div class="form-check form-switch ms-auto mb-0">
          <input class="form-check-input lcp-switch" type="checkbox" id="validarRegras" checked role="switch">
        </div>
      </label>

    </div>
  </div>
  <!-- ── fim painel flutuante ────────────────────────────────────── -->
  <!-- Painel legenda TI -->
  <div id="tiLegendPanel" class="d-none">
    <div class="ti-legend-header" id="btnToggleLegenda">
      <span><i class="bi bi-feather"></i> — Terras Indígenas</span>
      <i class="bi bi-chevron-down ms-auto" id="legendToggleIcon"></i>
    </div>
    <div id="tiLegendBody">
      <div id="tiLegendContent"></div>
    </div>
  </div>

  <!-- Status bar -->
  <footer id="statusBar" role="status" aria-live="polite" class="d-flex align-items-center px-3">
    <div class="d-flex align-items-center gap-3">
      <span id="statusCoords" class="status-item">
        <i class="bi bi-crosshair me-1 opacity-40"></i>Mova o cursor
      </span>
      <span class="status-divider"></span>
      <span id="statusArea" class="status-item">—</span>
      <span class="status-divider d-none d-md-inline-block"></span>
      <span class="status-item d-none d-md-inline text-muted opacity-50">CGRN v3.7.2 • SIRGAS 2000</span>
    </div>

    <div class="ms-auto d-flex align-items-center gap-2 gap-md-3">
      <span id="biomaStatus" class="status-item small text-secondary d-none d-sm-inline-flex" title="Status Biomas">
        <i class="bi bi-hourglass-split"></i> <span class="d-none d-lg-inline ms-1">BIOMAS</span>
      </span>
      <span class="status-divider d-none d-sm-inline-block"></span>
      <span id="ibamaStatus" class="status-item small text-secondary d-none d-sm-inline-flex" title="Status IBAMA">
        <i class="bi bi-hourglass-split"></i> <span class="d-none d-lg-inline ms-1">IBAMA</span>
      </span>
      <span class="status-divider d-none d-sm-inline-block"></span>
      <span id="ucStatus" class="status-item small text-secondary d-none d-sm-inline-flex" title="Status ICMBio">
        <i class="bi bi-hourglass-split"></i> <span class="d-none d-lg-inline ms-1">ICMBio</span>
      </span>
      <span class="status-divider d-none d-md-inline-block"></span>
      <span id="sudeneStatus" class="status-item small text-warning d-none d-md-inline-flex" title="Status SUDENE">
        <i class="bi bi-hourglass-split"></i> <span class="d-none d-lg-inline ms-1">SUDENE</span>
      </span>
      <span class="status-divider d-none d-md-inline-block"></span>
      <span id="tiStatus" class="status-item small text-warning d-none d-md-inline-flex" title="Terras Indígenas">
        <i class="bi bi-hourglass-split"></i> <span class="d-none d-lg-inline ms-1">TI</span>
      </span>
    </div>
  </footer>

  <!-- Toast container -->
  <div id="toastContainer" class="toast-container position-fixed end-0 p-3 cgrn-toast-container"></div>

  <!-- ══════════════════════════════════════════════════════════════
     MODAL: ADICIONAR / VALIDAR GLEBA
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="adicionarGleba" tabindex="-1" aria-labelledby="adicionarGlebaLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-dark text-white py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="adicionarGlebaLabel">
            <i class="bi bi-plus-circle"></i> Adicionar / Validar Gleba
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-4">

          <div id="msgGleba" class="mb-3"></div>

          <ul class="nav nav-pills mb-4 bg-body-tertiary p-1 rounded-3" role="tablist">
            <li class="nav-item flex-fill"><button class="nav-link rounded-top active w-100 py-2 rounded-top"
                id="tab-manual-btn" data-bs-toggle="tab" data-bs-target="#tabManual" type="button">
                <i class="bi bi-keyboard me-2"></i>Entrada Manual</button></li>
            <li class="nav-item flex-fill"><button class="nav-link rounded-top w-100 py-2 rounded-top"
                id="tab-upload-btn" data-bs-toggle="tab" data-bs-target="#tabUpload" type="button">
                <i class="bi bi-cloud-arrow-up me-2"></i>Importar Arquivo</button></li>
            <li class="nav-item flex-fill"><button class="nav-link rounded-top w-100 py-2 rounded-top" id="tab-car-btn"
                data-bs-toggle="tab" data-bs-target="#tabCAR" type="button">
                <i class="bi bi-search me-2"></i>Consultar CAR</button></li>
          </ul>


          <!-- <div class="mt-4 pt-4 border-top">
            <h6 class="small fw-bold text-uppercase text-muted mb-3" style="letter-spacing:.05em">Configurações de
              Visualização</h6>
            <div class="row g-3">
              <div class="col-6 col-md-4">
                <div class="form-check form-switch custom-switch">
                  <input class="form-check-input" type="checkbox" id="mostrarMarcadores">
                  <label class="form-check-label small" for="mostrarMarcadores">Mostrar Marcadores</label>
                </div>
              </div>
              <div class="col-6 col-md-4">
                <div class="form-check form-switch custom-switch">
                  <input class="form-check-input" type="checkbox" id="mostrarCentroids">
                  <label class="form-check-label small" for="mostrarCentroids">Centroids</label>
                </div>
              </div>
              <div class="col-6 col-md-4">
                <div class="form-check form-switch custom-switch">
                  <input class="form-check-input" type="checkbox" id="validarRegras" checked>
                  <label class="form-check-label small text-primary fw-semibold" for="validarRegras">Validar
                    Pontos</label>
                </div>
              </div>
            </div>
          </div> Opções -->

          <div class="tab-content">
            <!-- Tab Manual -->
            <div class="tab-pane fade show active" id="tabManual" role="tabpanel">
              <label for="coordenadas" class="form-label small fw-semibold text-muted mb-2">
                Coordenadas <span class="fw-normal"> - #GlebaId #OrdemPonto #Latitude #Longitude</span>
              </label>
              <textarea id="coordenadas" class="form-control font-monospace coord-area rounded-3 border-2" rows="8"
                placeholder="Exemplo:&#10;1 1 -6.2410 -38.9140&#10;1 2 -6.2410 -38.8980&#10;1 3 -6.2270 -38.8980&#10;1 4 -6.2270 -38.9140&#10;1 5 -6.2410 -38.9140"
                spellcheck="false" autocorrect="off" autocapitalize="off" style="font-size: 0.9rem"></textarea>
              <!--  Habilitar Somente em Ambiente de Desenvolvimento/Teste-->
              <div class="d-flex align-items-center gap-2 mt-3 flex-wrap">
                <button id="inserirExemplo" class="btn btn-outline-secondary btn-sm px-3 ">
                  <i class="bi bi-lightbulb me-1"></i>Exemplo (Orós/CE)
                </button>
                <small class="text-muted border-start ps-2">lat [−18,−1] | lon [−48,−34]</small>
              </div>
            </div>

            <!-- Tab Upload -->
            <div class="tab-pane fade" id="tabUpload" role="tabpanel">
              <div class="upload-zone border-2 border-dashed rounded-4 p-4 text-center transition-all" id="uploadZone"
                role="button" tabindex="0" aria-label="Zona de importação de arquivo">

                <!-- Ícone e instruções (estado inicial) -->
                <div class="upload-idle-state">
                  <i class="bi bi-cloud-arrow-up fs-1 text-primary opacity-50 mb-2 d-block"></i>
                  <p class="fw-bold mb-1">Arraste ou clique para selecionar</p>
                  <p class="small text-muted mb-0">
                    Arquivos .KML, .SHP (ZIP), .CSV ou .TXT<br>
                    <span class="opacity-50" style="font-size:.73rem">
                      CSV/TXT até 10 MB &nbsp;·&nbsp; KML até 20 MB &nbsp;·&nbsp; ZIP até 50 MB
                    </span>
                  </p>
                </div>

                <!-- Painel de informações do arquivo (exibido logo após selecionar) -->
                <div id="uploadFileInfo" class="d-none mt-3 text-start"></div>

                <!-- Barra de progresso (exibida durante o processamento) -->
                <div id="uploadProgress" class="d-none mt-3">
                  <div class="progress mb-1" style="height:8px;border-radius:4px">
                    <div id="uploadProgressBar"
                      class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar"
                      style="width:0%;transition:width .25s ease" aria-valuenow="0" aria-valuemin="0"
                      aria-valuemax="100">
                    </div>
                  </div>
                  <div id="uploadProgressMsg" class="small text-muted text-start" style="font-size:.75rem">
                    Aguardando…
                  </div>
                </div>

                <input type="file" id="fileUpload" accept=".csv,.txt,.kml,.zip" class="d-none" />
              </div>
              <div class="mt-4 grid-help rounded-3 p-3 bg-body-tertiary">
                <div class="row g-3">
                  <div class="col-md-6">
                    <h6 class="small fw-bold text-uppercase mb-2"><i class="bi bi-file-earmark-zip me-1"></i> SIG /
                      SHP
                    </h6>
                    <p class="small text-muted mb-0">Envie um ZIP contendo os arquivos .shp e .dbf (obrigatórios).</p>
                  </div>
                  <div class="col-md-6">
                    <h6 class="small fw-bold text-uppercase mb-2"><i class="bi bi-geo-alt me-1"></i> Google Earth</h6>
                    <p class="small text-muted mb-0">Suporte a arquivos KML com Polígonos ou MultiGeometry.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab Consultar CAR -->
            <div class="tab-pane fade" id="tabCAR" role="tabpanel">
              <div class="p-3 bg-light rounded-3 border">
                <label for="carSearchCode" class="form-label small fw-bold text-muted text-uppercase mb-2">
                  Código do Imóvel (SICAR)
                </label>
                <div class="input-group mb-1">
                  <input type="text" id="carSearchCode" class="form-control font-monospace"
                    placeholder="UF-IBGE(7)-IDENTIFICADOR(32)" maxlength="43" autocomplete="off" autocorrect="off"
                    autocapitalize="characters" spellcheck="false">
                  <button class="btn btn-primary px-4" type="button" id="btnSearchCAR">
                    <i class="bi bi-search me-1"></i>Buscar
                  </button>
                </div>
                <!-- Indicador de progresso e feedback inline -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div id="carInputFeedback" class="small text-muted">
                    <i class="bi bi-keyboard me-1"></i>Digite ou cole o código completo
                  </div>
                  <span id="carCharCount" class="badge bg-secondary" style="font-size:.68rem">0 / 43</span>
                </div>
                <div id="carProgressBar" class="progress mb-3" style="height:3px">
                  <div id="carProgressFill" class="progress-bar" role="progressbar"
                    style="width:0%;transition:width .15s ease"></div>
                </div>

                <!-- Container para resultados da busca -->
                <div id="carSearchResult" class="mt-3"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer bg-body-tertiary border-0 gap-2 p-3">
          <button type="button" id="limparMapa"
            class="btn btn-danger  btn-link text-danger text-decoration-none me-auto px-2">
            <i class="bi bi-trash3 me-1"></i>Limpar Mapa</button>
          <button type="button" id="validar-gleba-btn" class="btn btn-outline-primary  px-4">
            <i class="bi bi-check2-circle me-1"></i>Validar</button>
          <button type="button" id="adicionar-gleba-btn" class="btn btn-primary  px-4 shadow-sm">
            <i class="bi bi-plus-lg me-1"></i>Processar e Adicionar</button>
        </div>
      </div>
    </div>
  </div>
  <!-- ══════════════════════════════════════════════════════════════
     MODAL: RESULTADOS / ÁREA DAS GLEBAS
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="resultadosModal" tabindex="-1" aria-labelledby="resultadosLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-dark text-white py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="resultadosLabel">
            <i class="bi bi-table"></i> Área e Conformidade das Glebas
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle results-table mb-0" style="min-width: 1000px">
              <thead class="sticky-top bg-white shadow-sm" style="z-index: 10">
                <tr class="group-header bg-light">
                  <th colspan="2" class="border-end text-center py-2"><small
                      class="text-uppercase fw-bold text-muted">Identificação</small></th>
                  <th colspan="3" class="border-end text-center py-2 bg-primary bg-opacity-10"><small
                      class="text-uppercase fw-bold text-primary">Geometria</small></th>
                  <th colspan="3" class="border-end text-center py-2 bg-success bg-opacity-10"><small
                      class="text-uppercase fw-bold text-success">Conformidade Ambiental</small></th>
                  <th class="text-center py-2"><small class="text-uppercase fw-bold text-muted">Ações</small></th>
                </tr>
                <tr class="small text-muted">
                  <th style="width: 50px" class="ps-3 text-center">Cor</th>
                  <th class="border-end">ID / Bioma</th>
                  <th class="text-end">Área (ha)</th>
                  <th class="text-end">Perímetro</th>
                  <th class="text-center border-end">Mun.</th>
                  <th class="text-center">Semiárido</th>
                  <th class="text-center">TI (Funai)</th>
                  <th class="text-center border-end">BACEN / CAR</th>
                  <th class="text-center pe-3">Operações</th>
                </tr>
              </thead>
              <tbody id="resultadosTableBody">
                <tr>
                  <td colspan="9" class="text-center text-muted py-5">
                    <div class="opacity-25 mb-3">
                      <i class="bi bi-inbox fs-1"></i>
                    </div>
                    <p class="mb-0">Nenhuma gleba processada para exibição.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer bg-body-tertiary border-0 gap-2 p-3">
          <div class="me-auto d-none d-lg-flex align-items-center gap-3 ps-2">
            <small class="text-muted"><span class="badge bg-danger-subtle text-danger-emphasis me-1">Terras
                Indígenas</span>
              Sobreposição Funai</small>
            <small class="text-muted"><span class="badge bg-warning-subtle text-warning-emphasis me-1">CAR</span>
              Ressalva Ambiental</small>
            <small class="text-muted"><span class="badge bg-success-subtle text-success-emphasis me-1">OK</span>
              Regular</small>
          </div>

          <button type="button" class="btn btn-outline-dark px-3  btn-sm" id="btnConformidadeModal"
            data-action="conformidade">
            <i class="bi bi-shield-lock-fill me-1"></i>Verificar BACEN/SICOR
          </button>

          <div class="dropdown">
            <button class="btn btn-success px-3  btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
              <i class="bi bi-box-arrow-up me-1"></i>Exportar
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0">
              <li>
                <h6 class="dropdown-header">Arquivos de Dados</h6>
              </li>
              <li><a class="dropdown-item" href="#" data-export="csv"><i
                    class="bi bi-file-earmark-spreadsheet me-2"></i>CSV (Excel/Sheets)</a></li>
              <li><a class="dropdown-item" href="#" data-export="geojson"><i
                    class="bi bi-globe-americas me-2"></i>GeoJSON (GIS)</a></li>
              <li><a class="dropdown-item" href="#" data-export="kml"><i class="bi bi-geo-alt me-2"></i>KML (Google
                  Earth)</a></li>
              <li>
                <hr class="dropdown-divider">
              </li>
              <li>
                <h6 class="dropdown-header">Outros</h6>
              </li>
              <li><a class="dropdown-item" href="#" data-export="image"><i class="bi bi-image me-2"></i>Capturar Mapa
                  (PNG)</a></li>
            </ul>
          </div>

          <button type="button" class="btn btn-secondary px-4  btn-sm" data-bs-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════
     MODAL: CONFORMIDADE BACEN/SICOR (detalhe por gleba)
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="conformidadeModal" tabindex="-1" aria-labelledby="conformidadeModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-dark text-white py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="conformidadeModalLabel">
            <i class="bi bi-shield-lock"></i> Conformidade BACEN/SICOR
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-4" id="conformidadeBody">
          <!-- Conteúdo dinâmico em conformidade.js -->
        </div>

        <div class="px-3 py-2 bg-body-tertiary border-top">
          <small class="text-muted" style="font-size:.68rem">
            <strong>Base legal:</strong> Res. CMN 5.081/2023 (SICOR) • Res. CMN 4.945/2021 • Decreto 6.040/2007
          </small>
        </div>

        <div class="modal-footer bg-body-tertiary border-0 p-3">
          <button type="button" id="btnLimparCacheCAR"
            class="btn btn-link text-muted text-decoration-none me-auto btn-sm">
            <i class="bi bi-arrow-clockwise me-1"></i>Limpar Cache CAR
          </button>
          <button type="button" class="btn btn-secondary px-4  btn-sm" data-bs-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════
     MODAL: EDITAR GLEBA
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="editarGlebaModal" tabindex="-1" aria-labelledby="editarGlebaModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-warning text-dark py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="editarGlebaModalLabel">
            <i class="bi bi-pencil-square"></i> Editar Gleba
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-4">
          <input type="hidden" id="editGlebaId" />
          <p class="text-muted small mb-3">
            Formato: <code>#GlebaId #PontoId #Latitude #Longitude</code>. O mapa e a conformidade serão atualizados.
          </p>
          <textarea id="glebaEditArea" class="form-control font-monospace coord-area rounded-3 border-2" rows="10"
            spellcheck="false" autocorrect="off" style="font-size: 0.9rem"></textarea>
          <div
            class="d-flex align-items-center gap-2 mt-3 p-2 bg-warning bg-opacity-10 rounded border border-warning border-opacity-25">
            <i class="bi bi-exclamation-triangle text-warning"></i>
            <small class="text-muted">Certifique-se de que o polígono esteja fechado (1º e último pontos
              iguais).</small>
          </div>
        </div>
        <div class="modal-footer bg-body-tertiary border-0 p-3">
          <button type="button" class="btn btn-outline-secondary px-4  btn-sm" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" id="confirmarEdicao" class="btn btn-warning px-4  btn-sm fw-bold">
            <i class="bi bi-check2 me-1"></i>Confirmar Alterações</button>
        </div>
      </div>
    </div>
  </div>
  <!-- ══════════════════════════════════════════════════════════════
     MODAL: PROJETO
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="projetoModal" tabindex="-1" aria-labelledby="projetoModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-primary text-white py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="projetoModalLabel">
            <i class="bi bi-database-fill"></i> Gerenciar Projeto
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-4">
          <div id="msgProjeto" class="mb-3"></div>
          <div class="mb-4">
            <label for="projectName" class="form-label small fw-bold text-muted text-uppercase mb-2">Nome do
              Projeto</label>
            <input type="text" id="projectName" class="form-control form-control-lg fs-6"
              placeholder="Ex: Fazenda São João" maxlength="100" />
          </div>
          <div id="savedProjectInfo" class="mb-4 p-3 bg-body-tertiary rounded-3 border">
            <small class="text-muted">Nenhum projeto salvo localmente.</small>
          </div>
          <div class="d-grid gap-2">
            <button id="salvarProjeto" class="btn btn-primary  py-2">
              <i class="bi bi-floppy me-2"></i>Salvar Projeto Atual</button>
            <button id="carregarProjeto" class="btn btn-outline-primary  py-2">
              <i class="bi bi-folder2-open me-2"></i>Carregar do Navegador</button>
            <hr class="my-3" />
            <button id="btnLimparProjeto" class="btn btn-link text-danger text-decoration-none btn-sm">
              <i class="bi bi-trash3 me-2"></i>Excluir Projeto Salvo</button>
          </div>
        </div>
        <div class="modal-footer bg-body-tertiary border-0 p-3">
          <button type="button" class="btn btn-secondary px-4  btn-sm" data-bs-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════
     MODAL: SOBRE
══════════════════════════════════════════════════════════════ -->
  <div class="modal fade" id="sobreModal" tabindex="-1" aria-labelledby="sobreModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header bg-dark text-white py-3">
          <h5 class="modal-title d-flex align-items-center gap-2 fs-6" id="sobreModalLabel">
            <i class="bi bi-info-circle"></i> Sobre o GlebasNord
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body p-4 text-center">
          <div class="mb-4">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--bs-primary)" stroke-width="1.5">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <h5 class="fw-bold mt-3 mb-1">GlebasNord <span class="badge bg-primary ms-1"
                style="font-size: 0.6rem">v3.7.2</span></h5>
            <p class="text-muted small">Cálculo e análise de glebas rurais no Nordeste</p>
          </div>

          <div class="text-start mb-4">
            <h6 class="small fw-bold text-uppercase text-muted mb-3 border-bottom pb-1">Conformidade BACEN/SICOR</h6>
            <div class="d-flex flex-column gap-2 small">
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Terras
                Indígenas (Funai 2023)</div>
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Unidades de
                Conservação (ICMBio)</div>
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Embargos
                Ambientais (IBAMA)</div>
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Semiárido
                (SUDENE 2021)</div>
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Cadastro
                Ambiental Rural (CAR)</div>
              <div class="d-flex align-items-center gap-2"><i class="bi bi-check-circle text-success"></i> Biomas
                (IBGE)
              </div>
            </div>
          </div>

          <div class="p-3 bg-light rounded-3 small text-muted text-start mb-0">
            <i class="bi bi-info-circle-fill text-primary me-1"></i> Desenvolvido para facilitar o fluxo de análise de
            crédito rural, garantindo conformidade com a Res. CMN 5.081/2023.
          </div>
        </div>
        <div class="modal-footer bg-body-tertiary border-0 p-3">
          <button type="button" class="btn btn-primary px-4  btn-sm" data-bs-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>


  <!-- ══════════════════════════════════════════════════════════════
     SCRIPTS
══════════════════════════════════════════════════════════════ -->
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
  <script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
  <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js"></script>
  <script src="https://unpkg.com/shpjs@latest/dist/shp.js"></script>
  <script type="module" src="js/main.js"></script>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "GlebasNord",
      "url": "https://glebasnord.com.br",
      "description": "Ferramenta completa para cálculo de área, perímetro, conformidade BACEN/SICOR e análise geoespacial de glebas rurais.",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "BRL"
      },
      "author": {
        "@type": "Organization",
        "name": "Equipe GlebasNord"
      }
    }
</script>
</body>

</html>