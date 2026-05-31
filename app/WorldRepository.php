<?php

declare(strict_types=1);

namespace App;

use PDO;

final class WorldRepository
{
    private const MAX_JSON_BYTES = 2_500_000;
    private const MAX_BLOCKS = 20000;

    public static function listForUser(int $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, name, seed, block_count, updated_at, created_at FROM worlds WHERE user_id = :user_id ORDER BY updated_at DESC, id DESC'
        );
        $stmt->execute([':user_id' => $userId]);

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'seed' => (string) $row['seed'],
            'block_count' => (int) $row['block_count'],
            'updated_at' => (string) $row['updated_at'],
            'created_at' => (string) $row['created_at'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public static function getForUser(int $userId, int $worldId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, name, seed, block_count, data_json, updated_at, created_at FROM worlds WHERE id = :id AND user_id = :user_id LIMIT 1'
        );
        $stmt->execute([
            ':id' => $worldId,
            ':user_id' => $userId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'seed' => (string) $row['seed'],
            'block_count' => (int) $row['block_count'],
            'data' => json_decode((string) $row['data_json'], true),
            'updated_at' => (string) $row['updated_at'],
            'created_at' => (string) $row['created_at'],
        ];
    }

    public static function saveForUser(int $userId, array $payload): array
    {
        $worldId = isset($payload['id']) && $payload['id'] !== '' ? (int) $payload['id'] : null;
        $name = self::cleanName((string) ($payload['name'] ?? 'Khalid World'));
        $seed = self::cleanSeed((string) ($payload['seed'] ?? 'khalid'));
        $data = $payload['data'] ?? null;

        if (!is_array($data)) {
            Response::json(['error' => 'World data is missing.'], 422);
        }

        self::validateWorldData($data);
        $json = json_encode($data, JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || strlen($json) > self::MAX_JSON_BYTES) {
            Response::json(['error' => 'World is too large for shared-hosting storage.'], 413);
        }

        $blockCount = count($data['blocks'] ?? []);
        $pdo = Database::connection();

        if ($worldId !== null) {
            $stmt = $pdo->prepare(
                'UPDATE worlds SET name = :name, seed = :seed, block_count = :block_count, data_json = :data_json, updated_at = NOW()
                 WHERE id = :id AND user_id = :user_id'
            );
            $stmt->execute([
                ':name' => $name,
                ':seed' => $seed,
                ':block_count' => $blockCount,
                ':data_json' => $json,
                ':id' => $worldId,
                ':user_id' => $userId,
            ]);

            if ($stmt->rowCount() === 0 && !self::getForUser($userId, $worldId)) {
                Response::json(['error' => 'World not found.'], 404);
            }

            return [
                'id' => $worldId,
                'name' => $name,
                'seed' => $seed,
                'block_count' => $blockCount,
            ];
        }

        $stmt = $pdo->prepare(
            'INSERT INTO worlds (user_id, name, seed, block_count, data_json, created_at, updated_at)
             VALUES (:user_id, :name, :seed, :block_count, :data_json, NOW(), NOW())'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':name' => $name,
            ':seed' => $seed,
            ':block_count' => $blockCount,
            ':data_json' => $json,
        ]);

        return [
            'id' => (int) $pdo->lastInsertId(),
            'name' => $name,
            'seed' => $seed,
            'block_count' => $blockCount,
        ];
    }

    public static function deleteForUser(int $userId, int $worldId): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM worlds WHERE id = :id AND user_id = :user_id');
        $stmt->execute([
            ':id' => $worldId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount() > 0;
    }

    private static function cleanName(string $name): string
    {
        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
        $name = mb_substr($name, 0, 60);

        return $name !== '' ? $name : 'Khalid World';
    }

    private static function cleanSeed(string $seed): string
    {
        $seed = preg_replace('/[^A-Za-z0-9_-]/', '', $seed) ?? '';
        return substr($seed !== '' ? $seed : bin2hex(random_bytes(4)), 0, 32);
    }

    private static function validateWorldData(array $data): void
    {
        $blocks = $data['blocks'] ?? null;
        if (!is_array($blocks)) {
            Response::json(['error' => 'World blocks must be an array.'], 422);
        }

        if (count($blocks) > self::MAX_BLOCKS) {
            Response::json(['error' => 'World has too many blocks for this edition.'], 413);
        }

        $allowed = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'water', 'glass', 'lamp', 'brick'];

        foreach ($blocks as $block) {
            if (!is_array($block) || count($block) !== 4) {
                Response::json(['error' => 'Invalid block data.'], 422);
            }

            [$x, $y, $z, $type] = $block;
            if (!is_int($x) || !is_int($y) || !is_int($z) || !is_string($type)) {
                Response::json(['error' => 'Invalid block data types.'], 422);
            }

            if ($x < -64 || $x > 64 || $y < -16 || $y > 64 || $z < -64 || $z > 64 || !in_array($type, $allowed, true)) {
                Response::json(['error' => 'World contains an unsupported block.'], 422);
            }
        }
    }
}
