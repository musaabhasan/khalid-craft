# Khalid Craft

Khalid Craft is an original browser voxel sandbox built for simple shared hosting. It uses one PHP page for cache-busted assets and a Three.js frontend, so it can run on Hostinger without Node.js, Composer, WebSockets, login, or a database.

## Features

- First-person voxel world rendered in the browser
- Procedural terrain, trees, water, sand, stone, grass, lamps, glass, brick, and leaves
- Place blocks with click, remove blocks with Shift-click, Alt-click, or `F`
- Creative flight movement with `WASD`, `Space`, `Ctrl`/`C`, and sprint with `Shift`
- Touch look controls and mobile movement buttons
- Character identities for Khalid and secondary character Omar using included portrait assets
- Starts playing immediately in the browser
- Browser-only world save/load/delete with `localStorage`

## Requirements

- PHP 8.1 or newer

## Hostinger Setup

1. Upload the project files to `public_html` or to a subfolder under `public_html`.
2. Open `index.php` in the browser.
3. Click the canvas and start playing.
4. Use the save/load/delete buttons to manage worlds in the current browser.

Saved worlds are stored in the browser that creates them. Clearing browser site data also clears saved worlds.

## GitHub

This workspace is published at:

```text
https://github.com/musaabhasan/khalid-craft
```

## File Map

- `index.php` - main game page and PHP-rendered UI state
- `assets/css/app.css` - responsive game interface
- `assets/js/game.js` - Three.js voxel engine and API client
- `assets/img/khalid-main-character.png` - Khalid main character portrait
- `assets/img/omar-secondary-character.jpg` - Omar secondary character portrait
