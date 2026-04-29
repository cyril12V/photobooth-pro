import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MdImage,
  MdCalendarMonth,
  MdAutoAwesome,
  MdFolderOpen,
  MdCheckCircle,
  MdAccessTime,
  MdSettings,
  MdWifi,
  MdVideocam,
} from 'react-icons/md';
import type { IconType } from 'react-icons';
import { useAppStore } from '@shared/store';

interface StatCard {
  label: string;
  value: string | number;
  icon: IconType;
  delta?: string;
}

interface Activity {
  label: string;
  sub: string;
  time: string;
  icon: IconType;
}

const RECENT_ACTIVITIES: Activity[] = [
  {
    label: 'Session démarrée',
    sub: 'Application lancée avec succès',
    time: 'Il y a 2 min',
    icon: MdCheckCircle,
  },
  {
    label: 'Template modifié',
    sub: 'Mise à jour du design principal',
    time: 'Il y a 14 min',
    icon: MdSettings,
  },
  {
    label: 'Paramètres sauvegardés',
    sub: 'Configuration générale',
    time: 'Il y a 1 h',
    icon: MdAccessTime,
  },
  {
    label: 'Imprimante connectée',
    sub: 'Prête à imprimer',
    time: 'Il y a 2 h',
    icon: MdWifi,
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
      label: 'Photos prises',
      value: photoCount,
      icon: MdImage,
      delta: photoCount > 0 ? `${photoCount} sauvegardée${photoCount > 1 ? 's' : ''}` : 'Aucune',
    },
    {
      label: 'Vidéos enregistrées',
      value: videoCount,
      icon: MdVideocam,
      delta: videoEnabled
        ? videoCount > 0
          ? `${videoDurationLabel} cumulés`
          : 'Aucune pour le moment'
        : 'Mode désactivé',
    },
    {
      label: 'Poses challenge',
      value: poses.length,
      icon: MdAutoAwesome,
      delta: `${poses.length} actives`,
    },
    {
      label: 'Évènement actif',
      value: event?.name ?? '—',
      icon: MdCalendarMonth,
    },
  ];

  return (
    <>
      <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
          Tableau de bord
        </p>
        <h1
          style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 800,
            color: '#1A1A1A',
            fontSize: '2.5rem',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Bienvenue, Admin
        </h1>
        <p
          className="mt-2"
          style={{
            color: '#6B5D4F',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9375rem',
          }}
        >
          Voici ce qui se passe avec votre photobooth
        </p>
      </div>

      {/* Évènement actif */}
      {event && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 p-6 flex items-center gap-5"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid rgba(212, 184, 150, 0.3)',
            borderRadius: '24px',
          }}
        >
          <div
            className="w-12 h-12 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }}
          >
            <MdCalendarMonth size={24} color="#FAF6EE" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="label-editorial mb-1" style={{ color: '#6B5D4F' }}>
              Évènement actif
            </p>
            <p
              className="truncate"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                color: '#1A1A1A',
                fontSize: '1.25rem',
                letterSpacing: '-0.01em',
              }}
            >
              {event.name}
            </p>
            {event.date && (
              <p
                className="mt-1"
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                {formatDateFr(event.date)}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <span
              className="label-editorial inline-flex items-center gap-2 px-3 py-1.5"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#FAF6EE',
                borderRadius: '999px',
                fontSize: '0.6875rem',
              }}
            >
              <span
                className="w-1.5 h-1.5 inline-block"
                style={{ backgroundColor: '#FAF6EE', borderRadius: '50%' }}
              />
              En cours
            </span>
          </div>
        </motion.div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const isNumeric = typeof stat.value === 'number';
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-6"
              style={{
                backgroundColor: '#FAF6EE',
                border: '1px solid rgba(212, 184, 150, 0.2)',
                borderRadius: '24px',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <p className="label-editorial leading-tight" style={{ color: '#6B5D4F' }}>
                  {stat.label}
                </p>
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }}
                >
                  <Icon size={18} color="#FAF6EE" />
                </div>
              </div>
              <p
                className={`leading-none ${isNumeric ? '' : 'truncate'}`}
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 800,
                  color: '#1A1A1A',
                  fontSize: isNumeric ? '2.25rem' : '1.125rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {stat.value}
              </p>
              {stat.delta && (
                <p
                  className="mt-3"
                  style={{
                    color: '#6B5D4F',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.75rem',
                  }}
                >
                  {stat.delta}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Activité récente + Accès rapide */}
      <div className="grid grid-cols-2 gap-6">
        <div
          className="p-6"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid rgba(212, 184, 150, 0.2)',
            borderRadius: '24px',
          }}
        >
          <h3
            className="mb-5"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              color: '#1A1A1A',
              fontSize: '1rem',
            }}
          >
            Activité récente
          </h3>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.label} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }}
                  >
                    <Icon size={16} style={{ color: '#1A1A1A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      style={{
                        color: '#1A1A1A',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {a.label}
                    </p>
                    <p
                      className="truncate"
                      style={{
                        color: '#6B5D4F',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '0.75rem',
                        marginTop: '0.125rem',
                      }}
                    >
                      {a.sub}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0"
                    style={{
                      color: '#6B5D4F',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.75rem',
                    }}
                  >
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="p-6"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid rgba(212, 184, 150, 0.2)',
            borderRadius: '24px',
          }}
        >
          <h3
            className="mb-3"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              color: '#1A1A1A',
              fontSize: '1rem',
            }}
          >
            Accès rapide
          </h3>
          <p
            className="mb-6"
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
          >
            Configurez votre évènement, caméra, imprimante, templates et poses challenge via le menu
            gauche.
          </p>
          <button onClick={openFolder} className="btn-editorial-secondary w-full">
            <MdFolderOpen size={18} />
            Ouvrir le dossier des photos
          </button>
        </div>
      </div>
    </>
  );
}
