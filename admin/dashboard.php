<?php
/**
 * @file dashboard.php
 * @description Painel principal do administrador - Versão Expandida.
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

$settings = $db->getSettings();
$domains = $db->getAllowedDomains();

// Busca contagem de logs para o BI rápido
$logCount = $conn->query("SELECT COUNT(*) FROM cgrn_audit_logs")->fetchColumn();
$lastLog = $conn->query("SELECT created_at FROM cgrn_audit_logs ORDER BY created_at DESC LIMIT 1")->fetchColumn();

// Verifica modo manutenção
$isMaintenance = ($settings['MAINTENANCE_MODE'] ?? '0') === '1';

?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard | GlebasNord Admin</title>
    <link rel="icon" href="../img/favicon-16x16.png" />
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
        <header class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h3 class="fw-bold mb-1">Painel Administrativo</h3>
                <p class="text-muted small">Gerenciamento central do CGRN v3.7.2</p>
            </div>
            <div class="d-flex align-items-center gap-3">
                <a href="health.php" class="btn btn-white shadow-sm btn-sm">
                    <i class="bi bi-activity text-danger me-1"></i> Ver Saúde das APIs
                </a>
                <?php if ($isMaintenance): ?>
                    <span class="badge bg-danger p-2"><i class="bi bi-tools me-1"></i> MANUTENÇÃO ATIVA</span>
                <?php else: ?>
                    <span class="badge bg-success p-2"><i class="bi bi-check-circle me-1"></i> SISTEMA ONLINE</span>
                <?php endif; ?>
            </div>
        </header>

        <!-- Cards de Estatísticas -->
        <div class="row g-4 mb-5">
            <div class="col-md-4">
                <div class="card p-3 h-100 border-0 shadow-sm border-start border-primary border-5">
                    <h6 class="text-muted mb-1 text-uppercase small fw-bold">Total de Atividades</h6>
                    <h3 class="fw-bold mb-0"><?php echo $logCount; ?></h3>
                    <p class="text-muted x-small mt-2">Registros de auditoria</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card p-3 h-100 border-0 shadow-sm border-start border-info border-5">
                    <h6 class="text-muted mb-1 text-uppercase small fw-bold">Modo Manutenção</h6>
                    <h3 class="fw-bold mb-0"><?php echo $isMaintenance ? 'Ativo' : 'Desligado'; ?></h3>
                    <p class="text-muted x-small mt-2">Estado global do app</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card p-3 h-100 border-0 shadow-sm border-start border-warning border-5">
                    <h6 class="text-muted mb-1 text-uppercase small fw-bold">Último Acesso</h6>
                    <h3 class="fw-bold mb-0" style="font-size: 1.2rem;">
                        <?php echo date('H:i:s', strtotime($lastLog)); ?>
                    </h3>
                    <p class="text-muted x-small mt-2"><?php echo date('d/m/Y', strtotime($lastLog)); ?></p>
                </div>
            </div>
        </div>

        <!-- Auditoria e Manutenção -->
        <div class="row g-4">
            <div class="col-lg-8">
                <div class="card p-4 border-0 shadow-sm h-100">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="fw-bold mb-0">Logs de Auditoria Recentes</h5>
                        <!-- Item 3: Filtros de Auditoria -->
                        <form class="d-flex gap-2" method="GET">
                            <input type="text" name="ip" class="form-control form-control-sm"
                                placeholder="Filtrar IP..." value="<?php echo htmlspecialchars($_GET['ip'] ?? ''); ?>">
                            <select name="action" class="form-select form-select-sm">
                                <option value="">Todas Ações</option>
                                <option value="LOGIN">Logins</option>
                                <option value="LOGIN_FAIL">Falhas</option>
                                <option value="API_ERROR">Erros API</option>
                                <option value="ADD_GLEBA">Glebas</option>
                            </select>
                            <button class="btn btn-primary btn-sm"><i class="bi bi-filter"></i></button>
                        </form>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle small">
                            <thead class="table-light">
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>IP</th>
                                    <th>Ação</th>
                                    <th>Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $ipFilter = $_GET['ip'] ?? '';
                                $actionFilter = $_GET['action'] ?? '';

                                $sql = "SELECT created_at, ip_address, action, details FROM cgrn_audit_logs WHERE 1=1";
                                $params = [];

                                if ($ipFilter) {
                                    $sql .= " AND ip_address = ?";
                                    $params[] = $ipFilter;
                                }
                                if ($actionFilter) {
                                    $sql .= " AND action = ?";
                                    $params[] = $actionFilter;
                                }

                                $sql .= " ORDER BY created_at DESC LIMIT 15";
                                $stmt = $conn->prepare($sql);
                                $stmt->execute($params);

                                while ($row = $stmt->fetch()):
                                    ?>
                                    <tr>
                                        <td class="text-nowrap">
                                            <?php echo date('d/m H:i', strtotime($row['created_at'])); ?>
                                        </td>
                                        <td><code class="text-primary"><?php echo $row['ip_address']; ?></code></td>
                                        <td>
                                            <?php
                                            $badge = match ($row['action']) {
                                                'LOGIN' => 'success',
                                                'LOGIN_FAIL' => 'danger',
                                                'API_ERROR' => 'warning',
                                                default => 'secondary'
                                            };
                                            ?>
                                            <span
                                                class="badge bg-<?php echo $badge; ?>"><?php echo $row['action']; ?></span>
                                        </td>
                                        <td class="text-muted"
                                            style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                            <?php echo htmlspecialchars($row['details']); ?>
                                        </td>
                                    </tr>
                                <?php endwhile; ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="text-center mt-3">
                        <a href="reports.php" class="btn btn-link btn-sm text-decoration-none">Ver relatório completo <i
                                class="bi bi-chevron-right"></i></a>
                    </div>
                </div>
            </div>

            <div class="col-lg-4">
                <!-- Item 7: Manutenção Automática -->
                <div class="card p-4 border-0 shadow-sm bg-dark text-white mb-4">
                    <h5 class="fw-bold mb-3"><i class="bi bi-tools text-warning me-2"></i>Manutenção</h5>
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-light btn-sm text-start py-2" onclick="runTask('clean_logs')">
                            <i class="bi bi-trash3 me-2"></i> Limpar Logs (> 90 dias)
                        </button>
                        <button class="btn btn-outline-light btn-sm text-start py-2" onclick="runTask('clear_cache')">
                            <i class="bi bi-lightning-charge me-2 text-warning"></i> Zerar Cache de Consultas
                        </button>
                    </div>
                </div>

                <div class="card p-4 border-0 shadow-sm">
                    <h5 class="fw-bold mb-3">Links de Gestão</h5>
                    <div class="list-group list-group-flush small">
                        <a href="layers.php" class="list-group-item list-group-item-action px-0"><i
                                class="bi bi-layers me-2 text-primary"></i> Camadas Personalizadas</a>
                        <a href="settings.php" class="list-group-item list-group-item-action px-0"><i
                                class="bi bi-shield-check me-2 text-success"></i> Segurança e SEO</a>
                        <a href="proxy.php" class="list-group-item list-group-item-action px-0"><i
                                class="bi bi-hdd-network me-2 text-info"></i> Proxy Whitelist</a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        async function runTask(task) {
            if (!confirm('Deseja realmente executar esta tarefa de manutenção?')) return;
            try {
                const formData = new FormData();
                formData.append('task', task);
                formData.append('csrf_token', '<?php echo Security::getCSRFToken(); ?>');

                const response = await fetch('maintenance_actions.php', {
                    method: 'POST',
                    body: formData
                });
                const res = await response.json();
                alert(res.message);
                if (res.status === 'success') location.reload();
            } catch (e) { alert('Erro ao executar tarefa.'); }
        }
    </script>
</body>

</html>


<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>