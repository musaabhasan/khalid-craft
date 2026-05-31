<?php

declare(strict_types=1);

namespace App;

use PDO;
use RuntimeException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = kc_config();
        if (empty($config['installed']) || empty($config['database'])) {
            throw new RuntimeException('Khalid Craft is not connected to MySQL yet.');
        }

        $db = $config['database'];
        $charset = $db['charset'] ?? 'utf8mb4';
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            (int) ($db['port'] ?? 3306),
            $db['name'],
            $charset
        );

        self::$pdo = new PDO($dsn, (string) $db['user'], (string) $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return self::$pdo;
    }
}
