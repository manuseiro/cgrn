<?php
/**
 * @file logout.php
 * @description Encerra a sessão administrativa.
 */
require_once __DIR__ . '/../api/Security.php';
Security::initSession();

// Opcional: logar o logout antes de destruir a sessão
if (isset($_SESSION['admin_id'])) {
    try {
        require_once __DIR__ . '/../api/Database.php';
        $db = Database::getInstance()->getConnection();
        $logStmt = $db->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'LOGOUT', 'Saída do sistema', ?)");
        $logStmt->execute([$_SESSION['admin_id'], $_SERVER['REMOTE_ADDR']]);
    } catch (Exception $e) {
        // Ignora erro no log durante o logout
    }
}

session_unset();
session_destroy();

header('Location: index.php');
exit;
