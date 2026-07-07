import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Lock,
  Fingerprint,
  Moon,
  Bell,
  Building2,
  CreditCard,
  Sun,
  Monitor,
} from 'lucide-react-native';
import { getInitials } from '@luxus/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi, profileApi, type UserProfile, type PartnerProfile } from '@/services/api';
import { Button, Input, Card } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing, typography, radius } from '@/theme';

export default function PerfilScreen() {
  const { user, logout, biometricAvailable, biometricEnabled, toggleBiometric } = useAuth();
  const { colors, mode, setMode, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [bankForm, setBankForm] = useState({ bankName: '', bankAgency: '', bankAccount: '', pixKey: '', pixKeyType: 'CPF' });
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    profileApi.get().then((r) => {
      if (r.success && r.data) {
        setProfile(r.data);
        setNotifications(r.data.notificationsEnabled ?? true);
      }
    });
  }, []);

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(passwords.current, passwords.new);
      Alert.alert('Sucesso', 'Senha alterada com sucesso');
      setShowPassword(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async () => {
    setLoading(true);
    try {
      const response = await profileApi.updatePartner(bankForm);
      if (response.success) Alert.alert('Sucesso', 'Dados bancários atualizados');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    await profileApi.update({ notificationsEnabled: value });
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !biometricAvailable) {
      Alert.alert('Indisponível', 'Biometria não disponível neste dispositivo');
      return;
    }
    await toggleBiometric(value);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Perfil" showBack />

        <View style={[styles.profileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials(user?.name ?? 'P')}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <Card title="Segurança" headerRight={<Lock size={18} color={colors.primary} />}>
          <SettingRow
            icon={<Fingerprint size={20} color={colors.primary} />}
            label="Biometria"
            subtitle="Login rápido e seguro"
            colors={colors}
            right={<Switch value={biometricEnabled} onValueChange={handleBiometricToggle} trackColor={{ true: colors.primary }} />}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.linkRow}>
            <Lock size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary }]}>Alterar senha</Text>
          </TouchableOpacity>
          {showPassword && (
            <View style={styles.passwordForm}>
              <Input label="Senha atual" value={passwords.current} onChangeText={(v) => setPasswords((p) => ({ ...p, current: v }))} secureTextEntry />
              <Input label="Nova senha" value={passwords.new} onChangeText={(v) => setPasswords((p) => ({ ...p, new: v }))} secureTextEntry />
              <Input label="Confirmar senha" value={passwords.confirm} onChangeText={(v) => setPasswords((p) => ({ ...p, confirm: v }))} secureTextEntry />
              <Button title="Salvar senha" onPress={handleChangePassword} loading={loading} fullWidth />
            </View>
          )}
        </Card>

        <Card title="Aparência">
          <View style={styles.themeRow}>
            {([
              { key: 'light' as const, icon: Sun, label: 'Claro' },
              { key: 'dark' as const, icon: Moon, label: 'Escuro' },
              { key: 'system' as const, icon: Monitor, label: 'Sistema' },
            ]).map(({ key, icon: Icon, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.themeOption, { backgroundColor: mode === key ? colors.primary : colors.surface, borderColor: mode === key ? colors.primary : colors.border }]}
                onPress={() => setMode(key)}
              >
                <Icon size={20} color={mode === key ? '#FFF' : colors.text} />
                <Text style={{ color: mode === key ? '#FFF' : colors.text, ...typography.caption }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card title="Notificações">
          <SettingRow
            icon={<Bell size={20} color={colors.primary} />}
            label="Notificações push"
            subtitle="Vendas, comissões e chamados"
            colors={colors}
            right={<Switch value={notifications} onValueChange={handleToggleNotifications} trackColor={{ true: colors.primary }} />}
          />
        </Card>

        <Card title="Dados bancários" headerRight={<Building2 size={18} color={colors.primary} />}>
          <Input label="Banco" value={bankForm.bankName} onChangeText={(v) => setBankForm((p) => ({ ...p, bankName: v }))} />
          <Input label="Agência" value={bankForm.bankAgency} onChangeText={(v) => setBankForm((p) => ({ ...p, bankAgency: v }))} />
          <Input label="Conta" value={bankForm.bankAccount} onChangeText={(v) => setBankForm((p) => ({ ...p, bankAccount: v }))} />
          <Input label="Chave PIX" value={bankForm.pixKey} onChangeText={(v) => setBankForm((p) => ({ ...p, pixKey: v }))} />
          <Button title="Salvar dados bancários" onPress={handleSaveBank} loading={loading} fullWidth variant="outline" />
        </Card>

        <Button title="Sair da conta" variant="danger" onPress={logout} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  subtitle,
  colors,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  colors: { text: string; textSecondary: string };
  right: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      {icon}
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  profileHeader: { alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  avatar: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  name: { ...typography.h3 },
  email: { ...typography.bodySmall },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  settingText: { flex: 1 },
  settingLabel: { ...typography.label, fontWeight: '500' },
  settingSub: { ...typography.caption },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  linkText: { ...typography.label, fontWeight: '600' },
  passwordForm: { gap: spacing.sm, marginTop: spacing.sm },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeOption: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
});
