import { Stack } from 'expo-router';

export default function SolicitacoesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nova" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
