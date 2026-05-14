<?php
/**
 * @file auth.php
 * @description Processa o login do administrador comparando com o banco de dados.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$user = $_POST['username'] ?? '';
$pass = $_POST['password'] ?? '';

if (empty($user) || empty($pass)) {
    header('Location: index.php?error=empty');
    exit;
}

try {
    $conn = Database::getInstance()->getConnection();
    $ip = $_SERVER['REMOTE_ADDR'];

    // Item 5: Verificar proteção contra força bruta (5 falhas nos últimos 15 min)
    $stmtCheck = $conn->prepare("
        SELECT COUNT(*) FROM cgrn_audit_logs 
        WHERE ip_address = ? AND action = 'LOGIN_FAIL' 
        AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    ");
    $stmtCheck->execute([$ip]);
    if ($stmtCheck->fetchColumn() >= 5) {
        header('Location: index.php?error=blocked');
        exit;
    }
    
    // Busca o usuário no banco
    $stmt = $conn->prepare("SELECT id, username, password_hash FROM cgrn_users WHERE username = ? LIMIT 1");
    $stmt->execute([$user]);
    $admin = $stmt->fetch();

    // Verifica a senha
    if ($admin && password_verify($pass, $admin['password_hash'])) {
        // Sucesso: cria a sessão
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_user'] = $admin['username'];
        $_SESSION['last_activity'] = time();

        // Log de acesso
        $logStmt = $conn->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'LOGIN', 'Acesso bem sucedido', ?)");
        $logStmt->execute([$admin['id'], $ip]);

        header('Location: dashboard.php');
        exit;
    } else {
        // Item 5: Log de falha no login
        $logFail = $conn->prepare("INSERT INTO cgrn_audit_logs (action, details, ip_address) VALUES ('LOGIN_FAIL', ?, ?)");
        $logFail->execute(["Tentativa falha para usuário: $user", $ip]);

        header('Location: index.php?error=invalid');
        exit;
    }

} catch (Exception $e) {
    error_log("Erro de Autenticação: " . $e->getMessage());
    header('Location: index.php?error=db');
    exit;
}
