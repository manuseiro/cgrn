<?php
/**
 * @file proxy.php
 * @description Proxy simples para contornar problemas de CORS com APIs governamentais.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Em produção, altere para seu domínio específico

$targetUrl = $_GET['url'] ?? null;

if (!$targetUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'URL de destino não especificada.']);
    exit;
}

// Lista de domínios permitidos (White-list por segurança)
$allowedDomains = [
    'manuseiro.github.io',
    'geoservices.icmbio.gov.br',
    'ibama.gov.br',
    'siscom.ibama.gov.br',
    'servicodados.ibge.gov.br',
    'terrabrasilis.dpi.inpe.br',
    'leosil21.github.io',
    'github.com',
    'car.gov.br',
    'geoserver.car.gov.br'
];

$parsedUrl = parse_url($targetUrl);
$host = $parsedUrl['host'] ?? '';

if (!in_array($host, $allowedDomains)) {
    http_response_code(403);
    echo json_encode(['error' => 'Domínio não autorizado pelo proxy.', 'host' => $host]);
    exit;
}

// Inicializa cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Importante para alguns certificados do governo
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GlebasNord/3.0');

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro na conexão com o serviço remoto.', 'details' => $error]);
} else {
    http_response_code($httpCode);
    echo $response;
}
