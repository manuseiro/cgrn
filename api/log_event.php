<?php
/**
 * @file log_event.php
 * @description Registra eventos de telemetria (análises, erros de API) no banco.
 */
require_once __DIR__ . '/Database.php';

require_once __DIR__ . '/api_header.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Apenas POST permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['action'])) {
    echo json_encode(['status' => 'error', 'message' => 'Dados inválidos']);
    exit;
}

try {
    $db = Database::getInstance()->getConnection();
    
    $action  = $data['action'];
    $details = $data['details'] ?? '';
    $lat     = isset($data['lat']) ? floatval($data['lat']) : null;
    $lon     = isset($data['lon']) ? floatval($data['lon']) : null;
    $status  = $data['status'] ?? null;
    $ip      = $_SERVER['REMOTE_ADDR'];

    $stmt = $db->prepare("INSERT INTO cgrn_audit_logs (action, details, lat, lon, api_status, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$action, $details, $lat, $lon, $status, $ip]);

    echo json_encode(['status' => 'success']);

} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
