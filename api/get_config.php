<?php
/**
 * @file get_config.php
 * @description Serve as configurações do banco em formato JSON para o frontend.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 

try {
    require_once __DIR__ . '/Database.php';
    $db = Database::getInstance();
    $settings = $db->getSettings();
    
    // Tipagem básica: tenta converter strings numéricas para tipos reais
    foreach ($settings as $key => &$value) {
        if (is_numeric($value)) {
            if (strpos($value, '.') !== false) {
                $value = (float)$value;
            } else {
                $value = (int)$value;
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'data'   => $settings,
        'ts'     => time()
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Erro interno ao recuperar configurações.'
    ]);
}
