<?php
/**
 * @file migrate_v373.php
 * @description Atualiza o esquema do banco de dados para a v3.7.3.
 */
require_once __DIR__ . '/../api/Database.php';
require_once __DIR__ . '/../api/Security.php';

Security::initSession();

// Verificação de Acesso (v3.7.3)
$isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']);
$isForced = (isset($_GET['force']) && $_GET['force'] === 'v373');

if (!isset($_SESSION['admin_id']) && !$isLocal && !$isForced) {
    die("Acesso negado. Por segurança, este script só pode ser rodado via localhost ou por um admin logado. 
         <br><br>Dica: Para rodar em produção pela primeira vez, use: <b>migrate_v373.php?force=v373</b>");
}

try {
    $db = Database::getInstance()->getConnection();
    
    echo "<h2>Iniciando Migração v3.7.3...</h2>";

    // 0. Compatibilidade Retroativa (cgrn_users -> cgrn_admins)
    $tables = $db->query("SHOW TABLES LIKE 'cgrn_users'")->fetch();
    if ($tables) {
        $db->exec("RENAME TABLE cgrn_users TO cgrn_admins");
        echo "✅ Tabela 'cgrn_users' renomeada para 'cgrn_admins'.<br>";
    }

    // 0.1 Compatibilidade de Coluna (password_hash -> password)
    $checkPass = $db->query("SHOW COLUMNS FROM cgrn_admins LIKE 'password_hash'")->fetch();
    if ($checkPass) {
        $db->exec("ALTER TABLE cgrn_admins CHANGE password_hash password VARCHAR(255) NOT NULL");
        echo "✅ Coluna 'password_hash' renomeada para 'password'.<br>";
    }

    // 1. Adicionar Role em Admins
    $checkRole = $db->query("SHOW COLUMNS FROM cgrn_admins LIKE 'role'")->fetch();
    if (!$checkRole) {
        $db->exec("ALTER TABLE cgrn_admins ADD COLUMN role VARCHAR(20) DEFAULT 'analista' AFTER password");
        echo "✅ Coluna 'role' adicionada em cgrn_admins.<br>";
    }

    // 1.1 Adicionar Nome Completo
    $checkName = $db->query("SHOW COLUMNS FROM cgrn_admins LIKE 'full_name'")->fetch();
    if (!$checkName) {
        $db->exec("ALTER TABLE cgrn_admins ADD COLUMN full_name VARCHAR(100) AFTER username");
        echo "✅ Coluna 'full_name' adicionada em cgrn_admins.<br>";
    }

    // Força o primeiro usuário a ser SuperAdmin SEMPRE (Garantia v3.7.3)
    $db->exec("UPDATE cgrn_admins SET role = 'superadmin' ORDER BY id ASC LIMIT 1");
    echo "👑 Primeiro usuário do banco promovido a SuperAdmin.<br>";

    // Se você estiver logado no momento da migração, atualiza sua sessão também
    if (isset($_SESSION['admin_id'])) {
        $_SESSION['admin_role'] = 'superadmin';
        echo "✨ Sua sessão atual foi elevada para SuperAdmin!<br>";
    }

    // 1.1 Garantir que exista ao menos 1 usuário (se a tabela estiver vazia)
    $count = $db->query("SELECT COUNT(*) FROM cgrn_admins")->fetchColumn();
    if ($count == 0) {
        $user = 'admin';
        $pass = password_hash('admin123', PASSWORD_DEFAULT);
        $db->exec("INSERT INTO cgrn_admins (username, password, role) VALUES ('$user', '$pass', 'superadmin')");
        echo "🎁 Nenhum admin encontrado. Criado usuário padrão: <b>admin</b> / <b>admin123</b> (Mude após o login!)<br>";
    }

    // 2. Criar Tabela de Blacklist
    $db->exec("CREATE TABLE IF NOT EXISTS cgrn_ip_blacklist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) UNIQUE NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "✅ Tabela 'cgrn_ip_blacklist' verificada/criada.<br>";

    // 3. Adicionar Configurações de Agendamento
    $settings = [
        ['MAINTENANCE_SCHEDULE_START', '', 'app', 'Horário de início da manutenção (YYYY-MM-DD HH:MM)'],
        ['MAINTENANCE_SCHEDULE_END', '', 'app', 'Horário de término da manutenção (YYYY-MM-DD HH:MM)']
    ];

    $stmt = $db->prepare("INSERT INTO cgrn_settings (setting_key, setting_value, setting_group, description) 
                          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description)");
    
    foreach ($settings as $s) {
        $stmt->execute($s);
    }
    echo "✅ Configurações de agendamento adicionadas.<br>";

    echo "<br><div style='color:green; font-weight:bold;'>Migração concluída com sucesso!</div>";
    echo "<br><a href='dashboard.php'>Voltar ao Painel</a>";

} catch (Exception $e) {
    die("<div style='color:red;'>Erro na migração: " . $e->getMessage() . "</div>");
}
