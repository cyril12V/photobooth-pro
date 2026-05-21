# PhotoBooth VPS Server

Serveur HTTP minimal pour recevoir les photos et videos envoyees par l'application PhotoBooth Pro.

## Ce que fait ce serveur

- recoit les uploads depuis la borne via `POST /api/upload`
- protege l'upload avec une cle API
- stocke les fichiers sur le disque du VPS
- expose une page de partage mobile via `/share/...`
- sert les fichiers photo et video via `/media/...`
- gere le streaming `Range` pour les videos

## Fichiers fournis

- `.env.example`
- `server.mjs`
- `photobooth-vps.service.example`
- `nginx.photobooth-vps.conf.example`

## Variables d'environnement

- `PORT`
  - port d'ecoute, par defaut `8787`
- `HOST`
  - interface d'ecoute, par defaut `0.0.0.0`
- `STORAGE_DIR`
  - dossier de stockage, par defaut `./storage`
- `PHOTOBOOTH_API_KEY`
  - cle secrete utilisee par la borne pour uploader
- `PUBLIC_BASE_URL`
  - URL publique finale, par exemple `https://media.mondomaine.com`
- `MAX_UPLOAD_BYTES`
  - limite maximale par fichier, par defaut `1073741824` (1 Go)

## Installation type sur un VPS Ubuntu

```bash
sudo mkdir -p /opt/photobooth
sudo mkdir -p /var/www/photobooth/storage
sudo chown -R $USER:$USER /opt/photobooth
sudo chown -R www-data:www-data /var/www/photobooth
```

Copie ensuite le dossier `vps-server/` sur le VPS, par exemple dans `/opt/photobooth/vps-server`.

```bash
cd /opt/photobooth/vps-server
cp .env.example .env
```

Edite `.env` avec ton domaine et ta cle API, puis lance un test manuel:

```bash
set -a
. ./.env
set +a
node server.mjs
```

## Test de sante

```bash
curl -H "x-api-key: photobooth_live_change_me" https://media.mondomaine.com/api/health
```

## Service systemd

1. copie `photobooth-vps.service.example` vers `/etc/systemd/system/photobooth-vps.service`
2. adapte les chemins si besoin
3. active le service

```bash
sudo systemctl daemon-reload
sudo systemctl enable photobooth-vps
sudo systemctl start photobooth-vps
sudo systemctl status photobooth-vps
```

## Reverse proxy Nginx

Copie `nginx.photobooth-vps.conf.example` dans `/etc/nginx/sites-available/photobooth-vps.conf`, adapte `server_name`, puis active le site:

```bash
sudo ln -s /etc/nginx/sites-available/photobooth-vps.conf /etc/nginx/sites-enabled/photobooth-vps.conf
sudo nginx -t
sudo systemctl reload nginx
```

Ajoute ensuite HTTPS avec Let's Encrypt ou ton proxy habituel.

## Configuration dans la borne

Dans PhotoBooth Pro:

1. `General > Partage`
   - active `Cloud / galerie en ligne`
2. `Email > Cloud / VPS`
   - renseigne `URL publique du VPS`, par exemple `https://media.mondomaine.com`
   - renseigne la `Cle API VPS`
   - clique `Tester le VPS`

Si le VPS est joignable, les QR codes et liens video utiliseront le cloud en priorite. En cas d'echec, l'application retombe sur le serveur local.
