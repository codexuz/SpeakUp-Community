import { TG } from '@/constants/theme';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    GestureResponderEvent,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BAR_COUNT = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 1.5;
const BAR_MIN_H = 4;
const BAR_MAX_H = 28;
const BUTTON_SIZE = 42;

interface WaveformPlayerProps {
  uri: string | null;
  accentColor?: string;
  disabled?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

// Seeded pseudo-random generator for consistent waveforms per URI
function generateBars(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    hash = (hash * 16807 + 12345) | 0;
    const val = ((hash & 0x7fffffff) % 100) / 100;
    // Create a natural-looking waveform envelope
    const envelope = Math.sin((i / BAR_COUNT) * Math.PI) * 0.4 + 0.6;
    bars.push(BAR_MIN_H + val * envelope * (BAR_MAX_H - BAR_MIN_H));
  }
  return bars;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WaveformPlayer({
  uri,
  accentColor = TG.accent,
  disabled = false,
  onPlaybackStart,
  onPlaybackEnd,
}: WaveformPlayerProps) {
  const player = useAudioPlayer(uri ?? undefined);
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => generateBars(uri || 'default'), [uri]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(0);
  const seekProgressRef = useRef(0);
  const waveformLayoutRef = useRef({ x: 0, width: 0 });

  const progress =
    isSeeking
      ? seekProgress
      : status.duration > 0
        ? status.currentTime / status.duration
        : 0;

  // Reset to beginning when playback finishes so user can replay
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
      onPlaybackEnd?.();
    }
  }, [status.didJustFinish]);

  const handleTogglePlay = useCallback(() => {
    if (disabled || !uri) return;

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (status.playing) {
      player.pause();
    } else {
      onPlaybackStart?.();
      player.play();
    }
  }, [disabled, uri, status.playing, player]);

  const handleWaveformLayout = (e: LayoutChangeEvent) => {
    waveformLayoutRef.current = {
      x: e.nativeEvent.layout.x,
      width: e.nativeEvent.layout.width,
    };
  };

  const clampProgress = (clientX: number) => {
    const { width } = waveformLayoutRef.current;
    if (width <= 0) return 0;
    return Math.max(0, Math.min(1, clientX / width));
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (disabled || !uri || status.duration <= 0) return;
    const localX = e.nativeEvent.locationX;
    const p = clampProgress(localX);
    seekProgressRef.current = p;
    setIsSeeking(true);
    setSeekProgress(p);
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const localX = e.nativeEvent.locationX;
    const p = clampProgress(localX);
    seekProgressRef.current = p;
    setSeekProgress(p);
  };

  const handleTouchEnd = async () => {
    setIsSeeking(false);
    const seekTime = seekProgressRef.current * status.duration;
    await player.seekTo(seekTime);
  };

  const displayTime = status.playing || status.currentTime > 0
    ? formatTime(status.currentTime)
    : formatTime(status.duration);

  const totalTime = formatTime(status.duration);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* Play/Pause button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handleTogglePlay}
          activeOpacity={0.8}
          disabled={disabled || !uri}
          style={[styles.playButton, { backgroundColor: accentColor }]}
        >
          {status.playing ? (
            <Pause size={18} color="#fff" fill="#fff" />
          ) : (
            <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Waveform + time */}
      <View style={styles.rightSection}>
        <View
          style={styles.waveformContainer}
          onLayout={handleWaveformLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
          onResponderTerminate={handleTouchEnd}
        >
          {bars.map((h, i) => {
            const barProgress = (i + 0.5) / BAR_COUNT;
            const isActive = barProgress <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: isActive ? accentColor : `${accentColor}30`,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: accentColor }]}>
            {displayTime}
          </Text>
          <Text style={styles.timeSeparator}>/</Text>
          <Text style={styles.timeTextTotal}>{totalTime}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  containerDisabled: {
    opacity: 0.45,
  },
  playButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
    gap: 4,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_MAX_H + 4,
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 11,
    color: TG.textHint,
  },
  timeTextTotal: {
    fontSize: 12,
    color: TG.textHint,
  },
});
