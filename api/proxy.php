<?php
// Habilita compressão GZIP se o navegador suportar
if (extension_loaded('zlib') && !headers_sent()) {
    ob_start('ob_gzhandler');
}

/**
 * @file proxy.php
 * @description Proxy com Cache Inteligente (Stale-While-Revalidate) para contornar problemas de CORS e lentidão/quedas das APIs governamentais.
 */

// ── Detecção de ambiente (dev vs produção) ────────────────────────────────
// Não precisa alterar nada antes do deploy: é automático.
$isDev = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1', '::1']);

// CORS: aberto em dev, restrito ao domínio real em produção
$allowedOrigin = $isDev ? '*' : 'https://manuseiro.github.io';
header("Access-Control-Allow-Origin: $allowedOrigin");

$targetUrl = $_GET['url'] ?? null;

if (!$targetUrl) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'URL de destino não especificada.']);
    exit;
}

// Lista de domínios permitidos (White-list por segurança)
$allowedDomains = [
    'car.gov.br',
    'ibama.gov.br',
    'ibge.gov.br',
    'siscom.ibama.gov.br',
    'geoservicos.inde.gov.br',
    'geoservices.icmbio.gov.br',
    'geoservicos.inde.gov.br',
    'geoserver.car.gov.br',
    'geoserver.funai.gov.br',
    'geoservicos.ibge.gov.br',
    'servicodados.ibge.gov.br',
    'terrabrasilis.dpi.inpe.br',
    'manuseiro.github.io',
];

$parsedUrl = parse_url($targetUrl);
$host = $parsedUrl['host'] ?? '';

if (!in_array($host, $allowedDomains)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Domínio não autorizado pelo proxy.', 'host' => $host]);
    exit;
}

// Configurações de Cache
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// Usamos MD5 da URL inteira para gerar um nome de arquivo seguro
$cacheFile = $cacheDir . '/' . md5($targetUrl) . '.json';
$cacheTTL = 3600; // 1 hora de validade (em segundos) - Altere conforme a necessidade

$cacheExists = file_exists($cacheFile);
$cacheAge = $cacheExists ? (time() - filemtime($cacheFile)) : 9999999;
$isCacheValid = $cacheExists && ($cacheAge < $cacheTTL);

// Se o cache é válido, retorna imediatamente (Rápido e não bate no governo)
if ($isCacheValid) {
    header('Content-Type: application/json');
    header('X-Proxy-Cache: HIT');
    echo file_get_contents($cacheFile);
    exit;
}

// Inicializa cURL para buscar dados frescos
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
// SSL: desativado em dev (WAMP não tem bundle de CA), verificado em produção
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, !$isDev);
if (!$isDev) {
    // Caminho padrão do bundle de CA em servidores Linux (Debian/Ubuntu/CentOS)
    $caBundle = '/etc/ssl/certs/ca-certificates.crt';
    if (file_exists($caBundle)) {
        curl_setopt($ch, CURLOPT_CAINFO, $caBundle);
    }
}
curl_setopt($ch, CURLOPT_TIMEOUT, 15); // Timeout rápido
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GlebasNord/3.0');

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

curl_close($ch);

// Repassa o Content-Type original (geralmente application/json ou text/xml)
if ($contentType) {
    header("Content-Type: $contentType");
} else {
    header('Content-Type: application/json');
}

$isSuccess = !$error && $httpCode >= 200 && $httpCode < 300;
// Segurança: Evita fazer cache de páginas de erro HTML "maquiadas" com HTTP 200
$isDataFormat = strpos(strtolower($contentType), 'json') !== false || strpos(strtolower($contentType), 'xml') !== false;

if ($isSuccess && $isDataFormat) {
    // Sucesso na requisição E formato válido: Salva a resposta no cache e a retorna
    file_put_contents($cacheFile, $response);
    header('X-Proxy-Cache: MISS_AND_SAVED');
    http_response_code($httpCode);
    echo $response;

} else {
    // Erro (Timeout, 500, 404, etc) OU o serviço retornou um HTML em vez de JSON...
    if ($cacheExists) {
        header('X-Proxy-Cache: STALE_FALLBACK'); // Avisa que é um dado expirado salvo no sufoco
        header('X-Proxy-Error-Msg: ' . ($error ?: "HTTP $httpCode ou formato invalido ($contentType)"));
        http_response_code(200);
        echo file_get_contents($cacheFile);
    } else {
        // Falhou e não temos cache velho.
        header('X-Proxy-Cache: ERROR_NO_CACHE');
        http_response_code($httpCode ?: 500);
        // Se a API original mandou um erro em JSON, repassa. Se mandou HTML, mandamos nosso JSON.
        if ($isDataFormat) {
            echo $response;
        } else {
            echo json_encode([
                'error' => 'Serviço remoto indisponível ou retornou formato inválido.',
                'details' => $error ?: "Serviço retornou código HTTP $httpCode com Content-Type: $contentType"
            ]);
        }
    }
}
