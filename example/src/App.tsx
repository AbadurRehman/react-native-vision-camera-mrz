import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import {
  parseMrz,
  useMrzTextRecognizer,
  type MrzParseResult,
  type MrzRect,
  type MrzTextLine,
} from 'react-native-vision-camera-mrz';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * A full-width band in the lower part of the frame, where the MRZ sits when the
 * passport's data page fills the screen. On portrait phones the preview fills
 * the screen height exactly, so these vertical fractions match the overlay.
 */
const SCAN_REGION: MrzRect = { x: 0, y: 0.55, width: 1, height: 0.3 };

interface Scan {
  lines: MrzTextLine[];
  durationMs: number;
}

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
  const recognizer = useMrzTextRecognizer({ regionOfInterest: SCAN_REGION });
  const [scan, setScan] = useState<Scan>();

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet';
      try {
        const start = performance.now();
        const lines = recognizer.recognizeText(frame);
        scheduleOnRN(setScan, { lines, durationMs: performance.now() - start });
      } finally {
        frame.dispose();
      }
    },
  });

  const mrz = useMemo(
    () => (scan === undefined ? undefined : parseMrz(pickMrzLines(scan.lines))),
    [scan]
  );

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={true}
        outputs={[frameOutput]}
      />
      <View pointerEvents="none" style={styles.scanRegion} />
      <View style={styles.panel}>
        <Text style={styles.status}>{describeMrz(mrz)}</Text>
        {scan !== undefined && (
          <>
            <Text style={styles.meta}>
              {scan.lines.length} line(s) · {Math.round(scan.durationMs)} ms
            </Text>
            {scan.lines.slice(-4).map((line, index) => (
              <Text key={index} style={styles.line} numberOfLines={1}>
                {line.text}
              </Text>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Naive pick for this demo: the last two long lines. Phase 4 replaces it with
 * proper MRZ detection and agreement across several frames.
 */
function pickMrzLines(lines: readonly MrzTextLine[]): string[] {
  return lines
    .map((line) => line.text.replace(/\s/g, ''))
    .filter((text) => text.length >= 40)
    .slice(-2);
}

function describeMrz(result: MrzParseResult | undefined): string {
  if (result === undefined || !result.ok) {
    return 'Fit the passport data page in the screen, MRZ inside the box';
  }
  if (!result.valid) {
    return `MRZ read, ${result.issues.length} problem(s). Hold steady…`;
  }
  const { surname, givenNames, documentNumber } = result.fields;
  return `✓ ${surname}, ${givenNames} · ${documentNumber}`;
}

const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' });

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
  scanRegion: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${SCAN_REGION.y * 100}%`,
    height: `${SCAN_REGION.height * 100}%`,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  panel: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    padding: 12,
    gap: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  status: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: '#c9d1d9',
    fontSize: 12,
  },
  line: {
    color: 'white',
    fontFamily: MONOSPACE,
    fontSize: 11,
  },
});
