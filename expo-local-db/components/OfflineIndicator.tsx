/**
 * Telegram-style connection status banner.
 * Slides down when offline, shows "Connecting..." / "Updating..." states.
 */

import { TG } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useNetwork } from "../hooks/useNetwork";

export function OfflineIndicator() {
  const { isConnected, isInternetReachable } = useNetwork();
  const translateY = useRef(new Animated.Value(-50)).current;

  const isOffline = !isConnected;
  const isWaiting = isConnected && isInternetReachable === false;

  const shouldShow = isOffline || isWaiting;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: shouldShow ? 0 : -50,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  }, [shouldShow, translateY]);

  const label = isOffline
    ? "Waiting for network..."
    : "Connecting...";

  const bgColor = isOffline ? TG.red : TG.orange;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bgColor, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginRight: 8,
  },
  text: {
    color: TG.textWhite,
    fontSize: 13,
    fontWeight: "600",
  },
});
