<?php
require_once __DIR__ . '/../api/Security.php';
Security::initSession();
// Se já estiver logado, vai direto para o dashboard
if (isset($_SESSION['admin_id'])) {
    header('Location: dashboard.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Administrativo | GlebasNord</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body { background-color: #f8f9fa; }
        .login-card { border-radius: 1rem; border: none; box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1); }
        .btn-primary { border-radius: 0.5rem; padding: 0.6rem; font-weight: 600; }
        .logo-box { width: 80px; height: 80px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; }
        .logo-box img { width: 100%; height: auto; }
    </style>
</head>
<body class="d-flex align-items-center vh-100">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-12 col-md-5 col-lg-4">
                <div class="card login-card p-4">
                    <div class="card-body">
                        <div class="logo-box">
                            <img src="../img/logo.png" alt="GlebasNord Logo">
                        </div>
                        <h4 class="text-center fw-bold mb-1">GlebasNord</h4>
                        <p class="text-center text-muted small mb-4">Painel Administrativo</p>

                        <?php if (isset($_GET['error'])): ?>
            <div class="alert alert-danger border-0 shadow-sm mb-4 small">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <?php 
                    if ($_GET['error'] === 'db') echo "Erro de conexão com o banco de dados.";
                    else if ($_GET['error'] === 'empty') echo "Preencha todos os campos.";
                    else {
                        echo "Usuário ou senha inválidos.";
                        if (isset($_GET['attempts'])) {
                            echo "<br><b>Tentativa: " . (int)$_GET['attempts'] . " de 5</b>.";
                            echo "<span class='d-block mt-1'>Cuidado: No 5º erro seu IP será bloqueado.</span>";
                        }
                    }
                ?>
            </div>
        <?php endif; ?>

                        <form action="auth.php" method="POST">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">USUÁRIO</label>
                                <input type="text" name="username" class="form-control form-control-lg fs-6" required autofocus>
                            </div>
                            <div class="mb-4">
                                <label class="form-label small fw-bold text-muted">SENHA</label>
                                <input type="password" name="password" class="form-control form-control-lg fs-6" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 shadow-sm">
                                <i class="bi bi-box-arrow-in-right me-2"></i>Entrar no Sistema
                            </button>
                        </form>
                    </div>
                </div>
                <div class="text-center mt-4">
                    <a href="../" class="text-decoration-none small text-muted">
                        <i class="bi bi-arrow-left me-1"></i>Voltar para o Aplicativo
                    </a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
