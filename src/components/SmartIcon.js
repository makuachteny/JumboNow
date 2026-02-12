import React from 'react';
import { Text, Image, StyleSheet } from 'react-native';

/**
 * SmartIcon renders either an Image (if value is a URL) or emoji Text.
 *
 * Props:
 * - value: string — emoji character OR image URL (http/https)
 * - size: number — width & height for image, fontSize for emoji (default 24)
 * - style: optional extra styles for the container element
 * - borderRadius: number — border radius for images (default size * 0.33)
 */
export default function SmartIcon({ value, size = 24, style, borderRadius }) {
  if (!value) return null;

  const isUrl = typeof value === 'string' && value.startsWith('https://');

  if (isUrl) {
    const br = borderRadius !== undefined ? borderRadius : Math.round(size * 0.33);
    return (
      <Image
        source={{ uri: value }}
        style={[{ width: size, height: size, borderRadius: br }, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <Text style={[{ fontSize: size * 0.85 }, style]}>
      {value}
    </Text>
  );
}
