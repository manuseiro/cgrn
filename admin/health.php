<?php
/**
 * @file health.php
 * @description Verifica a disponibilidade das APIs governamentais externas.
 */
session_start();
if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

function checkService($url, $name) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GlebasNord-HealthCheck/1.0');
    
    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $latency = round(($endTime - $startTime) * 1000);
    curl_close($ch);

    $status = 'offline';
    $class = 'danger';
    
    if ($httpCode >= 200 && $httpCode < 400) {
        $status = 'online';
        $class = 'success';
        if ($latency > 2000) { $status = 'lento'; $class = 'warning'; }
    }

    return [
        'name' => $name,
        'url' => $url,
        'status' => $status,
        'class' => $class,
        'code' => $httpCode,
        'latency' => $latency
    ];
}

$services = [
    checkService('https://www.car.gov.br', 'SICAR Nacional'),
    checkService('https://siscom.ibama.gov.br/geoserver/ows', 'GeoServer IBAMA'),
    checkService('https://geoservicos.inde.gov.br/geoserver/ows', 'GeoServer ICMBio'),
    checkService('https://terrabrasilis.dpi.inpe.br/app/api/v1/deforestation/alerts', 'TerraBrasilis (INPE)'),
    checkService('https://geoservicos.ibge.gov.br/geoserver/ows', 'IBGE Geociências')
];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Status do Sistema | Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body { background: #f8f9fa; font-family: 'Inter', sans-serif; }
        .status-card { border-radius: 12px; border: none; transition: transform 0.2s; }
        .status-card:hover { transform: translateY(-3px); }
        .dot { height: 12px; width: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
    </style>
</head>
<body class="py-5">
    <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Status das APIs Governamentais</h2>
                <p class="text-muted small">Monitoramento em tempo real dos serviços externos.</p>
            </div>
            <a href="dashboard.php" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-2"></i>Dashboard</a>
        </div>

        <div class="row g-4">
            <?php foreach ($services as $s): ?>
            <div class="col-md-6 col-lg-4">
                <div class="card status-card shadow-sm p-4">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h6 class="fw-bold mb-0"><?php echo $s['name']; ?></h6>
                        <span class="badge bg-<?php echo $s['class']; ?> text-uppercase" style="font-size: 0.65rem;">
                            <?php echo $s['status']; ?>
                        </span>
                    </div>
                    <div class="small text-muted text-truncate mb-3"><?php echo $s['url']; ?></div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="text-<?php echo $s['class']; ?> small fw-bold">
                            <span class="dot bg-<?php echo $s['class']; ?>"></span>
                            HTTP <?php echo $s['code']; ?>
                        </div>
                        <div class="small text-muted">
                            <i class="bi bi-speedometer2 me-1"></i> <?php echo $s['latency']; ?>ms
                        </div>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <div class="card mt-5 p-4 border-0 shadow-sm bg-primary text-white">
            <div class="d-flex align-items-center gap-3">
                <i class="bi bi-info-circle-fill fs-3"></i>
                <div>
                    <h6 class="fw-bold mb-1">Ação Recomendada</h6>
                    <p class="mb-0 small">Se algum serviço essencial (como SICAR ou IBAMA) estiver <strong>Offline</strong>, considere ativar o <strong>Aviso Global</strong> no menu de configurações para informar os usuários.</p>
                </div>
                <a href="settings.php" class="btn btn-light btn-sm ms-auto fw-bold">Configurar Aviso</a>
            </div>
        </div>
    </div>
</body>
</html>
