# Hostinger Deployment

## Database

Create a MySQL database in Hostinger hPanel, then open phpMyAdmin and import:

```text
database/schema.sql
```

Hostinger usually gives database values similar to:

```text
DB name: u123456789_khalidcraft
DB user: u123456789_khalid
DB host: localhost
DB port: 3306
```

## Config

Copy:

```text
config/config.example.php
```

to:

```text
config/config.php
```

Then update the database settings:

```php
'database' => [
    'host' => 'localhost',
    'port' => 3306,
    'name' => 'your_hostinger_database',
    'user' => 'your_hostinger_user',
    'password' => 'your_hostinger_password',
    'charset' => 'utf8mb4',
],
```

If Khalid Craft is installed in a subfolder, set:

```php
'base_url' => '/khalid-craft',
```

If it is installed at the domain root, leave `base_url` empty.

## Upload

Upload all files and folders to `public_html` unless your Hostinger domain points to another document root.

Keep `config/config.php` on the server only. It is ignored by git so database passwords are not committed.

## Smoke Test

After upload:

1. Open the site URL.
2. Confirm the 3D world renders.
3. Register a user.
4. Save the default world.
5. Refresh the page.
6. Load the saved world from the saved-world selector.

If registration fails, set `'debug' => true` temporarily in `config/config.php`, retry, then turn debug back off.
