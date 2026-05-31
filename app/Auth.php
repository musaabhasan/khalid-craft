<?php

declare(strict_types=1);

namespace App;

use PDO;

final class Auth
{
    public static function user(): ?array
    {
        return $_SESSION['user'] ?? null;
    }

    public static function requireUser(): array
    {
        $user = self::user();
        if (!$user) {
            Response::json(['error' => 'Login required.'], 401);
        }

        return $user;
    }

    public static function register(string $username, string $email, string $password): array
    {
        $username = self::cleanUsername($username);
        $email = trim($email);

        if ($username === '') {
            Response::json(['error' => 'Use 3 to 24 letters, numbers, spaces, dashes, or underscores.'], 422);
        }

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::json(['error' => 'Use a valid email address or leave it blank.'], 422);
        }

        if (strlen($password) < 8) {
            Response::json(['error' => 'Password must be at least 8 characters.'], 422);
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username OR (email IS NOT NULL AND email = :email) LIMIT 1');
        $stmt->execute([
            ':username' => $username,
            ':email' => $email !== '' ? $email : null,
        ]);

        if ($stmt->fetch()) {
            Response::json(['error' => 'That username or email is already in use.'], 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (:username, :email, :password_hash, NOW(), NOW())'
        );
        $stmt->execute([
            ':username' => $username,
            ':email' => $email !== '' ? $email : null,
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        $user = [
            'id' => (int) $pdo->lastInsertId(),
            'username' => $username,
            'email' => $email !== '' ? $email : null,
        ];

        self::setUser($user);
        return $user;
    }

    public static function login(string $usernameOrEmail, string $password): array
    {
        $login = trim($usernameOrEmail);
        $pdo = Database::connection();

        $stmt = $pdo->prepare('SELECT id, username, email, password_hash FROM users WHERE username = :login OR email = :login LIMIT 1');
        $stmt->execute([':login' => $login]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row || !password_verify($password, (string) $row['password_hash'])) {
            Response::json(['error' => 'Invalid username or password.'], 401);
        }

        $user = [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
            'email' => $row['email'] !== null ? (string) $row['email'] : null,
        ];

        self::setUser($user);
        return $user;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
        }
        session_destroy();
    }

    private static function setUser(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        kc_csrf_token();
    }

    private static function cleanUsername(string $username): string
    {
        $username = preg_replace('/\s+/', ' ', trim($username)) ?? '';
        if (!preg_match('/^[A-Za-z0-9 _-]{3,24}$/', $username)) {
            return '';
        }

        return $username;
    }
}
