import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@shared/store';
import { SplashScreen } from './screens/SplashScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PoseSelectScreen } from './screens/PoseSelectScreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { PrintShareScreen } from './screens/PrintShareScreen';
import { VideoHomeScreen } from './screens/VideoHomeScreen';
import { VideoInterviewScreen } from './screens/VideoInterviewScreen';
import { VideoFreeMessageScreen } from './screens/VideoFreeMessageScreen';
import { VideoPreviewScreen } from './screens/VideoPreviewScreen';
import { VideoShareScreen } from './screens/VideoShareScreen';

export function ClientApp() {
  const screen = useAppStore((s) => s.screen);

  return (
    // Fond papier sur le wrapper : si jamais un cross-fade laisse voir le parent,
    // ce sera le papier et non du sombre. La classe contact porte le style de tous les écrans invités.
    <div className="contact contact-paper absolute inset-0 overflow-hidden">
      {/* Sans mode="wait" : les écrans se chevauchent (cross-fade), pas de gap. */}
      <AnimatePresence initial={false}>
        {screen === 'splash' && <SplashScreen key="splash" />}
        {screen === 'home' && <HomeScreen key="home" />}
        {screen === 'pose-select' && <PoseSelectScreen key="pose-select" />}
        {screen === 'capture' && <CaptureScreen key="capture" />}
        {screen === 'preview' && <PreviewScreen key="preview" />}
        {screen === 'print-share' && <PrintShareScreen key="print-share" />}
        {screen === 'video-home' && <VideoHomeScreen key="video-home" />}
        {screen === 'video-interview' && <VideoInterviewScreen key="video-interview" />}
        {screen === 'video-free' && <VideoFreeMessageScreen key="video-free" />}
        {screen === 'video-preview' && <VideoPreviewScreen key="video-preview" />}
        {screen === 'video-share' && <VideoShareScreen key="video-share" />}
      </AnimatePresence>
    </div>
  );
}
