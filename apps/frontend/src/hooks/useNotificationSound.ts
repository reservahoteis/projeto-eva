import { useEffect, useRef, useCallback } from 'react';

type NotificationSound = 'escalation' | 'message' | 'mention';

/**
 * Hook para gerenciar notificacoes sonoras usando Web Audio API
 * Gera sons sintetizados sem necessidade de arquivos externos
 */
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Inicializar AudioContext (precisa de interacao do usuario)
  const initializeAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume se estiver suspenso
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  // Gerar beep sintetizado
  const playBeep = useCallback((
    frequency: number = 440,
    duration: number = 200,
    volume: number = 0.3,
    type: OscillatorType = 'sine'
  ) => {
    const ctx = initializeAudioContext();
    if (!ctx) return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Fade in/out suave para evitar cliques
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [initializeAudioContext]);

  /**
   * Tocar som de escalacao (mais urgente - 3 beeps)
   */
  const playEscalationSound = useCallback(() => {
    const ctx = initializeAudioContext();
    if (!ctx) return;

    // Som urgente: 3 beeps agudos
    const frequencies = [880, 1100, 880]; // A5, C#6, A5
    const delays = [0, 150, 300];

    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        playBeep(freq, 100, 0.4, 'square');
      }, delays[i]);
    });
  }, [playBeep, initializeAudioContext]);

  /**
   * Tocar som de nova mensagem (1 beep suave)
   */
  const playMessageSound = useCallback(() => {
    playBeep(660, 150, 0.25, 'sine'); // E5, som mais suave
  }, [playBeep]);

  /**
   * Tocar som de mencao (2 beeps)
   */
  const playMentionSound = useCallback(() => {
    playBeep(880, 100, 0.3, 'sine');
    setTimeout(() => {
      playBeep(1100, 100, 0.3, 'sine');
    }, 120);
  }, [playBeep]);

  /**
   * Tocar som generico
   */
  const playSound = useCallback((type: NotificationSound = 'message') => {
    switch (type) {
      case 'escalation':
        playEscalationSound();
        break;
      case 'mention':
        playMentionSound();
        break;
      case 'message':
      default:
        playMessageSound();
        break;
    }
  }, [playEscalationSound, playMentionSound, playMessageSound]);

  /**
   * Verificar se o navegador suporta Web Audio API
   */
  const isSupported = typeof window !== 'undefined' &&
    (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    playSound,
    playEscalationSound,
    playMessageSound,
    playMentionSound,
    isSupported,
    initializeAudioContext, // Expor para inicializar manualmente apos interacao
  };
}

/**
 * Singleton para tocar sons fora de componentes React
 */
class NotificationSoundManager {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  private playBeep(
    frequency: number = 440,
    duration: number = 200,
    volume: number = 0.3,
    type: OscillatorType = 'sine'
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  playEscalation() {
    const frequencies = [880, 1100, 880];
    const delays = [0, 150, 300];

    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playBeep(freq, 100, 0.4, 'square');
      }, delays[i]);
    });
  }

  playMessage() {
    this.playBeep(660, 150, 0.25, 'sine');
  }

  playMention() {
    this.playBeep(880, 100, 0.3, 'sine');
    setTimeout(() => {
      this.playBeep(1100, 100, 0.3, 'sine');
    }, 120);
  }

  play(type: NotificationSound = 'message') {
    switch (type) {
      case 'escalation':
        this.playEscalation();
        break;
      case 'mention':
        this.playMention();
        break;
      case 'message':
      default:
        this.playMessage();
        break;
    }
  }
}

export const notificationSoundManager = new NotificationSoundManager();
