<?php

declare(strict_types=1);

require __DIR__ . '/../app/bootstrap.php';

use App\Auth;
use App\Response;
use App\WorldRepository;

$user = Auth::requireUser();
$worldId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($worldId <= 0) {
    Response::json(['error' => 'World id is required.'], 422);
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $world = WorldRepository::getForUser((int) $user['id'], $worldId);
        if (!$world) {
            Response::json(['error' => 'World not found.'], 404);
        }

        Response::json(['world' => $world]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        kc_verify_csrf();
        if (!WorldRepository::deleteForUser((int) $user['id'], $worldId)) {
            Response::json(['error' => 'World not found.'], 404);
        }

        Response::json(['ok' => true]);
    }

    Response::json(['error' => 'Method not allowed.'], 405);
} catch (Throwable $e) {
    $debug = (bool) (kc_config()['app']['debug'] ?? false);
    Response::json(['error' => $debug ? $e->getMessage() : 'Database request failed.'], 500);
}
