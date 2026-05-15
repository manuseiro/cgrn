<?php
/**
 * @file Database.php
 * @description Singleton para conexão PDO compatível com MySQL e PostgreSQL.
 */

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        $configPath = __DIR__ . '/.env.php';
        if (!file_exists($configPath)) {
            throw new Exception("Arquivo de configuração .env.php não encontrado em api/");
        }
        
        $config = require $configPath;
        
        try {
            if ($config['DB_DRIVER'] === 'mysql') {
                $dsn = "mysql:host={$config['DB_HOST']};port={$config['DB_PORT']};dbname={$config['DB_NAME']};charset=utf8mb4";
            } elseif ($config['DB_DRIVER'] === 'pgsql') {
                $dsn = "pgsql:host={$config['DB_HOST']};port={$config['DB_PORT']};dbname={$config['DB_NAME']}";
            } else {
                throw new Exception("Driver de banco de dados não suportado: " . $config['DB_DRIVER']);
            }

            $this->pdo = new PDO($dsn, $config['DB_USER'], $config['DB_PASS'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            
        } catch (PDOException $e) {
            error_log("Erro de Conexão DB: " . $e->getMessage());
            throw new Exception("Falha na conexão com o banco de dados: " . $e->getMessage());
        }
    }

    /**
     * Retorna a instância única da conexão (Singleton)
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    /**
     * Retorna o objeto PDO nativo para queries customizadas
     */
    public function getConnection() {
        return $this->pdo;
    }

    /**
     * Helper: Busca todas as configurações e retorna um array [chave => valor]
     */
    public function getSettings() {
        $stmt = $this->pdo->query("SELECT setting_key, setting_value FROM cgrn_settings");
        return $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    /**
     * Helper: Busca domínios permitidos para o proxy
     */
    public function getAllowedDomains() {
        $stmt = $this->pdo->query("SELECT domain FROM cgrn_allowed_domains WHERE is_active = 1");
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}
