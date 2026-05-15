<?php
/**
 * @file api_header.php
 * @description Header padronizado para APIs com restrição de CORS e Segurança.
 */
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// C1: Restrição de CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';

// Permite se não houver origin (Same-Origin) ou se a origin contiver o host atual
$isSameOrigin = empty($origin) || (strpos($origin, $host) !== false);

if (!$isSameOrigin) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'CORS Policy: Origin not allowed.']);
    exit;
}

if ($origin) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}

