<?php
/**
 * @file firewall.php
 * @description Gestão da blacklist de IPs para segurança proativa.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance()->getConnection();

// Processa Ações
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    Security::validateCSRF($_POST['csrf_token'] ?? '');
    $action = $_POST['action'] ?? '';

    if ($action === 'block') {
        $ip = trim($_POST['ip']);
        $reason = trim($_POST['reason']);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            $stmt = $db->prepare("INSERT IGNORE INTO cgrn_ip_blacklist (ip_address, reason) VALUES (?, ?)");
            $stmt->execute([$ip, $reason]);
        }
    } elseif ($action === 'unblock') {
        $id = (int)$_POST['id'];
        $stmt = $db->prepare("DELETE FROM cgrn_ip_blacklist WHERE id = ?");
        $stmt->execute([$id]);
    }
}

$blacklist = $db->query("SELECT * FROM cgrn_ip_blacklist ORDER BY created_at DESC")->fetchAll();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Firewall de IPs | GlebasNord Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        :root { --sidebar-width: 260px; }
        body { background-color: #f4f7f6; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .sidebar { width: var(--sidebar-width); height: 100vh; position: fixed; left: 0; top: 0; background: #1a1c1e; color: #fff; z-index: 1000; transition: all 0.3s; }
        .main-content { margin-left: var(--sidebar-width); padding: 2rem; transition: all 0.3s; }
        .nav-link { color: #a0a0a0; padding: 0.8rem 1.5rem; border-radius: 8px; margin: 0.2rem 1rem; display: flex; align-items: center; transition: 0.2s; }
        .nav-link:hover, .nav-link.active { background: rgba(255,255,255,0.1); color: #fff; }
        .nav-link i { font-size: 1.2rem; margin-right: 12px; }
        .card { border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    </style>
</head>
<body>
    <?php include_once 'sidebar.php'; ?>

    <div class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-1">Firewall de Segurança</h2>
                <p class="text-muted small">Gerencie IPs bloqueados por comportamento abusivo ou ataques.</p>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Bloquear Novo IP</h5>
                    <form method="POST">
                        <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                        <input type="hidden" name="action" value="block">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Endereço IP</label>
                            <input type="text" name="ip" class="form-control" placeholder="123.456.78.9" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Motivo</label>
                            <textarea name="reason" class="form-control" rows="2" placeholder="Ex: Múltiplas falhas de login"></textarea>
                        </div>
                        <button type="submit" class="btn btn-danger w-100 fw-bold">Bloquear Acesso</button>
                    </form>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Lista de Bloqueio</h5>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle small">
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>Motivo / Data</th>
                                    <th class="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($blacklist)): ?>
                                    <tr><td colspan="3" class="text-center py-4 text-muted">Nenhum IP bloqueado no momento.</td></tr>
                                <?php endif; ?>
                                <?php foreach($blacklist as $ip): ?>
                                <tr>
                                    <td><code class="text-danger fw-bold"><?php echo htmlspecialchars($ip['ip_address']); ?></code></td>
                                    <td>
                                        <div class="fw-bold"><?php echo htmlspecialchars($ip['reason']); ?></div>
                                        <div class="x-small text-muted"><?php echo date('d/m/Y H:i', strtotime($ip['created_at'])); ?></div>
                                    </td>
                                    <td class="text-end">
                                        <form method="POST" class="d-inline" onsubmit="return confirm('Deseja desbloquear este IP?')">
                                            <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                                            <input type="hidden" name="action" value="unblock">
                                            <input type="hidden" name="id" value="<?php echo $ip['id']; ?>">
                                            <button type="submit" class="btn btn-outline-success btn-sm border-0">
                                                <i class="bi bi-unlock-fill"></i> Liberar
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
