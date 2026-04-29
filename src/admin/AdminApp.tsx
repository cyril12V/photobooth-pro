import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MdDashboard,
  MdCalendarMonth,
  MdCameraAlt,
  MdPrint,
  MdImage,
  MdAutoAwesome,
  MdPalette,
  MdSettings,
  MdVideocam,
  MdQuestionAnswer,
  MdMail,
  MdLogout,
  MdMenuBook,
} from 'react-icons/md';
import type { IconType } from 'react-icons';
import { useAppStore } from '@shared/store';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { AdminLogin } from './AdminLogin';
import { Dashboard } from './screens/Dashboard';
import { EventSettings } from './screens/EventSettings';
import { CameraSettings } from './screens/CameraSettings';
import { PrinterSettings } from './screens/PrinterSettings';
import { Templates } from './screens/Templates';
import { ChallengePoses } from './screens/ChallengePoses';
import { ThemeSettings } from './screens/ThemeSettings';
import { GeneralSettings } from './screens/GeneralSettings';
import { EmailSettings } from './screens/EmailSettings';
import { VideoSettings } from './screens/VideoSettings';
import { InterviewQuestions } from './screens/InterviewQuestions';
import { Album } from './screens/Album';

type AdminTab =
  | 'dashboard'
  | 'event'
  | 'camera'
  | 'video'
  | 'questions'
  | 'printer'
  | 'templates'
  | 'poses'
  | 'album'
  | 'theme'
  | 'email'
  | 'general';

interface TabItem {
  id: AdminTab;
  label: string;
  icon: IconType;
}

interface SidebarSection {
  title?: string;
  tabs?: TabItem[];
}

const sections: SidebarSection[] = [
  {
    tabs: [{ id: 'dashboard', label: 'Tableau de bord', icon: MdDashboard }],
  },
  {
    title: 'Photo',
    tabs: [
      { id: 'event', label: 'Évènement', icon: MdCalendarMonth },
      { id: 'camera', label: 'Caméra', icon: MdCameraAlt },
      { id: 'printer', label: 'Imprimante', icon: MdPrint },
      { id: 'templates', label: 'Templates', icon: MdImage },
      { id: 'poses', label: 'Poses challenge', icon: MdAutoAwesome },
      { id: 'album', label: 'Album', icon: MdMenuBook },
    ],
  },
  {
    title: 'Vidéo',
    tabs: [
      { id: 'video', label: 'Vidéo', icon: MdVideocam },
      { id: 'questions', label: 'Questions interview', icon: MdQuestionAnswer },
    ],
  },
  {
    title: 'Apparence',
    tabs: [{ id: 'theme', label: 'Thème', icon: MdPalette }],
  },
  {
    title: 'Technique',
    tabs: [
      { id: 'email', label: 'Email', icon: MdMail },
      { id: 'general', label: 'Général', icon: MdSettings },
    ],
  },
];

export function AdminApp() {
  const { adminAuthenticated, setAdminMode } = useAppStore();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  if (!adminAuthenticated) {
    return <AdminLogin />;
  }

  const exitAdmin = () => setAdminMode(false);

  return (
    <div className="absolute inset-0 flex" style={{ backgroundColor: '#F4ECDD' }}>
      {/* Sidebar charcoal */}
      <aside
        className="w-64 flex flex-col flex-shrink-0"
        style={{ backgroundColor: '#2B2B2B' }}
      >
        {/* Logo */}
        <div
          className="px-6 pt-8 pb-6"
          style={{ borderBottom: '1px solid rgba(244,236,221,0.1)' }}
        >
          <p
            className="font-editorial leading-none"
            style={{
              color: '#FAF6EE',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.01em',
            }}
          >
            PHOTOBOOTH
          </p>
          <p
            className="label-editorial mt-1"
            style={{ color: '#D4B896', fontSize: '0.625rem' }}
          >
            Pro Edition
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-2">
              {section.title && (
                <p
                  className="label-editorial px-3 mb-2 mt-4"
                  style={{ color: '#D4B896', fontSize: '0.6875rem' }}
                >
                  {section.title}
                </p>
              )}
              {section.tabs?.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors mb-0.5"
                    style={{
                      backgroundColor: active ? '#1A1A1A' : 'transparent',
                      color: active ? '#FAF6EE' : 'rgba(244,236,221,0.65)',
                      borderRadius: '6px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: active ? 500 : 400,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bouton Quitter */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(244,236,221,0.1)' }}>
          <button
            onClick={exitAdmin}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 transition-colors"
            style={{
              backgroundColor: '#FAF6EE',
              color: '#1A1A1A',
              borderRadius: '6px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <MdLogout size={16} />
            <span>Quitter l'admin</span>
          </button>
        </div>

        {/* User card */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: '#D4B896',
                color: '#1A1A1A',
                borderRadius: '4px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '0.6875rem',
              }}
            >
              AD
            </div>
            <div className="flex-1 text-left min-w-0">
              <p
                style={{
                  color: '#FAF6EE',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  lineHeight: 1,
                }}
              >
                Admin
              </p>
              <p
                style={{
                  color: 'rgba(244,236,221,0.5)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.6875rem',
                  marginTop: '0.125rem',
                }}
              >
                Administrateur
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <main
        className="flex-1 overflow-y-auto admin-scroll"
        style={{ backgroundColor: '#F4ECDD' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="p-10 max-w-4xl mx-auto"
          >
            <ErrorBoundary label={tab}>
              {tab === 'dashboard' && <Dashboard />}
              {tab === 'event' && <EventSettings />}
              {tab === 'camera' && <CameraSettings />}
              {tab === 'video' && <VideoSettings />}
              {tab === 'questions' && <InterviewQuestions />}
              {tab === 'printer' && <PrinterSettings />}
              {tab === 'templates' && <Templates />}
              {tab === 'poses' && <ChallengePoses />}
              {tab === 'album' && <Album />}
              {tab === 'theme' && <ThemeSettings />}
              {tab === 'email' && <EmailSettings />}
              {tab === 'general' && <GeneralSettings />}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
