---
name: photobooth_project
description: Contexte technique du projet Photobooth Electron+React pour l'éditeur de templates
type: project
---

App Electron + React 18 + Vite + Tailwind CSS + Zustand + TypeScript strict.

**Why:** Photobooth app pour events (mariage, soirées). Photos auto-habillées via templates configurables.

**How to apply:** Utiliser window.api.* pour toutes les opérations IPC (pas de fs direct). Canvas 1200x1800 portrait par défaut. react-rnd installé pour drag/resize.

Stack: Tailwind palette midnight/gold/cream/coral. Composants partagés dans @shared/components. AdminUI dans src/admin/components/AdminUI.tsx. Store Zustand dans @shared/store.

Éditeur de templates refait en canvas libre (src/admin/screens/templates/):
- Editor.tsx — composant principal plein écran
- EditorCanvas.tsx — canvas interactif avec react-rnd
- PropertiesPanel.tsx — panneau propriétés élément sélectionné
- CanvasPreview.tsx — miniature statique pour la liste
- defaults.ts — presets (Wedding, Polaroid, Géométrique) + factory makeNewElement
