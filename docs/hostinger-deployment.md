# Hostinger Deployment

## Upload

Upload all files and folders to `public_html` unless your Hostinger domain points to another document root.

No MySQL database, login setup, Composer install, or Node.js build is required.

## Smoke Test

After upload:

1. Open the site URL.
2. Confirm the 3D world renders.
3. Click the canvas and move around.
4. Save the default world.
5. Refresh the page.
6. Load the saved world from the saved-world selector.

Worlds are saved in the current browser with `localStorage`.
