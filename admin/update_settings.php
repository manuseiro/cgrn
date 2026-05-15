<?php
/**
 * @file update_settings.php
 * @description Processa a atualização em massa das configurações.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}

// C2: Validação CSRF
try {
    Security::validateCSRF($_POST['csrf_token'] ?? '');
} catch (Exception $e) {
    error_log("Falha CSRF no Admin: " . $e->getMessage());
    header('Location: settings.php?error=csrf');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['settings'])) {
    header('Location: settings.php');
    exit;
}

// A2: Whitelist de chaves permitidas para evitar Mass Assignment
$whitelist = [
    'SITE_THEME', 'SITE_MAINTENANCE_MSG', 'MAINTENANCE_MODE', 
    'GLOBAL_BANNER_SHOW', 'GLOBAL_BANNER_MSG',
    'SEO_TITLE', 'SEO_DESCRIPTION', 'SEO_KEYWORDS', 'SEO_ANALYTICS_ID',
    'MAP_TILE_URL', 'MAP_TILE_ATTR', 'MAP_CENTER_LAT', 'MAP_CENTER_LNG', 'MAP_ZOOM_DEFAULT',
    'GLEBA_COLOR_OK', 'GLEBA_OPACITY_OK', 'GLEBA_COLOR_REJECT', 'GLEBA_OPACITY_REJECT', 
    'GLEBA_COLOR_WARN', 'GLEBA_OPACITY_WARN',
    'AREA_MIN_HA', 'AREA_MAX_HA', 'MAX_MUNICIPIOS', 'COORD_PRECISION', 'API_TIMEOUT_MS',
    'MAX_UPLOAD_CSV_MB', 'MAX_UPLOAD_KML_MB', 'MAX_UPLOAD_ZIP_MB', 'PROXY_URL',
    'APP_VERSION', 'CACHE_TTL_CAR',
    'STATE_COLOR_AL', 'STATE_COLOR_BA', 'STATE_COLOR_CE', 'STATE_COLOR_MA', 
    'STATE_COLOR_PB', 'STATE_COLOR_PE', 'STATE_COLOR_PI', 'STATE_COLOR_RN', 'STATE_COLOR_SE'
];

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();

    $conn->beginTransaction();

    $stmt = $conn->prepare("UPDATE cgrn_settings SET setting_value = ? WHERE setting_key = ?");

    $changes = [];
    foreach ($_POST['settings'] as $key => $value) {
        if (!in_array($key, $whitelist)) {
            error_log("Configuração ignorada (não está na whitelist): $key");
            continue;
        }
        
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
    error_log("Erro Crítico no Admin: " . $e->getMessage());
    header('Location: settings.php?error=db');
    exit;
}
