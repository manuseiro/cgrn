<?php
/**
 * @file cache.php
 * @description Gestão de cache do servidor (arquivos do proxy).
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$cacheDir = __DIR__ . '/../api/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

// Processa Ações
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    Security::validateCSRF($_POST['csrf_token'] ?? '');
    $action = $_POST['action'] ?? '';

    if ($action === 'clear_all') {
        $files = glob($cacheDir . '/*');
        foreach ($files as $file) {
            if (is_file($file))
                unlink($file);
        }
        $message = "Cache limpo com sucesso!";
    }
}

// Estatísticas de Cache
$files = glob($cacheDir . '/*');
$totalFiles = count($files);
$totalSize = 0;
foreach ($files as $file) {
    if (is_file($file))
        $totalSize += filesize($file);
}

function formatSize($bytes)
{
    if ($bytes >= 1048576)
        return number_format($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024)
        return number_format($bytes / 1024, 2) . ' KB';
    return $bytes . ' bytes';
}
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <title>Gestão de Cache | GlebasNord Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
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
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
    </style>
</head>

<body>
    <?php include_once 'sidebar.php'; ?>

    <div class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Central de Cache</h2>
                <p class="text-muted small">Gerencie as respostas armazenadas para otimizar a velocidade do sistema.</p>
            </div>
        </div>

        <?php if ($message): ?>
            <div class="alert alert-success border-0 shadow-sm mb-4">
                <i class="bi bi-check-circle-fill me-2"></i><?php echo $message; ?>
            </div>
        <?php endif; ?>

        <div class="row g-4">
            <div class="col-md-6">
                <div class="card p-4 h-100 shadow-sm border-start border-info border-5">
                    <h6 class="text-muted text-uppercase small fw-bold">Arquivos em Cache</h6>
                    <h2 class="fw-bold mb-0"><?php echo $totalFiles; ?></h2>
                    <p class="text-muted small mt-2">Total de respostas de APIs governamentais armazenadas localmente.
                    </p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card p-4 h-100 shadow-sm border-start border-primary border-5">
                    <h6 class="text-muted text-uppercase small fw-bold">Espaço Ocupado</h6>
                    <h2 class="fw-bold mb-0"><?php echo formatSize($totalSize); ?></h2>
                    <p class="text-muted small mt-2">Volume total de dados que deixaram de ser baixados dos servidores
                        externos.</p>
                </div>
            </div>

            <div class="col-12">
                <div class="card p-5 shadow-sm text-center">
                    <i class="bi bi-hdd-network text-info fs-1 mb-4"></i>
                    <h4 class="fw-bold">Manutenção do Cache</h4>
                    <p class="text-muted mb-4 mx-auto" style="max-width: 600px;">
                        O cache é renovado automaticamente a cada hora para cada requisição. No entanto, se você notar
                        inconsistências nos dados do CAR ou se os servidores do governo mudarem as informações, você
                        pode forçar a limpeza total aqui.
                    </p>
                    <form method="POST"
                        onsubmit="return confirm('Isso removerá todo o cache e tornará as próximas consultas mais lentas temporariamente. Prosseguir?')">
                        <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                        <input type="hidden" name="action" value="clear_all">
                        <button type="submit" class="btn btn-primary px-5 py-3 fw-bold shadow">
                            <i class="bi bi-trash3-fill me-2"></i>Limpar Todo o Cache Agora
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>