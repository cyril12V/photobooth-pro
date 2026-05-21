# Configuration Lumos VideoBooth

Configuration retenue: `lumos-videobooth.fr` sert directement au partage QR du photobooth.

## 1. DNS a creer

Chez ton registrar DNS:

- type `A`
- nom `@`
- valeur `IP_DE_TON_VPS`

Si ton VPS a aussi une IPv6:

- type `AAAA`
- nom `@`
- valeur `IPV6_DE_TON_VPS`

Resultat attendu:

- `https://lumos-videobooth.fr`

## 2. Valeurs a mettre dans le fichier `.env`

Tu peux partir directement de `vps-server/.env.lumos.example`.

```env
HOST=127.0.0.1
PORT=8787
STORAGE_DIR=/var/www/photobooth/storage
PUBLIC_BASE_URL=https://lumos-videobooth.fr
PHOTOBOOTH_API_KEY=lumos_pb_change_this_to_a_long_random_secret
MAX_UPLOAD_BYTES=1073741824
```

## 3. Configuration Nginx

Tu peux partir directement de `vps-server/nginx.lumos-videobooth.fr.conf.example`.

```nginx
server {
    listen 80;
    server_name lumos-videobooth.fr;

    client_max_body_size 1024m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 4. HTTPS

Une fois Nginx actif et le DNS propage:

```bash
sudo certbot --nginx -d lumos-videobooth.fr
```

## 4bis. Service systemd

Le fichier fourni `vps-server/photobooth-vps.service.example` peut etre copie tel quel si ton application est dans `/opt/photobooth/vps-server`:

```bash
sudo cp /opt/photobooth/vps-server/photobooth-vps.service.example /etc/systemd/system/photobooth-vps.service
sudo systemctl daemon-reload
sudo systemctl enable photobooth-vps
sudo systemctl start photobooth-vps
sudo systemctl status photobooth-vps
```

## 5. Valeurs a renseigner dans l'application

Dans la borne:

- `General > Partage`
  - activer `Cloud / galerie en ligne`
- `Email > Cloud / VPS`
  - `URL publique du VPS` = `https://lumos-videobooth.fr`
  - `Cle API VPS` = la meme valeur que `PHOTOBOOTH_API_KEY`

## 6. Test rapide

Depuis un navigateur ou `curl`:

```bash
curl -H "x-api-key: lumos_pb_change_this_to_a_long_random_secret" https://lumos-videobooth.fr/api/health
```

Reponse attendue:

```json
{"ok":true,"server":"https://lumos-videobooth.fr"}
```

## 7. Ce que je te conseille

- utilise directement `lumos-videobooth.fr` pour les photos et videos QR
- genere une vraie cle longue, par exemple 40 a 64 caracteres
