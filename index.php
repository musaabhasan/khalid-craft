<?php

declare(strict_types=1);

const KC_GAME_PASSWORD = '6767';

$secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name('KHALIDCRAFTGATE');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (isset($_GET['lock'])) {
    $_SESSION['game_unlocked'] = false;
    header('Location: index.php');
    exit;
}

$gateError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['game_password'] ?? '');
    if (hash_equals(KC_GAME_PASSWORD, $password)) {
        session_regenerate_id(true);
        $_SESSION['game_unlocked'] = true;
        header('Location: index.php');
        exit;
    }

    $gateError = 'Wrong password.';
}

$gameUnlocked = !empty($_SESSION['game_unlocked']);
$appNameRaw = 'Khalid Craft';
$baseUrl = '';
$appName = htmlspecialchars($appNameRaw, ENT_QUOTES, 'UTF-8');
$assetUrl = static function (string $path): string {
    global $baseUrl;

    $prefix = rtrim($baseUrl, '/');
    $url = $prefix !== '' ? $prefix . '/' . ltrim($path, '/') : ltrim($path, '/');

    return $url . '?v=' . filemtime(__DIR__ . '/' . $path);
};
$characters = [
    [
        'name' => 'Khalid',
        'role' => 'Hero Builder',
        'image' => $assetUrl('assets/img/khalid-main-character.png'),
        'position' => [8, 5.7, 7],
        'scale' => [3.2, 4.3, 1],
    ],
    [
        'name' => 'Omar',
        'role' => 'Space Explorer',
        'image' => $assetUrl('assets/img/omar-secondary-character.jpg'),
        'position' => [11, 5.35, 7],
        'scale' => [2.55, 4.2, 1],
    ],
    [
        'name' => '67',
        'role' => 'Funny Friend',
        'image' => $assetUrl('assets/img/67-character.png'),
        'position' => [5, 5.35, 7],
        'scale' => [2.75, 4.15, 1],
    ],
    [
        'name' => 'TTT Sahur',
        'role' => 'Silly Drummer',
        'image' => $assetUrl('assets/img/tung-tung-tung-sahur.png'),
        'position' => [7, 5.45, 10],
        'scale' => [2.1, 4.1, 1],
    ],
];
$characterNames = implode(' + ', array_column($characters, 'name'));
$lockHeroUrl = $characters[0]['image'];
$cssPath = 'assets/css/app.css';
$jsPath = 'assets/js/game.js';
$cssUrl = $assetUrl($cssPath);
$jsUrl = $assetUrl($jsPath);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title><?= $appName ?></title>
    <link rel="preconnect" href="https://unpkg.com">
    <?php if (!$gameUnlocked): ?>
        <link rel="preload" href="<?= htmlspecialchars($lockHeroUrl, ENT_QUOTES, 'UTF-8') ?>" as="image">
    <?php elseif ($gameUnlocked): ?>
        <?php foreach ($characters as $character): ?>
            <link rel="preload" href="<?= htmlspecialchars($character['image'], ENT_QUOTES, 'UTF-8') ?>" as="image">
        <?php endforeach; ?>
    <?php endif; ?>
    <link rel="stylesheet" href="<?= htmlspecialchars($cssUrl, ENT_QUOTES, 'UTF-8') ?>">
    <?php if ($gameUnlocked): ?>
        <script>
            window.KHALIDCRAFT = <?= json_encode([
                'appName' => $appNameRaw,
                'baseUrl' => rtrim($baseUrl, '/'),
                'character' => $characters[0],
                'characters' => $characters,
            ], JSON_UNESCAPED_SLASHES) ?>;
        </script>
    <?php endif; ?>
</head>
<body>
    <?php if (!$gameUnlocked): ?>
        <main class="lock-shell">
            <section class="lock-stage" aria-label="Enter Khalid Craft">
                <img class="lock-hero-image" src="<?= htmlspecialchars($lockHeroUrl, ENT_QUOTES, 'UTF-8') ?>" alt="KhalidCraft esports world">
                <div class="lock-panel">
                    <div class="brand lock-brand" aria-label="<?= $appName ?>">
                        <span class="brand-mark" aria-hidden="true"></span>
                        <span class="brand-name"><?= $appName ?></span>
                    </div>
                    <form class="password-form" method="post" autocomplete="off">
                        <label for="gamePassword">Password</label>
                        <div class="password-row">
                            <input id="gamePassword" name="game_password" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autofocus required>
                            <button class="button primary" type="submit">
                                <i data-lucide="log-in" aria-hidden="true"></i>
                                <span>Enter</span>
                            </button>
                        </div>
                        <?php if ($gateError !== ''): ?>
                            <p class="password-error" role="alert"><?= htmlspecialchars($gateError, ENT_QUOTES, 'UTF-8') ?></p>
                        <?php endif; ?>
                    </form>
                </div>
            </section>
        </main>
        <script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
        <script>
            if (window.lucide) {
                window.lucide.createIcons();
            }
        </script>
    <?php else: ?>
    <main class="shell">
        <header class="topbar">
            <div class="brand" aria-label="<?= $appName ?>">
                <span class="brand-mark" aria-hidden="true"></span>
                <span class="brand-name"><?= $appName ?></span>
            </div>

            <div class="account" id="accountPanel">
                <span class="account-name">Browser Play</span>
                <a class="button ghost" href="?lock=1" title="Lock game">
                    <i data-lucide="lock" aria-hidden="true"></i>
                    <span>Lock</span>
                </a>
            </div>
        </header>

        <section class="game-layout" aria-label="<?= $appName ?> game">
            <div class="world-panel">
                <div class="world-row">
                    <input id="worldName" type="text" maxlength="60" value="Khalid World" aria-label="World name">
                    <button class="icon-button" id="newWorldButton" type="button" title="New world" aria-label="New world">
                        <i data-lucide="sparkles" aria-hidden="true"></i>
                    </button>
                    <button class="icon-button" id="saveWorldButton" type="button" title="Save world" aria-label="Save world">
                        <i data-lucide="save" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="world-row">
                    <select id="worldSelect" aria-label="Saved worlds">
                        <option value="">Saved worlds</option>
                    </select>
                    <button class="icon-button" id="loadWorldButton" type="button" title="Load world" aria-label="Load world">
                        <i data-lucide="folder-open" aria-hidden="true"></i>
                    </button>
                    <button class="icon-button danger" id="deleteWorldButton" type="button" title="Delete world" aria-label="Delete world">
                        <i data-lucide="trash-2" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="kid-panel" aria-label="Kid quest">
                    <div class="kid-panel-head">
                        <span class="kid-panel-title">
                            <i data-lucide="sparkles" aria-hidden="true"></i>
                            Quest
                        </span>
                        <button class="button secondary kid-reset" id="questResetButton" type="button">
                            <i data-lucide="refresh-cw" aria-hidden="true"></i>
                            <span>New</span>
                        </button>
                    </div>
                    <div class="kid-score-row">
                        <span class="kid-score">
                            <i data-lucide="star" aria-hidden="true"></i>
                            <strong id="starCount">0/5</strong>
                        </span>
                        <span class="kid-score">
                            <i data-lucide="blocks" aria-hidden="true"></i>
                            <strong id="buildCount">0/5</strong>
                        </span>
                    </div>
                    <p class="kid-quest-text" id="questText">Find stars and build something happy.</p>
                </div>
                <div class="character-list" aria-label="Characters">
                    <?php foreach ($characters as $character): ?>
                        <div class="character-card" aria-label="<?= htmlspecialchars($character['role'] . ' ' . $character['name'], ENT_QUOTES, 'UTF-8') ?>">
                            <img class="character-image" src="<?= htmlspecialchars($character['image'], ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($character['name'], ENT_QUOTES, 'UTF-8') ?>">
                            <div class="character-copy">
                                <span><?= htmlspecialchars($character['role'], ENT_QUOTES, 'UTF-8') ?></span>
                                <strong><?= htmlspecialchars($character['name'], ENT_QUOTES, 'UTF-8') ?></strong>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <div class="palette" id="palette" aria-label="Block palette"></div>
            </div>

            <div class="stage" id="stage">
                <canvas id="gameCanvas"></canvas>
                <div class="reticle" aria-hidden="true"></div>
                <div class="status-pill" id="statusPill" role="status"></div>
                <div class="celebration" id="celebration" role="status" aria-live="polite"></div>
                <div class="stats" aria-live="polite">
                    <span id="characterName"><?= htmlspecialchars($characterNames, ENT_QUOTES, 'UTF-8') ?></span>
                    <span id="blockCount">0 blocks</span>
                    <span id="selectedBlock">Grass</span>
                </div>
                <div class="mobile-controls" aria-label="Touch controls">
                    <div class="move-pad" aria-label="Move controls">
                        <button data-move="forward" aria-label="Go forward">
                            <i data-lucide="arrow-up" aria-hidden="true"></i>
                            <span>Go</span>
                        </button>
                        <button data-move="left" aria-label="Move left">
                            <i data-lucide="arrow-left" aria-hidden="true"></i>
                            <span>Left</span>
                        </button>
                        <button data-move="back" aria-label="Go back">
                            <i data-lucide="arrow-down" aria-hidden="true"></i>
                            <span>Back</span>
                        </button>
                        <button data-move="right" aria-label="Move right">
                            <i data-lucide="arrow-right" aria-hidden="true"></i>
                            <span>Right</span>
                        </button>
                    </div>
                    <div class="action-pad" aria-label="Build controls">
                        <button data-move="up" aria-label="Fly up">
                            <i data-lucide="chevron-up" aria-hidden="true"></i>
                            <span>Up</span>
                        </button>
                        <button data-move="down" aria-label="Fly down">
                            <i data-lucide="chevron-down" aria-hidden="true"></i>
                            <span>Down</span>
                        </button>
                        <button data-action="place" aria-label="Build block">
                            <i data-lucide="plus" aria-hidden="true"></i>
                            <span>Build</span>
                        </button>
                        <button data-action="remove" aria-label="Break block">
                            <i data-lucide="eraser" aria-hidden="true"></i>
                            <span>Break</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
            }
        }
    </script>
    <script type="module" src="<?= htmlspecialchars($jsUrl, ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endif; ?>
</body>
</html>
