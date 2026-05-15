<?php
/**
 * @file auth.php
 * @description Processa o login do administrador comparando com o banco de dados.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

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
    
    // Busca o usuário no banco (Padronizado para cgrn_admins v3.7.3)
    $stmt = $conn->prepare("SELECT id, username, full_name, password, role FROM cgrn_admins WHERE username = ? LIMIT 1");
    $stmt->execute([$user]);
    $admin = $stmt->fetch();

    // Verifica a senha
    if ($admin && password_verify($pass, $admin['password'])) {
        // Sucesso: limpa falhas se houver e inicia sessão
        Security::secureSessionId();
        
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_user'] = $admin['username'];
        $_SESSION['admin_name'] = $admin['full_name'] ?? $admin['username'];
        $_SESSION['admin_role'] = $admin['role'] ?? 'analista'; 
        $_SESSION['last_activity'] = time();

        header('Location: dashboard.php');
        exit;
    } else {
        // FALHA DE LOGIN: Log de Auditoria
        $logFail = $conn->prepare("INSERT INTO cgrn_audit_logs (action, details, ip_address) VALUES ('LOGIN_FAIL', ?, ?)");
        $logFail->execute(["Tentativa falha para usuário: $user", $ip]);

        // Proteção contra Força Bruta: Incrementa contador
        if (!isset($_SESSION['login_attempts'])) {
            $_SESSION['login_attempts'] = 0;
        }
        $_SESSION['login_attempts']++;

        // Se exceder 5 tentativas, banir o IP no firewall automaticamente
        if ($_SESSION['login_attempts'] >= 5) {
            $stmt = $conn->prepare("INSERT IGNORE INTO cgrn_ip_blacklist (ip_address, reason) VALUES (?, 'Múltiplas falhas de login (Auto-Ban v3.7.3)')");
            $stmt->execute([$ip]);
            
            session_destroy();
            die("Múltiplas tentativas falhas. Seu IP foi bloqueado pelo Firewall GlebasNord. Contate o administrador.");
        }

        header('Location: index.php?error=invalid&attempts=' . $_SESSION['login_attempts']);
        exit;
    }

} catch (Exception $e) {
    error_log("Erro de Autenticação: " . $e->getMessage());
    header('Location: index.php?error=db');
    exit;
}
