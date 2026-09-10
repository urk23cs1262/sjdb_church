import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './common_navbar';
import Footer from './common_footer';
import VideoAdWidget from './common_video_ad_widget';
import BirthdayCelebration from './common_birthday_celebration';
import VoiceOrb from './common_voice_orb';
import useVoiceAssistant from '../../hooks/useVoiceAssistant';

export default function Layout() {
  // Shared state: is the video ad widget in its open (visible) state?
  const [videoAdOpen, setVideoAdOpen] = useState(true);

  // "Hey Connect" voice assistant — mounted once, persists across all routes
  const { state, transcript, destination, audioLevel, isSpeaking, dismiss } = useVoiceAssistant();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <BirthdayCelebration />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />

      {/* Video ad — notifies Layout when its open state changes */}
      <VideoAdWidget onOpenChange={setVideoAdOpen} />

      {/* Premium voice orb overlay — activated by "Hey Connect" */}
      <VoiceOrb
        state={state}
        transcript={transcript}
        destination={destination}
        audioLevel={audioLevel}
        isSpeaking={isSpeaking}
        dismiss={dismiss}
      />
    </div>
  );
}
