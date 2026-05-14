<?php
/**
 * @file settings.php
 * @description Gestão de parâmetros e limites do sistema.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance();
$stmt = $db->getConnection()->query("SELECT * FROM cgrn_settings ORDER BY setting_group, setting_key");
$settings = $stmt->fetchAll();

// Mapeamento amigável de grupos
$groupLabels = [
    'app'         => 'Aplicação e Manutenção',
    'map_states'  => 'Cores dos Estados (SUDENE)',
    'map_glebas'  => 'Estilos das Glebas',
    'limits'      => 'Limites e Performance',
    'urls'        => 'Endpoints e APIs',
    'seo'         => 'SEO e Marketing'
];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configurações | GlebasNord Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body { background-color: #f4f7f6; font-family: 'Inter', sans-serif; }
        .card { border-radius: 12px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .group-header { background: #f8f9fa; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; color: #495057; font-weight: 700; font-size: 0.9rem; }
        .setting-row { padding: 15px; border-bottom: 1px solid #eee; transition: background 0.2s; }
        .setting-row:hover { background: #fcfcfc; }
        .setting-row:last-child { border-bottom: none; }
    </style>
</head>
<body class="py-5">
    <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mb-1">
                        <li class="breadcrumb-item"><a href="dashboard.php">Dashboard</a></li>
                        <li class="breadcrumb-item active">Configurações</li>
                    </ol>
                </nav>
                <h2 class="fw-bold mb-0">Configurações do Sistema</h2>
            </div>
            <a href="dashboard.php" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left me-2"></i>Voltar
            </a>
        </div>

        <?php if(isset($_GET['success'])): ?>
            <div class="alert alert-success alert-dismissible fade show shadow-sm border-0 mb-4" role="alert">
                <i class="bi bi-check-circle-fill me-2"></i><strong>Sucesso!</strong> Todas as configurações foram salvas.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>

        <div class="card shadow-sm">
            <div class="card-body p-0">
                <form action="update_settings.php" method="POST">
                    <div class="p-4 border-bottom bg-light">
                        <p class="mb-0 text-muted small">Altere os parâmetros de validação e endpoints do sistema. Essas mudanças afetam o comportamento do aplicativo em tempo real.</p>
                    </div>

                    <div class="p-4">
                    <?php 
                    $currentGroup = '';
                    foreach($settings as $s): 
                        if ($currentGroup !== $s['setting_group']):
                            $currentGroup = $s['setting_group'];
                            echo "<div class='group-header mt-3'><i class='bi bi-collection-fill me-2'></i>" . ($groupLabels[$currentGroup] ?? $currentGroup) . "</div>";
                        endif;
                    ?>
                    <div class="row setting-row align-items-center">
                        <div class="col-md-4">
                            <label class="form-label mb-0 fw-bold d-block text-dark small"><?php echo $s['setting_key']; ?></label>
                            <span class="x-small text-muted" style="font-size: 0.75rem;"><?php echo htmlspecialchars($s['description']); ?></span>
                        </div>
                        <div class="col-md-8">
                            <input type="text" name="settings[<?php echo $s['setting_key']; ?>]" 
                                   value="<?php echo htmlspecialchars($s['setting_value']); ?>" 
                                   class="form-control form-control-sm bg-light-subtle">
                        </div>
                    </div>
                    <?php endforeach; ?>
                    </div>

                    <div class="card-footer bg-white p-4 border-top text-end">
                        <button type="submit" class="btn btn-primary px-5 shadow">
                            <i class="bi bi-save2-fill me-2"></i>Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
