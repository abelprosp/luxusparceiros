import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { ScanBarcode, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/theme';

interface IccidScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (iccid: string) => void;
}

const ICCID_PATTERN = /^89\d{17,20}$/;

export function IccidScannerModal({
  visible,
  onClose,
  onScanned,
}: IccidScannerModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setError('');
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;

    const iccid = data.replace(/\D/g, '');
    if (!ICCID_PATTERN.test(iccid)) {
      setScanned(true);
      setError('O código lido não parece ser um ICCID. Aponte para o código que começa com 89.');
      return;
    }

    setScanned(true);
    onScanned(iccid);
    onClose();
  };

  const scanAgain = () => {
    setError('');
    setScanned(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Escanear ICCID</Text>
            <Text style={styles.subtitle}>Aponte para o código de barras do chip</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar leitor"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.messageContainer}>
            <Text style={styles.message}>Verificando acesso à câmera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.messageContainer}>
            <ScanBarcode size={56} color={colors.primary} />
            <Text style={styles.message}>
              Permita o acesso à câmera para ler o código de barras do chip.
            </Text>
            <Button title="Permitir câmera" onPress={requestPermission} />
            <Button title="Voltar" variant="ghost" onPress={onClose} />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'code39', 'code93', 'itf14', 'ean13', 'qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.instruction}>Mantenha o código dentro da área</Text>
            </View>
            {error ? (
              <View style={styles.errorPanel}>
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Tentar novamente" size="sm" onPress={scanAgain} />
              </View>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  title: {
    ...typography.h3,
    color: '#FFFFFF',
  },
  subtitle: {
    ...typography.caption,
    color: '#D1D5DB',
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.sm,
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  message: {
    ...typography.body,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '86%',
    height: 180,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  instruction: {
    ...typography.label,
    color: '#FFFFFF',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  errorPanel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11, 11, 11, 0.92)',
  },
  errorText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
