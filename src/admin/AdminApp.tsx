import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  Camera,
  Printer,
  Image as ImageIcon,
  Sparkles,
  Palette,
  Settings as SettingsIcon,
  Video,
  MessageSquareQuote,
  Mail,
  LogOut,
  BookOpen,
} from 'lucide-react';
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
  icon: typeof LayoutDashboard;
}

interface SidebarSection {
  title?: string;
  tabs?: TabItem[];
  placeholder?: string;
}

const sections: SidebarSection[] = [
  {
    tabs: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    title: 'PHOTO',
    tabs: [
      { id: 'event', label: 'Évènement', icon: Calendar },
      { id: 'camera', label: 'Caméra', icon: Camera },
      { id: 'printer', label: 'Imprimante', icon: Printer },
      { id: 'templates', label: 'Templates', icon: ImageIcon },
      { id: 'poses', label: 'Poses challenge', icon: Sparkles },
      { id: 'album', label: 'Album', icon: BookOpen },
    ],
  },
  {
    title: 'VIDÉO',
    tabs: [
      { id: 'video', label: 'Vidéo', icon: Video },
      { id: 'questions', label: 'Questions interview', icon: MessageSquareQuote },
    ],
    placeholder: 'Bientôt disponible',
  },
  {
    title: 'APPARENCE',
    tabs: [
      { id: 'theme', label: 'Thème', icon: Palette },
    ],
  },
  {
    title: 'TECHNIQUE',
    tabs: [
      { id: 'email', label: 'Email', icon: Mail },
      { id: 'general', label: 'Général', icon: SettingsIcon },
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
    <div className="absolute inset-0 flex bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a0a0a] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <p className="text-white font-bold text-xl tracking-tight leading-none">PHOTOBOOTH</p>
          <p className="text-neutral-500 text-xs font-medium mt-1 tracking-widest uppercase">Pro</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <p className="text-xs uppercase tracking-widest text-neutral-500 px-3 mb-1 mt-4">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5
                      ${active
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                    <span className="font-medium text-sm">{t.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bouton Quitter le mode admin */}
        <div className="p-3">
          <button
            onClick={exitAdmin}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-900/20"
          >
            <LogOut size={16} strokeWidth={2.2} className="flex-shrink-0" />
            <span>Quitter le mode admin</span>
          </button>
        </div>

        {/* User card */}
        <div className="p-3 border-t border-neutral-800">
          <div className="w-full flex items-center gap-3 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">AD</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-xs font-semibold leading-none">Admin</p>
              <p className="text-neutral-500 text-xs mt-0.5">Administrateur</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto admin-scroll bg-neutral-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-8 max-w-4xl mx-auto"
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
