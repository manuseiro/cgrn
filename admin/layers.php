<?php
/**
 * @file layers.php
 * @description Gerencia camadas geográficas personalizadas.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance()->getConnection();

// Processa ações
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    Security::validateCSRF($_POST['csrf_token'] ?? '');
    $action = $_POST['action'] ?? '';
    
    if ($action === 'add') {
        $stmt = $db->prepare("INSERT INTO cgrn_custom_layers (layer_name, layer_type, layer_url, layer_params) VALUES (?, ?, ?, ?)");
        $stmt->execute([$_POST['name'], $_POST['type'], $_POST['url'], $_POST['params']]);
    } elseif ($action === 'delete') {
        $stmt = $db->prepare("DELETE FROM cgrn_custom_layers WHERE id = ?");
        $stmt->execute([$_POST['id']]);
    } elseif ($action === 'toggle') {
        $stmt = $db->prepare("UPDATE cgrn_custom_layers SET is_active = NOT is_active WHERE id = ?");
        $stmt->execute([$_POST['id']]);
    }
}

$layers = $db->query("SELECT * FROM cgrn_custom_layers ORDER BY created_at DESC")->fetchAll();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Camadas Personalizadas | Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        :root { --sidebar-width: 260px; }
        body { background-color: #f4f7f6; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .sidebar { width: var(--sidebar-width); height: 100vh; position: fixed; left: 0; top: 0; background: #1a1c1e; color: #fff; z-index: 1000; transition: all 0.3s; }
        .main-content { margin-left: var(--sidebar-width); padding: 2rem; transition: all 0.3s; }
        .nav-link { color: #a0a0a0; padding: 0.8rem 1.5rem; border-radius: 8px; margin: 0.2rem 1rem; display: flex; align-items: center; transition: 0.2s; }
        .nav-link:hover, .nav-link.active { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .nav-link i { font-size: 1.2rem; margin-right: 12px; }
        .card { border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
    </style>
</head>
<body>
    <div class="sidebar shadow">
        <div class="p-4 mb-2 d-flex align-items-center">
            <img src="../img/logo.png" alt="GlebasNord Logo" style="width: 32px; height: 32px;" class="me-3">
            <h5 class="mb-0 fw-bold text-white">GlebasNord</h5>
        </div>
        
        <div class="px-4 py-3 mb-3 border-top border-bottom border-secondary border-opacity-25 bg-white bg-opacity-5">
            <div class="small text-muted text-uppercase fw-bold mb-1" style="font-size: 0.65rem;">Usuário Ativo</div>
            <div class="fw-bold text-white"><?php echo htmlspecialchars($_SESSION['admin_name'] ?? $_SESSION['admin_user']); ?></div>
            <div class="badge bg-<?php echo (($_SESSION['admin_role'] ?? '') === 'superadmin' ? 'warning' : 'info'); ?> mt-1" style="font-size: 0.6rem;">
                <?php echo strtoupper($_SESSION['admin_role'] ?? 'analista'); ?>
            </div>
        </div>

        <nav class="nav flex-column">
            <a class="nav-link" href="dashboard.php"><i class="bi bi-grid-1x2-fill"></i>Dashboard</a>
            <a class="nav-link" href="settings.php"><i class="bi bi-gear-fill"></i>Configurações</a>
            <a class="nav-link active" href="layers.php"><i class="bi bi-layers-fill"></i>Camadas (Custom)</a>
            <a class="nav-link" href="users.php"><i class="bi bi-people-fill"></i>Usuários Admin</a>
            <a class="nav-link" href="cache.php"><i class="bi bi-hdd-fill text-info"></i>Gestão de Cache</a>
            <a class="nav-link" href="firewall.php"><i class="bi bi-shield-slash-fill text-warning"></i>Firewall IPs</a>
            <a class="nav-link" href="health.php"><i class="bi bi-heart-pulse-fill text-danger"></i>Status APIs</a>
            <a class="nav-link" href="proxy.php"><i class="bi bi-shield-lock-fill"></i>Proxy Whitelist</a>
            <a class="nav-link" href="reports.php"><i class="bi bi-bar-chart-fill"></i>Relatórios (BI)</a>
            <div class="mt-auto p-4 w-100">
                <a href="logout.php" class="btn btn-outline-danger w-100 border-0">
                    <i class="bi bi-box-arrow-left me-2"></i>Sair
                </a>
            </div>
        </nav>
    </div>
    <div class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Camadas Personalizadas</h2>
                <p class="text-muted small">Adicione fontes de dados geográficos externas ao mapa principal.</p>
            </div>
        </div>

        <div class="row g-4">
            <!-- Formulário de Adição -->
            <div class="col-lg-4">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Nova Camada</h5>
                    <form method="POST">
                        <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                        <input type="hidden" name="action" value="add">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Nome da Camada</label>
                            <input type="text" name="name" class="form-control" placeholder="Ex: APPs Locais" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Tipo</label>
                            <select name="type" class="form-select" required>
                                <option value="WMS">WMS (GeoServer/MapServer)</option>
                                <option value="GeoJSON">GeoJSON (URL estática)</option>
                                <option value="WFS">WFS (Vetorial)</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">URL da Fonte</label>
                            <textarea name="url" class="form-control" rows="3" placeholder="https://..." required></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Parâmetros/Estilos (Opcional)</label>
                            <textarea name="params" class="form-control" rows="2" placeholder='{"layers": "workspace:camada"}'></textarea>
                            <div class="form-text x-small">Formato JSON para WMS ou estilos GeoJSON.</div>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 fw-bold">Cadastrar Camada</button>
                    </form>
                </div>
            </div>

            <!-- Lista de Camadas -->
            <div class="col-lg-8">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Camadas Ativas</h5>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle small">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Tipo</th>
                                    <th>Status</th>
                                    <th class="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($layers)): ?>
                                    <tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma camada personalizada cadastrada.</td></tr>
                                <?php endif; ?>
                                <?php foreach ($layers as $l): ?>
                                <tr>
                                    <td>
                                        <div class="fw-bold"><?php echo htmlspecialchars($l['layer_name']); ?></div>
                                        <div class="x-small text-muted text-truncate" style="max-width: 300px;"><?php echo $l['layer_url']; ?></div>
                                    </td>
                                    <td><span class="badge bg-light text-dark border"><?php echo $l['layer_type']; ?></span></td>
                                    <td>
                                        <form method="POST" class="d-inline">
                                            <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                                            <input type="hidden" name="action" value="toggle">
                                            <input type="hidden" name="id" value="<?php echo $l['id']; ?>">
                                            <button type="submit" class="btn btn-sm btn-<?php echo $l['is_active'] ? 'success' : 'secondary'; ?> py-0 px-2">
                                                <?php echo $l['is_active'] ? 'Ativa' : 'Inativa'; ?>
                                            </button>
                                        </form>
                                    </td>
                                    <td class="text-end">
                                        <form method="POST" class="d-inline" onsubmit="return confirm('Excluir esta camada?')">
                                            <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="id" value="<?php echo $l['id']; ?>">
                                            <button type="submit" class="btn btn-outline-danger btn-sm border-0"><i class="bi bi-trash"></i></button>
                                        </form>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="alert alert-info mt-4 border-0 shadow-sm small">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    <strong>Dica Técnica:</strong> Camadas GeoJSON são carregadas via <code>L.geoJSON()</code> e WMS via <code>L.tileLayer.wms()</code>. O sistema injetará essas fontes automaticamente no carregamento do mapa principal.
                </div>
            </div>
        </div>
    </div>
</body>
</html>
