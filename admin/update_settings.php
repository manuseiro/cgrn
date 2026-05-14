<?php
/**
 * @file update_settings.php
 * @description Processa a atualização em massa das configurações.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['settings'])) {
    header('Location: settings.php');
    exit;
}

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    $conn->beginTransaction();

    $stmt = $conn->prepare("UPDATE cgrn_settings SET setting_value = ? WHERE setting_key = ?");
    
    $changes = [];
    foreach ($_POST['settings'] as $key => $value) {
        $stmt->execute([$value, $key]);
        if ($stmt->rowCount() > 0) {
            $changes[] = "$key: $value";
        }
    }

    if (!empty($changes)) {
        $logDetails = "Alterou configurações: " . implode(', ', $changes);
        $logStmt = $conn->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'UPDATE_SETTINGS', ?, ?)");
        $logStmt->execute([$_SESSION['admin_id'], $logDetails, $_SERVER['REMOTE_ADDR']]);
    }

    $conn->commit();
    header('Location: settings.php?success=1');
    exit;

} catch (Exception $e) {
    if (isset($conn)) $conn->rollBack();
    error_log("Erro ao atualizar configurações: " . $e->getMessage());
    header('Location: settings.php?error=db');
    exit;
}
