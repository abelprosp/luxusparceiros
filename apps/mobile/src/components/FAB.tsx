import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { radius } from '@/theme';

interface FABProps {
  href: Href;
  onPress?: () => void;
}

export function FAB({ href, onPress }: FABProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: colors.primary }]}
      onPress={onPress ?? (() => router.push(href))}
      activeOpacity={0.85}
    >
      <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
