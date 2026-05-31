<?php

declare(strict_types=1);

define('KC_ROOT', dirname(__DIR__));

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = KC_ROOT . '/app/' . str_replace('\\', '/', $relative) . '.php';

    if (is_file($path)) {
        require $path;
    }
});

function kc_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $path = KC_ROOT . '/config/config.php';
    if (!is_file($path)) {
        $config = [
            'installed' => false,
            'app' => [
                'name' => 'Khalid Craft',
                'base_url' => '',
                'debug' => false,
            ],
            'database' => null,
        ];

        return $config;
    }

    $loaded = require $path;
    $config = array_replace_recursive([
        'installed' => true,
        'app' => [
            'name' => 'Khalid Craft',
            'base_url' => '',
            'debug' => false,
        ],
        'database' => [
            'host' => 'localhost',
            'port' => 3306,
            'name' => '',
            'user' => '',
            'password' => '',
            'charset' => 'utf8mb4',
        ],
    ], is_array($loaded) ? $loaded : []);

    return $config;
}

$secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name('KHALIDCRAFTSESSID');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function kc_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function kc_verify_csrf(): void
{
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $posted = $_POST['csrf_token'] ?? '';
    $token = is_string($header) && $header !== '' ? $header : $posted;

    if (!is_string($token) || !hash_equals(kc_csrf_token(), $token)) {
        \App\Response::json(['error' => 'Invalid session token. Refresh and try again.'], 419);
    }
}

function kc_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return $_POST ?: [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function kc_public_path(string $path = ''): string
{
    $base = rtrim((string) (kc_config()['app']['base_url'] ?? ''), '/');
    return $base . '/' . ltrim($path, '/');
}
