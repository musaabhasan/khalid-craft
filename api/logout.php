<?php

declare(strict_types=1);

require __DIR__ . '/../app/bootstrap.php';

use App\Auth;
use App\Response;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Method not allowed.'], 405);
}

kc_verify_csrf();
Auth::logout();

Response::json(['ok' => true, 'csrf_token' => kc_csrf_token()]);
