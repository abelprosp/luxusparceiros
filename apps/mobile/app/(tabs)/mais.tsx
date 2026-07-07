import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Package,
  Store,
  FileText,
  Headphones,
  DollarSign,
  User,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, radius } from '@/theme';

interface MenuItem {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
}

export default function MaisScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const menuItems: MenuItem[] = [
    {
      title: 'Filiais',
      subtitle: 'Lojas e unidades',
      icon: <Store size={22} color={colors.primary} />,
      href: '/(tabs)/filiais',
    },
    {
      title: 'Estoque',
      subtitle: 'Linhas e chips disponíveis',
      icon: <Package size={22} color={colors.primary} />,
      href: '/(tabs)/estoque',
    },
    {
      title: 'Solicitações',
      subtitle: 'Ativações, bloqueios e mais',
      icon: <FileText size={22} color={colors.primary} />,
      href: '/(tabs)/solicitacoes',
    },
    {
      title: 'Chamados',
      subtitle: 'Suporte e atendimento',
      icon: <Headphones size={22} color={colors.primary} />,
      href: '/(tabs)/chamados',
    },
    {
      title: 'Comissões',
      subtitle: 'Extrato e previsões',
      icon: <DollarSign size={22} color={colors.primary} />,
      href: '/(tabs)/comissoes',
    },
    {
      title: 'Perfil',
      subtitle: 'Dados, senha e configurações',
      icon: <User size={22} color={colors.primary} />,
      href: '/(tabs)/perfil',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mais</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {user?.name ?? 'Parceiro'}
          </Text>
        </View>

        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.href}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => router.push(item.href as never)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}12` }]}>
                {item.icon}
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.error }]}
          onPress={logout}
        >
          <LogOut size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    fontSize: 26,
  },
  subtitle: {
    ...typography.bodySmall,
  },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    ...typography.label,
    fontWeight: '600',
  },
  menuSubtitle: {
    ...typography.caption,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  logoutText: {
    ...typography.label,
    fontWeight: '600',
  },
});
