<?php
/**
 * @file layers.php
 * @description Gerencia camadas geográficas personalizadas.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance()->getConnection();

// Processa ações
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
        body { background: #f8f9fa; font-family: 'Inter', sans-serif; }
        .card { border-radius: 12px; border: none; }
    </style>
</head>
<body class="py-5">
    <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Camadas Personalizadas</h2>
                <p class="text-muted small">Adicione fontes de dados geográficos externas ao mapa principal.</p>
            </div>
            <a href="dashboard.php" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-2"></i>Dashboard</a>
        </div>

        <div class="row g-4">
            <!-- Formulário de Adição -->
            <div class="col-lg-4">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Nova Camada</h5>
                    <form method="POST">
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
                                            <input type="hidden" name="action" value="toggle">
                                            <input type="hidden" name="id" value="<?php echo $l['id']; ?>">
                                            <button type="submit" class="btn btn-sm btn-<?php echo $l['is_active'] ? 'success' : 'secondary'; ?> py-0 px-2">
                                                <?php echo $l['is_active'] ? 'Ativa' : 'Inativa'; ?>
                                            </button>
                                        </form>
                                    </td>
                                    <td class="text-end">
                                        <form method="POST" class="d-inline" onsubmit="return confirm('Excluir esta camada?')">
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
