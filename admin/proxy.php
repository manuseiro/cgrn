<?php
/**
 * @file proxy.php
 * @description Gestão da whitelist de domínios do Proxy CORS.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

$db = Database::getInstance();
$conn = $db->getConnection();

// Adicionar Domínio
if (isset($_POST['add_domain'])) {
    $domain = trim($_POST['domain']);
    if (!empty($domain)) {
        $stmt = $conn->prepare("INSERT INTO cgrn_allowed_domains (domain) VALUES (?)");
        $stmt->execute([$domain]);
        
        $logStmt = $conn->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'ADD_DOMAIN', ?, ?)");
        $logStmt->execute([$_SESSION['admin_id'], "Adicionou domínio: $domain", $_SERVER['REMOTE_ADDR']]);
    }
    header('Location: proxy.php?success=added');
    exit;
}

// Remover Domínio
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $conn->prepare("DELETE FROM cgrn_allowed_domains WHERE id = ?");
    $stmt->execute([$id]);
    
    $logStmt = $conn->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'DEL_DOMAIN', ?, ?)");
    $logStmt->execute([$_SESSION['admin_id'], "Removeu domínio ID: $id", $_SERVER['REMOTE_ADDR']]);
    
    header('Location: proxy.php?success=deleted');
    exit;
}

$domains = $db->getAllowedDomains();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Proxy Whitelist | GlebasNord Admin</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body { background-color: #f4f7f6; font-family: 'Inter', sans-serif; }
        .card { border-radius: 12px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    </style>
</head>
<body class="py-5">
    <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mb-1">
                        <li class="breadcrumb-item"><a href="dashboard.php">Dashboard</a></li>
                        <li class="breadcrumb-item active">Proxy Whitelist</li>
                    </ol>
                </nav>
                <h2 class="fw-bold mb-0">Gestão de Domínios do Proxy</h2>
            </div>
            <a href="dashboard.php" class="btn btn-outline-secondary">Voltar</a>
        </div>

        <div class="row g-4">
            <!-- Formulário de Adição -->
            <div class="col-md-4">
                <div class="card p-4">
                    <h5 class="fw-bold mb-3">Novo Domínio</h5>
                    <form method="POST">
                        <div class="mb-3">
                            <label class="form-label small text-muted">Domínio (ex: api.exemplo.com)</label>
                            <input type="text" name="domain" class="form-control" placeholder="dominio.com.br" required>
                        </div>
                        <button type="submit" name="add_domain" class="btn btn-primary w-100">Adicionar à Whitelist</button>
                    </form>
                    <div class="mt-4 p-3 bg-light rounded small text-muted">
                        <i class="bi bi-info-circle me-1 text-primary"></i> Domínios adicionados aqui serão permitidos através do <code>proxy.php</code>.
                    </div>
                </div>
            </div>

            <!-- Lista de Domínios -->
            <div class="col-md-8">
                <div class="card h-100">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light">
                                <tr>
                                    <th class="ps-4">ID</th>
                                    <th>Domínio</th>
                                    <th class="text-end pe-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php 
                                $stmt = $conn->query("SELECT * FROM cgrn_allowed_domains ORDER BY domain ASC");
                                while($row = $stmt->fetch()): 
                                ?>
                                <tr>
                                    <td class="ps-4 text-muted"><?php echo $row['id']; ?></td>
                                    <td><code class="text-primary"><?php echo htmlspecialchars($row['domain']); ?></code></td>
                                    <td class="text-end pe-4">
                                        <a href="?delete=<?php echo $row['id']; ?>" class="btn btn-sm btn-outline-danger" onclick="return confirm('Remover este domínio?')">
                                            <i class="bi bi-trash"></i>
                                        </a>
                                    </td>
                                </tr>
                                <?php endwhile; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
