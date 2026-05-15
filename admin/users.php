<?php
/**
 * @file users.php
 * @description Gestão de contas administrativas e níveis de acesso.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

// Apenas SuperAdmins podem gerenciar outros usuários
if (!isset($_SESSION['admin_id']) || ($_SESSION['admin_role'] ?? 'analista') !== 'superadmin') {
    die("Acesso restrito a SuperAdministradores.");
}

$db = Database::getInstance()->getConnection();

// Processa Ações
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    Security::validateCSRF($_POST['csrf_token'] ?? '');
    $action = $_POST['action'] ?? '';

    if ($action === 'add') {
        $user = trim($_POST['username']);
        $full_name = trim($_POST['full_name'] ?? '');
        $pass = password_hash($_POST['password'], PASSWORD_DEFAULT);
        $role = $_POST['role'];
        $stmt = $db->prepare("INSERT INTO cgrn_admins (username, full_name, password, role) VALUES (?, ?, ?, ?)");
        $stmt->execute([$user, $full_name, $pass, $role]);
    } elseif ($action === 'delete') {
        $id = (int) $_POST['id'];
        if ($id !== (int) $_SESSION['admin_id']) { // Não deleta a si mesmo
            $stmt = $db->prepare("DELETE FROM cgrn_admins WHERE id = ?");
            $stmt->execute([$id]);
        }
    } elseif ($action === 'update_password') {
        $id = (int) $_POST['id'];
        $new_pass = password_hash($_POST['new_password'], PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE cgrn_admins SET password = ? WHERE id = ?");
        $stmt->execute([$new_pass, $id]);
        $success_msg = "Senha atualizada com sucesso!";
    }
}

$users = $db->query("SELECT id, username, full_name, role, created_at FROM cgrn_admins ORDER BY username ASC")->fetchAll();
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <title>Usuários Admin | GlebasNord Admin</title>
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
                <h2 class="fw-bold mb-1">Gerenciador de Usuários</h2>
                <p class="text-muted small">Controle quem pode acessar e configurar o sistema.</p>
            </div>
        </div>

        <?php if (isset($success_msg)): ?>
            <div class="alert alert-success border-0 shadow-sm mb-4">
                <i class="bi bi-check-circle-fill me-2"></i><?php echo $success_msg; ?>
            </div>
        <?php endif; ?>

        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Novo Administrador</h5>
                    <form method="POST">
                        <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                        <input type="hidden" name="action" value="add">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Nome Completo</label>
                            <input type="text" name="full_name" class="form-control" placeholder="Ex: João Silva"
                                required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Usuário (Login)</label>
                            <input type="text" name="username" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Senha</label>
                            <input type="password" name="password" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Nível de Acesso</label>
                            <select name="role" class="form-select">
                                <option value="analista">Analista (Apenas Relatórios)</option>
                                <option value="superadmin">SuperAdmin (Acesso Total)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 fw-bold">Criar Conta</button>
                    </form>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card p-4 shadow-sm">
                    <h5 class="fw-bold mb-4">Administradores Cadastrados</h5>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle small">
                            <thead>
                                <tr>
                                    <th>Nome / Usuário</th>
                                    <th>Papel</th>
                                    <th>Data de Criação</th>
                                    <th class="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($users as $u): ?>
                                    <tr>
                                        <td>
                                            <div class="fw-bold"><i
                                                    class="bi bi-person-circle me-2 text-primary"></i><?php echo htmlspecialchars($u['full_name'] ?: $u['username']); ?>
                                            </div>
                                            <div class="x-small text-muted ps-4">
                                                <?php echo htmlspecialchars($u['username']); ?>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                class="badge bg-<?php echo ($u['role'] === 'superadmin' ? 'dark' : 'info'); ?>">
                                                <?php echo strtoupper($u['role']); ?>
                                            </span>
                                        </td>
                                        <td class="text-muted"><?php echo date('d/m/Y', strtotime($u['created_at'])); ?>
                                        </td>
                                        <td class="text-end">
                                            <!-- Botão Trocar Senha -->
                                            <button type="button" class="btn btn-outline-warning btn-sm border-0 me-1" 
                                                    data-bs-toggle="modal" data-bs-target="#passModal<?php echo $u['id']; ?>" title="Trocar Senha">
                                                <i class="bi bi-key-fill"></i>
                                            </button>

                                            <?php if ($u['id'] !== (int) $_SESSION['admin_id']): ?>
                                                <form method="POST" class="d-inline"
                                                    onsubmit="return confirm('Excluir este usuário?')">
                                                    <input type="hidden" name="csrf_token"
                                                        value="<?php echo Security::getCSRFToken(); ?>">
                                                    <input type="hidden" name="action" value="delete">
                                                    <input type="hidden" name="id" value="<?php echo $u['id']; ?>">
                                                    <button type="submit" class="btn btn-outline-danger btn-sm border-0"><i
                                                            class="bi bi-trash"></i></button>
                                                </form>
                                            <?php else: ?>
                                                <span class="badge bg-light text-muted">Você</span>
                                            <?php endif; ?>

                                            <!-- Modal Trocar Senha -->
                                            <div class="modal fade" id="passModal<?php echo $u['id']; ?>" tabindex="-1" aria-hidden="true">
                                                <div class="modal-dialog modal-sm modal-dialog-centered">
                                                    <div class="modal-content border-0 shadow">
                                                        <form method="POST">
                                                            <div class="modal-header border-0 pb-0">
                                                                <h6 class="modal-title fw-bold">Nova Senha: <?php echo htmlspecialchars($u['username']); ?></h6>
                                                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                                            </div>
                                                            <div class="modal-body">
                                                                <input type="hidden" name="csrf_token" value="<?php echo Security::getCSRFToken(); ?>">
                                                                <input type="hidden" name="action" value="update_password">
                                                                <input type="hidden" name="id" value="<?php echo $u['id']; ?>">
                                                                <input type="password" name="new_password" class="form-control form-control-sm" placeholder="Digite a nova senha" required minlength="6">
                                                            </div>
                                                            <div class="modal-footer border-0 pt-0">
                                                                <button type="submit" class="btn btn-warning btn-sm w-100 fw-bold">Salvar Senha</button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            </div>
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