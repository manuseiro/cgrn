<?php
/**
 * @file reports.php
 * @description Central de BI com Mapa de Calor e Logs de Erro.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';
Security::initSession();

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance();
$conn = $db->getConnection();

// 1. Dados para o Mapa de Calor (Lat/Lon dos logs)
$heatmapPoints = $conn->query("SELECT lat, lon FROM cgrn_audit_logs WHERE lat IS NOT NULL AND lon IS NOT NULL")->fetchAll(PDO::FETCH_ASSOC);

// 2. Logs de Erro de API
$apiErrors = $conn->query("
    SELECT created_at, details, api_status, ip_address 
    FROM cgrn_audit_logs 
    WHERE action = 'API_ERROR' OR api_status IS NOT NULL 
    ORDER BY created_at DESC 
    LIMIT 20
")->fetchAll();

// 3. Estatísticas Rápidas
$countLogins = $conn->query("SELECT COUNT(*) FROM cgrn_audit_logs WHERE action = 'LOGIN'")->fetchColumn();
$countErrors = $conn->query("SELECT COUNT(*) FROM cgrn_audit_logs WHERE action = 'API_ERROR'")->fetchColumn();
// 4. Ranking de Municípios (Extraído do campo details "Gleba em ...")
$municipioRanking = $conn->query("
    SELECT 
        SUBSTRING_INDEX(SUBSTRING_INDEX(details, 'Gleba em ', -1), '.', 1) as municipio,
        COUNT(*) as total
    FROM cgrn_audit_logs 
    WHERE action = 'ADD_GLEBA' AND details LIKE 'Gleba em %'
    GROUP BY municipio
    ORDER BY total DESC
    LIMIT 10
")->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <title>BI & Relatórios | GlebasNord Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
    <style>
        :root {
            --sidebar-width: 260px;
        }

        body {
            background-color: #f4f7f6;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .sidebar {
            width: var(--sidebar-width);
            height: 100vh;
            position: fixed;
            left: 0;
            top: 0;
            background: #1a1c1e;
            color: #fff;
            z-index: 1000;
            transition: all 0.3s;
        }

        .main-content {
            margin-left: var(--sidebar-width);
            padding: 2rem;
            transition: all 0.3s;
        }

        .nav-link {
            color: #a0a0a0;
            padding: 0.8rem 1.5rem;
            border-radius: 8px;
            margin: 0.2rem 1rem;
            display: flex;
            align-items: center;
            transition: 0.2s;
        }

        .nav-link:hover,
        .nav-link.active {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .nav-link i {
            font-size: 1.2rem;
            margin-right: 12px;
        }

        .card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.03);
        }

        #heatmapContainer {
            height: 400px;
            border-radius: 12px;
            z-index: 1;
        }

        .error-log-item {
            border-left: 4px solid #dc3545;
            margin-bottom: 10px;
            padding: 10px;
            background: #fff;
            border-radius: 4px;
        }
    </style>
</head>

<body>
    <?php include_once 'sidebar.php'; ?>
    <div class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Business Intelligence (BI)</h2>
                <p class="text-muted small">Monitoramento geográfico e técnico do GlebasNord.</p>
            </div>
        </div>

        <div class="row g-4 mb-5">
            <!-- Estatísticas -->
            <div class="col-md-4">
                <div class="card p-4 text-center h-100 border-start border-primary border-5 shadow-sm">
                    <h1 class="fw-bold text-primary mb-0"><?php echo $countLogins; ?></h1>
                    <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Acessos Totais</small>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card p-4 text-center h-100 border-start border-danger border-5 shadow-sm">
                    <h1 class="fw-bold text-danger mb-0"><?php echo $countErrors; ?></h1>
                    <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Falhas de API
                        Detectadas</small>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card p-4 text-center h-100 border-start border-success border-5 shadow-sm">
                    <h1 class="fw-bold text-success mb-0"><?php echo count($heatmapPoints); ?></h1>
                    <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Pontos
                        Georreferenciados</small>
                </div>
            </div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-lg-12">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4"><i class="bi bi-fire text-danger me-2"></i>Concentração Geográfica das
                        Análises</h5>
                    <div id="heatmapContainer"></div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <!-- Item 6: Ranking de Municípios -->
            <div class="col-lg-6">
                <div class="card p-4 h-100 shadow-sm">
                    <h5 class="fw-bold mb-4"><i class="bi bi-trophy-fill text-warning me-2"></i>Top 10 Municípios
                        (Demanda)</h5>
                    <canvas id="rankingChart"></canvas>
                    <?php if (empty($municipioRanking)): ?>
                        <p class="text-center text-muted mt-5 small italic">Aguardando novos registros de glebas para gerar
                            o ranking.</p>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Item 6: Logs de Erro -->
            <div class="col-lg-6">
                <div class="card p-4 h-100 shadow-sm">
                    <h5 class="fw-bold mb-4"><i class="bi bi-bug-fill text-danger me-2"></i>Saúde das APIs Externas
                        (Logs)</h5>
                    <div class="overflow-auto" style="max-height: 300px;">
                        <?php if (empty($apiErrors)): ?>
                            <div class="text-center py-5 opacity-25">
                                <i class="bi bi-check2-circle fs-1"></i>
                                <p>Nenhum erro de API registrado.</p>
                            </div>
                        <?php else: ?>
                            <?php foreach ($apiErrors as $err): ?>
                                <div class="error-log-item border-start border-4 border-danger p-2 mb-2 bg-light rounded small">
                                    <div class="d-flex justify-content-between">
                                        <span
                                            class="badge bg-danger mb-1"><?php echo htmlspecialchars($err['api_status']); ?></span>
                                        <small
                                            class="text-muted"><?php echo date('d/m H:i', strtotime($err['created_at'])); ?></small>
                                    </div>
                                    <div class="fw-bold"><?php echo htmlspecialchars($err['details']); ?></div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Heatmap
        const map = L.map('heatmapContainer').setView([-9.5, -40.5], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
        const points = <?php echo json_encode($heatmapPoints); ?>;
        const heatData = points.map(p => [parseFloat(p.lat), parseFloat(p.lon), 0.5]);
        if (heatData.length > 0) L.heatLayer(heatData, { radius: 25, blur: 15, maxZoom: 10 }).addTo(map);

        // Chart.js: Ranking de Municípios
        const rankCtx = document.getElementById('rankingChart').getContext('2d');
        const rankData = <?php echo json_encode($municipioRanking); ?>;

        new Chart(rankCtx, {
            type: 'bar',
            data: {
                labels: rankData.map(d => d.municipio),
                datasets: [{
                    label: 'Análises Realizadas',
                    data: rankData.map(d => d.total),
                    backgroundColor: '#B9770E',
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    </script>
</body>

</html>