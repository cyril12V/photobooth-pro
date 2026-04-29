import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Calendar,
  Sparkles,
  Printer,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Settings2,
  Wifi,
  Video,
} from 'lucide-react';
import { useAppStore } from '@shared/store';

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof ImageIcon;
  iconBg: string;
  iconColor: string;
  delta?: string;
  deltaPositive?: boolean;
}

interface Activity {
  label: string;
  sub: string;
  time: string;
  icon: typeof CheckCircle2;
  iconColor: string;
  iconBg: string;
}

const RECENT_ACTIVITIES: Activity[] = [
  {
    label: 'Session démarrée',
    sub: 'Application lancée avec succès',
    time: 'Il y a 2 min',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  {
    label: 'Template modifié',
    sub: 'Mise à jour du design principal',
    time: 'Il y a 14 min',
    icon: Settings2,
    iconColor: 'text-[#c8956a]',
    iconBg: 'bg-amber-50',
  },
  {
    label: 'Paramètres sauvegardés',
    sub: 'Configuration générale',
    time: 'Il y a 1 h',
    icon: Clock,
    iconColor: 'text-neutral-500',
    iconBg: 'bg-neutral-100',
  },
  {
    label: 'Imprimante connectée',
    sub: 'Prête à imprimer',
    time: 'Il y a 2 h',
    icon: Wifi,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
];

function formatDateFr(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function Dashboard() {
  const { event, poses, settings } = useAppStore();
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [videoTotalSec, setVideoTotalSec] = useState(0);

  useEffect(() => {
    if (!event) return;
    window.api.photo.list(event.id).then((photos) => setPhotoCount(photos.length));
    window.api.video.list(event.id).then((videos) => {
      setVideoCount(videos.length);
      const total = videos.reduce((sum, v) => sum + (v.duration_ms ?? 0), 0);
      setVideoTotalSec(Math.round(total / 1000));
    });
  }, [event]);

  const openFolder = () => {
    window.api.photo.openFolder();
  };

  const videoEnabled = settings?.video_enabled ?? true;
  const videoDurationLabel = (() => {
    const m = Math.floor(videoTotalSec / 60);
    const s = videoTotalSec % 60;
    if (m === 0) return `${s}s`;
    return `${m} min ${String(s).padStart(2, '0')}s`;
  })();

  const stats: StatCard[] = [
    {
      label: 'PHOTOS PRISES',
      value: photoCount,
      icon: ImageIcon,
      iconBg: 'bg-amber-50',
      iconColor: 'text-[#d4a574]',
      delta: photoCount > 0 ? `${photoCount} sauvegardée${photoCount > 1 ? 's' : ''}` : '—',
      deltaPositive: true,
    },
    {
      label: 'VIDÉOS ENREGISTRÉES',
      value: videoCount,
      icon: Video,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
      delta: videoEnabled
        ? videoCount > 0
          ? `${videoDurationLabel} cumulés`
          : 'Aucune pour le moment'
        : 'Mode désactivé',
      deltaPositive: videoEnabled,
    },
    {
      label: 'POSES CHALLENGE',
      value: poses.length,
      icon: Sparkles,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500',
      delta: `${poses.length} actives`,
      deltaPositive: true,
    },
    {
      label: 'ÉVÈNEMENT ACTIF',
      value: event?.name ?? '—',
      icon: Calendar,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <p
          className="text-xs font-semibold uppercase tracking-[0.35em] mb-1"
          style={{ color: '#c8956a' }}
        >
          Tableau de bord
        </p>
        <h1 className="font-bold text-3xl text-neutral-900 leading-tight">Bienvenue, Admin</h1>
        <p className="text-neutral-500 text-sm mt-1.5">
          Voici ce qui se passe avec votre photobooth
        </p>
      </div>

      {/* Évènement actif — bannière */}
      {event && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(232,199,154,0.18) 0%, rgba(212,165,116,0.12) 100%)',
            border: '1px solid rgba(212,165,116,0.30)',
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #e8c79a 0%, #d4a574 100%)' }}
          >
            <Calendar size={22} color="#2a1a10" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
              Évènement actif
            </p>
            <p className="font-bold text-neutral-900 text-lg leading-tight truncate">
              {event.name}
            </p>
            {event.date && (
              <p className="text-sm text-neutral-500 mt-0.5">{formatDateFr(event.date)}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(16,185,129,0.1)',
                color: '#059669',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              En cours
            </span>
          </div>
        </motion.div>
      )}

      {/* Stats cards 4 colonnes */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const isNumeric = typeof stat.value === 'number';
          const DeltaIcon = stat.deltaPositive ? TrendingUp : TrendingDown;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider leading-tight">
                  {stat.label}
                </p>
                <div
                  className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={20} className={stat.iconColor} strokeWidth={2} />
                </div>
              </div>
              <p
                className={`font-bold text-neutral-900 leading-none ${
                  isNumeric ? 'text-3xl' : 'text-lg truncate'
                }`}
              >
                {stat.value}
              </p>
              {stat.delta && (
                <p
                  className={`text-xs mt-2.5 font-semibold flex items-center gap-1 ${
                    stat.deltaPositive ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  <DeltaIcon size={11} strokeWidth={2.5} />
                  {stat.delta}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Activité récente + Accès rapide */}
      <div className="grid grid-cols-2 gap-6">
        {/* Activité récente */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-md">
          <h3 className="font-semibold text-neutral-900 text-sm mb-5">Activité récente</h3>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.label} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg ${a.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon size={15} className={a.iconColor} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-800 text-sm font-medium leading-tight">
                      {a.label}
                    </p>
                    <p className="text-neutral-400 text-xs mt-0.5 truncate">{a.sub}</p>
                  </div>
                  <span className="text-neutral-400 text-xs flex-shrink-0">{a.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accès rapide */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-md">
          <h3 className="font-semibold text-neutral-900 text-sm mb-4">Accès rapide</h3>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Configurez votre évènement, caméra, imprimante, templates et poses challenge via le menu gauche.
          </p>
          <motion.button
            onClick={openFolder}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(232,199,154,0.25) 0%, rgba(212,165,116,0.15) 100%)',
              border: '1.5px solid rgba(212,165,116,0.45)',
              color: '#5a3e2b',
            }}
            whileHover={{
              background: 'linear-gradient(135deg, rgba(232,199,154,0.4) 0%, rgba(212,165,116,0.28) 100%)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <FolderOpen size={17} strokeWidth={2} />
            Ouvrir le dossier des photos
          </motion.button>
        </div>
      </div>
    </>
  );
}
