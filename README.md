# 📸 PhotoBooth Pro

Logiciel Photo Booth professionnel pour mariages et évènements.
**Stack** : Electron + React + TypeScript + Tailwind + SQLite + Supabase (optionnel).

---

## ✨ Fonctionnalités V1

- 🎨 Interface tactile plein écran (mode kiosque réel)
- 📷 Caméra webcam HD avec compte à rebours, flash et sons
- 🎭 Deux modes : **Photo Classique** et **Photo Challenge** (poses à imiter)
- 🖼️ Templates de cadres personnalisables
- 🖨️ Impression silencieuse (sans dialogue système) — 1 à N copies
- 📱 Partage QR code et email
- 💾 Sauvegarde locale automatique par évènement
- 🔐 Mode admin protégé par mot de passe (SHA-256)
- 🎨 Thème entièrement personnalisable (6 palettes prédéfinies + couleurs sur mesure)
- 📦 SQLite local — fonctionne 100% hors ligne

## 🚀 Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer en mode dev
npm run dev

# 3. Builder pour la prod (Windows)
npm run build
```

L'installateur Windows est généré dans `release/`.

## 🎮 Utilisation

### Côté invité (client)
- L'écran d'accueil affiche le nom et la date de l'évènement.
- Touchez **Commencer** → choisissez **Classique** ou **Challenge** → la photo se prend automatiquement après le compte à rebours.
- Validation, puis impression et/ou partage.

### Côté organisateur (admin)
- **Accès admin** : tapotez 5 fois rapidement le coin supérieur droit de l'écran.
- **Mot de passe par défaut** : `admin` (à changer dès la première utilisation dans Général > Sécurité).
- **8 onglets** : Tableau de bord · Évènement · Caméra · Imprimante · Templates · Poses challenge · Thème · Général.

### Raccourcis cachés (mode kiosque)
- `Ctrl+Shift+Q` × 3 fois rapidement → quitte l'application.
- 5 tapotements coin haut-droit → ouvre l'admin.

## 📁 Structure

```
photobooth/
├── electron/              # Main process Node
│   ├── main.ts            # Fenêtre, kiosk, IPC
│   ├── preload.ts         # Bridge sécurisé
│   ├── database.ts        # SQLite + schéma
│   └── printer.ts         # Impression silencieuse
├── src/
│   ├── App.tsx            # Routeur client / admin
│   ├── client/            # Interface invité
│   │   └── screens/       # Home, ModeSelect, Capture, Preview, PrintShare...
│   ├── admin/             # Interface organisateur
│   │   └── screens/       # Dashboard, Event, Camera, Printer, Templates...
│   └── shared/            # Composants, store, types, lib partagés
└── package.json
```

## 🗄️ Données

- **SQLite** : stocké dans le dossier utilisateur (`%APPDATA%/photobooth-pro/photobooth.sqlite` sur Windows).
- **Photos** : sauvegardées dans `Mes Images/PhotoBooth/{nom_evenement}/`.

Tables : `events`, `photos`, `templates`, `challenge_poses`, `settings`, `print_log`.

## 🔮 Roadmap V2

- [ ] Reflex DSLR Canon/Nikon/Sony (gphoto2 / SDK natifs)
- [ ] SDK imprimantes pro (DNP, Mitsubishi)
- [ ] Galerie cloud Supabase + envoi email réel (Resend/SendGrid)
- [ ] Système de licence (clé d'activation)
- [ ] Sauvegarde redondante automatique sur clé USB
- [ ] Effets IA, GIF animés, boomerang
- [ ] Build macOS

## 🛠️ Notes techniques

### Mode kiosque
Activé automatiquement quand `NODE_ENV=production` ou `KIOSK=1`.
En dev, la fenêtre est normale pour faciliter le debug.

### Impression
V1 utilise `webContents.print()` en mode silencieux (HTML caché → PDF → imprimante).
Pour les imprimantes pro DNP/Mitsubishi, prévoir le SDK natif en V2 pour un contrôle précis du format.

### Caméra
`getUserMedia` côté renderer — la liste des caméras est exposée dans Admin > Caméra avec aperçu en direct.

### Sécurité du mot de passe admin
SHA-256 client-side, stocké en hash dans `settings`. Suffisant pour un mot de passe local non-réseau.

## 📝 Licence

UNLICENSED — projet privé.
