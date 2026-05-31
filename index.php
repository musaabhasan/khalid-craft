<?php

declare(strict_types=1);

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
        'role' => 'Main Character',
        'image' => $assetUrl('assets/img/khalid-main-character.png'),
        'position' => [0, 5.7, 0],
        'scale' => [3.2, 4.3, 1],
    ],
    [
        'name' => 'Omar',
        'role' => 'Secondary Character',
        'image' => $assetUrl('assets/img/omar-secondary-character.jpg'),
        'position' => [3.2, 5.35, -0.6],
        'scale' => [2.55, 4.2, 1],
    ],
];
$characterNames = implode(' + ', array_column($characters, 'name'));
$cssPath = 'assets/css/app.css';
$jsPath = 'assets/js/game.js';
$cssUrl = $assetUrl($cssPath);
$jsUrl = $assetUrl($jsPath);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= $appName ?></title>
    <link rel="preconnect" href="https://unpkg.com">
    <?php foreach ($characters as $character): ?>
        <link rel="preload" href="<?= htmlspecialchars($character['image'], ENT_QUOTES, 'UTF-8') ?>" as="image">
    <?php endforeach; ?>
    <link rel="stylesheet" href="<?= htmlspecialchars($cssUrl, ENT_QUOTES, 'UTF-8') ?>">
    <script>
        window.KHALIDCRAFT = <?= json_encode([
            'appName' => $appNameRaw,
            'baseUrl' => rtrim($baseUrl, '/'),
            'character' => $characters[0],
            'characters' => $characters,
        ], JSON_UNESCAPED_SLASHES) ?>;
    </script>
</head>
<body>
    <main class="shell">
        <header class="topbar">
            <div class="brand" aria-label="<?= $appName ?>">
                <span class="brand-mark" aria-hidden="true"></span>
                <span class="brand-name"><?= $appName ?></span>
            </div>

            <div class="account" id="accountPanel">
                <span class="account-name">Browser Play</span>
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
                <div class="stats" aria-live="polite">
                    <span id="characterName"><?= htmlspecialchars($characterNames, ENT_QUOTES, 'UTF-8') ?></span>
                    <span id="blockCount">0 blocks</span>
                    <span id="selectedBlock">Grass</span>
                </div>
                <div class="mobile-controls" aria-label="Movement controls">
                    <button data-move="forward" aria-label="Forward"><i data-lucide="arrow-up" aria-hidden="true"></i></button>
                    <button data-move="left" aria-label="Left"><i data-lucide="arrow-left" aria-hidden="true"></i></button>
                    <button data-move="back" aria-label="Back"><i data-lucide="arrow-down" aria-hidden="true"></i></button>
                    <button data-move="right" aria-label="Right"><i data-lucide="arrow-right" aria-hidden="true"></i></button>
                    <button data-move="up" aria-label="Up"><i data-lucide="chevron-up" aria-hidden="true"></i></button>
                    <button data-move="down" aria-label="Down"><i data-lucide="chevron-down" aria-hidden="true"></i></button>
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
</body>
</html>
