<?php

declare(strict_types=1);

require __DIR__ . '/../app/bootstrap.php';

use App\Auth;
use App\Response;

Response::json([
    'installed' => (bool) (kc_config()['installed'] ?? false),
    'user' => Auth::user(),
    'csrf_token' => kc_csrf_token(),
]);
