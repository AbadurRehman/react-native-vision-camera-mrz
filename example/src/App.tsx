import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import { createMrzPlugin } from 'react-native-vision-camera-mrz';
import { scheduleOnRN } from 'react-native-worklets';

export default function App() {
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();

  useEffect(() => {
    if (canRequestPermission) requestPermission();
  }, [canRequestPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera access is needed to scan.</Text>
        <Pressable
          style={styles.button}
          onPress={() =>
            canRequestPermission ? requestPermission() : Linking.openSettings()
          }
        >
          <Text style={styles.buttonText}>
            {canRequestPermission ? 'Allow camera' : 'Open Settings'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return <ScannerScreen />;
}

function ScannerScreen() {
  const plugin = useMemo(() => createMrzPlugin(), []);
  const [frameInfo, setFrameInfo] = useState<string>();

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet';
      try {
        // Phase 1 smoke test: the frame goes JS worklet -> native plugin -> back.
        const info = plugin.describeFrame(frame);
        scheduleOnRN(setFrameInfo, info);
      } finally {
        frame.dispose();
      }
    },
  });

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={true}
        outputs={[frameOutput]}
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {frameInfo
            ? `Native plugin sees ${frameInfo} frames`
            : 'Waiting for frames…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
  },
});
