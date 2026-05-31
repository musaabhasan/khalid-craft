<?php

declare(strict_types=1);

require __DIR__ . '/../app/bootstrap.php';

use App\Auth;
use App\Response;
use App\WorldRepository;

$user = Auth::requireUser();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        Response::json(['worlds' => WorldRepository::listForUser((int) $user['id'])]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        kc_verify_csrf();
        $saved = WorldRepository::saveForUser((int) $user['id'], kc_json_input());
        Response::json(['world' => $saved]);
    }

    Response::json(['error' => 'Method not allowed.'], 405);
} catch (Throwable $e) {
    $debug = (bool) (kc_config()['app']['debug'] ?? false);
    Response::json(['error' => $debug ? $e->getMessage() : 'Database request failed.'], 500);
}
