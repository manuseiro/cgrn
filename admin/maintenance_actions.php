<?php
/**
 * @file maintenance_actions.php
 * @description Executa tarefas de limpeza e manutenção do banco de dados.
 */
session_start();
require_once __DIR__ . '/../api/Database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['admin_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Não autorizado']);
    exit;
}

$task = $_GET['task'] ?? '';
$db = Database::getInstance()->getConnection();

try {
    switch ($task) {
        case 'clean_logs':
            // Item 7: Limpar logs com mais de 90 dias
            $stmt = $db->prepare("DELETE FROM cgrn_audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
            $stmt->execute();
            $count = $stmt->rowCount();
            
            // Log da ação de limpeza
            $log = $db->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'MAINTENANCE', ?, ?)");
            $log->execute([$_SESSION['admin_id'], "Limpeza de logs executada: $count registros removidos.", $_SERVER['REMOTE_ADDR']]);
            
            echo json_encode(['status' => 'success', 'message' => "Sucesso! $count logs antigos foram removidos."]);
            break;

        case 'clear_cache':
            // Log da intenção de limpar cache (o cache real é via localStorage ou cookies no cliente)
            $log = $db->prepare("INSERT INTO cgrn_audit_logs (user_id, action, details, ip_address) VALUES (?, 'MAINTENANCE', 'Solicitação de limpeza de cache registrada.', ?)");
            $log->execute([$_SESSION['admin_id'], $_SERVER['REMOTE_ADDR']]);
            
            echo json_encode(['status' => 'success', 'message' => 'Tarefa de limpeza de cache registrada. Os clientes serão atualizados no próximo acesso.']);
            break;

        default:
            echo json_encode(['status' => 'error', 'message' => 'Tarefa desconhecida.']);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'Erro no banco: ' . $e->getMessage()]);
}
