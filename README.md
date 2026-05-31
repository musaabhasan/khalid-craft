# Khalid Craft

Khalid Craft is an original browser voxel sandbox built for PHP/MySQL shared hosting. It uses plain PHP, PDO, MySQL, and a Three.js frontend, so it can run on Hostinger without Node.js, Composer, WebSockets, or a build pipeline.

## Features

- First-person voxel world rendered in the browser
- Procedural terrain, trees, water, sand, stone, grass, lamps, glass, brick, and leaves
- Place blocks with click, remove blocks with Shift-click, Alt-click, or `F`
- Creative flight movement with `WASD`, `Space`, `Ctrl`/`C`, and sprint with `Shift`
- Touch look controls and mobile movement buttons
- Account registration and login with PHP sessions
- MySQL-backed world save/load/delete per user
- Browser demo save when MySQL or login is not available

## Requirements

- PHP 8.1 or newer
- MySQL 5.7+ or MariaDB 10.3+
- PDO MySQL extension enabled
- HTTPS recommended for production sessions

## Hostinger Setup

1. Create a MySQL database in Hostinger hPanel.
2. Import `database/schema.sql` into that database using phpMyAdmin.
3. Copy `config/config.example.php` to `config/config.php`.
4. Edit `config/config.php` with the Hostinger database name, username, password, host, and port.
5. Upload the project files to `public_html` or to a subfolder under `public_html`.
6. If using a subfolder, set `app.base_url` in `config/config.php`, for example `/khalid-craft`.
7. Open the site in a browser and create the first account.

The folders `app`, `config`, `database`, and `docs` include `.htaccess` files that deny direct web access on Apache-compatible hosting.

## GitHub

This workspace is already a git repository. After creating a GitHub repository named `khalid-craft`, connect it with:

```bash
git remote add origin https://github.com/musaabhasan/khalid-craft.git
git branch -M main
git push -u origin main
```

The connected GitHub account visible to Codex is `musaabhasan`, but this environment cannot create a new GitHub repository because the GitHub CLI is not installed and the available connector does not expose repository creation.

## File Map

- `index.php` - main game page and PHP-rendered UI state
- `api/` - JSON endpoints for auth and worlds
- `app/` - PHP application classes and bootstrap
- `assets/css/app.css` - responsive game interface
- `assets/js/game.js` - Three.js voxel engine and API client
- `database/schema.sql` - MySQL schema
- `config/config.example.php` - production configuration template
