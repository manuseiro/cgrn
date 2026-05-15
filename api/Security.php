<?php
/**
 * @file Security.php
 * @description Classe utilitária para hardening de segurança (Sessões, CSRF, Sanitização).
 */

class Security {
    
    /**
     * Configura a sessão com parâmetros seguros (A1, A5)
     */
    public static function initSession() {
        if (session_status() === PHP_SESSION_NONE) {
            // Solução para erro de permissão no WAMP (Permission Denied no tmp)
            $sessionPath = __DIR__ . '/sessions';
            if (!is_dir($sessionPath)) {
                @mkdir($sessionPath, 0777, true);
            }
            if (is_writable($sessionPath)) {
                session_save_path($sessionPath);
            }

            // A1: Configura cookies HttpOnly, Secure e SameSite
            $isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
            session_set_cookie_params([
                'lifetime' => 3600, // 1 hora
                'path' => '/',
                'domain' => '', 
                'secure' => $isHttps, 
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }

        // A5: Timeout de inatividade (15 minutos)
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > 900)) {
            session_unset();
            session_destroy();
            header('Location: index.php?error=timeout');
            exit;
        }
        $_SESSION['last_activity'] = time();
    }

    /**
     * Gera ou recupera um token CSRF (C2)
     */
    public static function getCSRFToken() {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Verifica se o IP está na blacklist e se o sistema está em manutenção programada
     */
    public static function checkAccess() {
        $ip = $_SERVER['REMOTE_ADDR'];
        $db = Database::getInstance()->getConnection();

        // 1. Verifica Blacklist
        $stmt = $db->prepare("SELECT id FROM cgrn_ip_blacklist WHERE ip_address = ?");
        $stmt->execute([$ip]);
        if ($stmt->fetch()) {
            header('HTTP/1.1 403 Forbidden');
            die("
            <!DOCTYPE html>
            <html lang='pt-BR'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Acesso Bloqueado | Firewall GlebasNord</title>
                <link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css'>
                <link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'>
                <style>
                    body { background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
                    .block-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 3rem; max-width: 500px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                    .icon-box { width: 80px; height: 80px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 2rem; }
                    .ip-badge { background: rgba(255, 255, 255, 0.05); padding: 0.5rem 1rem; border-radius: 10px; font-family: monospace; color: #94a3b8; font-size: 0.9rem; }
                    h1 { font-weight: 800; letter-spacing: -0.025em; margin-bottom: 1rem; }
                    p { color: #94a3b8; line-height: 1.6; }
                </style>
            </head>
            <body>
                <div class='block-card shadow-lg'>
                    <div class='icon-box'><i class='bi bi-shield-slash-fill'></i></div>
                    <h1>Acesso Restrito</h1>
                    <p>Seu endereço de rede foi bloqueado preventivamente pelo nosso Firewall por apresentar comportamento suspeito ou múltiplas falhas de acesso.</p>
                    <div class='mt-4'>
                        <span class='ip-badge'>IP: $ip</span>
                    </div>
                    <div class='mt-5 small text-muted border-top border-secondary border-opacity-25 pt-4'>
                        <i class='bi bi-info-circle me-1'></i> Se você acredita que isso é um erro, contate o administrador do sistema.
                    </div>
                </div>
            </body>
            </html>
            ");
        }

        // 2. Verifica Manutenção Programada
        $settings = Database::getInstance()->getSettings();
        $start = $settings['MAINTENANCE_SCHEDULE_START'] ?? '';
        $end = $settings['MAINTENANCE_SCHEDULE_END'] ?? '';
        $now = date('Y-m-d H:i');

        if (!empty($start) && !empty($end)) {
            if ($now >= $start && $now <= $end) {
                // Se não for admin logado, bloqueia
                if (session_status() === PHP_SESSION_NONE) session_start();
                if (!isset($_SESSION['admin_id'])) {
                    http_response_code(503);
                    $msg = $settings['SITE_MAINTENANCE_MSG'] ?? 'Sistema em manutenção programada.';
                    die("
                    <!DOCTYPE html>
                    <html lang='pt-BR'>
                    <head>
                        <meta charset='UTF-8'>
                        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                        <title>Manutenção | GlebasNord</title>
                        <link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css'>
                        <link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'>
                        <style>
                            body { background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
                            .maint-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 3rem; max-width: 500px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                            .icon-box { width: 80px; height: 80px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 2rem; }
                            .date-badge { background: rgba(245, 158, 11, 0.1); padding: 0.5rem 1rem; border-radius: 10px; color: #f59e0b; font-weight: 600; font-size: 0.9rem; }
                            h1 { font-weight: 800; letter-spacing: -0.025em; margin-bottom: 1rem; }
                            p { color: #94a3b8; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class='maint-card shadow-lg'>
                            <div class='icon-box'><i class='bi bi-tools'></i></div>
                            <h1>Manutenção</h1>
                            <p>$msg</p>
                            <div class='mt-4'>
                                <span class='small text-uppercase text-muted d-block mb-2'>Previsão de Retorno</span>
                                <span class='date-badge'><i class='bi bi-clock-history me-2'></i>$end</span>
                            </div>
                            <div class='mt-5 small text-muted border-top border-secondary border-opacity-25 pt-4'>
                                <i class='bi bi-envelope me-1'></i> Suporte: contato@glebasnord.com.br
                            </div>
                        </div>
                    </body>
                    </html>
                    ");
                }
            }
        }
    }

    /**
     * Valida o token CSRF (C2)
     */
    public static function validateCSRF($token) {
        if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$token)) {
            http_response_code(403);
            throw new Exception("Erro de Validação CSRF: Requisição bloqueada por segurança.");
        }
        return true;
    }

    /**
     * Regenera ID de sessão para prevenir Session Fixation (C3)
     */
    public static function secureSessionId() {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    /**
     * Valida se um IP é privado/local (A4 - Prevenção SSRF)
     */
    public static function isPrivateIP($ip) {
        return !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}
