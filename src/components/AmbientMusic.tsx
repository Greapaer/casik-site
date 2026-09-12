import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui/Icon';

const STORAGE = 'noir-music-muted';
const VOLUME = 0.05; // very quiet ambient

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/music.mp3');
    audio.loop = true;
    audio.volume = VOLUME;
    audio.preload = 'auto';
  }
  return audio;
}

export function MusicToggle() {
  const [muted, setMuted] = useState(() => localStorage.getItem(STORAGE) === '1');
  const startedRef = useRef(false);

  useEffect(() => {
    const a = getAudio();
    a.volume = VOLUME;
    const start = () => {
      if (muted || startedRef.current) return;
      startedRef.current = true;
      a.play().catch(() => undefined);
    };

    start(); // try immediately on enter
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [muted]);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(STORAGE, next ? '1' : '0');
    const a = getAudio();
    if (next) {
      a.pause();
    } else {
      startedRef.current = true;
      a.volume = VOLUME;
      a.play().catch(() => undefined);
    }
  };

  return (
    <button
      className="music-toggle"
      onClick={toggle}
      aria-label={muted ? 'Play background music' : 'Mute background music'}
      title="Ambient music"
    >
      <Icon name={muted ? 'volumeOff' : 'volume'} size={18} />
    </button>
  );
}