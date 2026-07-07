import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Redirect } from 'expo-router';
import { Mail, Lock, Fingerprint } from 'lucide-react-native';
import { validateEmail } from '@luxus/utils';
import { useAuth, getRememberEmail } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/services/api';
import { spacing, typography, radius } from '@/theme';

export default function LoginScreen() {
  const { login, loginWithBiometric, isAuthenticated, biometricAvailable, biometricEnabled } =
    useAuth();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    getRememberEmail().then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!validateEmail(email)) newErrors.email = 'E-mail inválido';
    if (!password) newErrors.password = 'Senha é obrigatória';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login({ email: email.trim(), password, rememberMe });
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !validateEmail(email)) {
      Alert.alert('E-mail', 'Informe um e-mail válido para recuperar a senha');
      return;
    }
    try {
      await authApi.forgotPassword(email.trim());
      Alert.alert('Enviado', 'Se o e-mail existir, você receberá instruções para redefinir a senha.');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao enviar recuperação');
    }
  };

  const handleBiometric = async () => {
    setBioLoading(true);
    try {
      await loginWithBiometric();
    } catch (err) {
      Alert.alert('Biometria', err instanceof Error ? err.message : 'Falha na autenticação');
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>L</Text>
          </View>
          <Text style={[styles.brand, { color: colors.text }]}>Luxus Parceiros</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Portal premium para parceiros
          </Text>
        </View>

        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Entrar na sua conta</Text>

          <Input
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            leftIcon={<Mail size={20} color={colors.textSecondary} />}
          />

          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            error={errors.password}
            leftIcon={<Lock size={20} color={colors.textSecondary} />}
          />

          <View style={styles.options}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: rememberMe ? colors.primary : colors.border,
                    backgroundColor: rememberMe ? colors.primary : 'transparent',
                  },
                ]}
              >
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.rememberText, { color: colors.text }]}>Lembrar-me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Esqueci a senha
              </Text>
            </TouchableOpacity>
          </View>

          <Button title="Entrar" onPress={handleLogin} loading={loading} fullWidth />

          {biometricAvailable && biometricEnabled && (
            <Button
              title="Entrar com biometria"
              variant="outline"
              onPress={handleBiometric}
              loading={bioLoading}
              fullWidth
              icon={<Fingerprint size={20} color={colors.primary} />}
            />
          )}
        </View>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          © 2026 Luxus Telefonia. Todos os direitos reservados.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brand: {
    ...typography.h1,
    fontSize: 26,
  },
  tagline: {
    ...typography.bodySmall,
  },
  form: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  formTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rememberText: {
    ...typography.bodySmall,
  },
  forgotText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  footer: {
    ...typography.caption,
    textAlign: 'center',
  },
});
