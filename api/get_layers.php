<?php
/**
 * @file get_layers.php
 * @description Retorna as camadas personalizadas ativas para o frontend.
 */
require_once __DIR__ . '/Database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $db = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT layer_name, layer_type, layer_url, layer_params FROM cgrn_custom_layers WHERE is_active = 1");
    $stmt->execute();
    $layers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'data' => $layers
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
