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
    // Fond cream sur le wrapper : si jamais un cross-fade laisse voir le parent,
    // ce sera cream et non sombre. Plus jamais de flash bleu sombre entre les écrans.
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#faf6ef' }}>
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
