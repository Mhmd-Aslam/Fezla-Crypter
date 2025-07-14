import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#1a1a2e' : '#f5f5f5',
          },
        }}
      />
      <StatusBar style="light" backgroundColor="#1a1a2e" translucent={false} />
    </>
  );
}