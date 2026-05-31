# Hostinger Deployment

## Upload

Upload all files and folders to `public_html` unless your Hostinger domain points to another document root.

No MySQL database, login setup, Composer install, or Node.js build is required.

## Smoke Test

After upload:

1. Open the site URL.
2. Enter password `6767`.
3. Confirm the 3D world renders.
4. Click the canvas and move around.
5. Save the default world.
6. Refresh the page.
7. Load the saved world from the saved-world selector.

Worlds are saved in the current browser with `localStorage`.
