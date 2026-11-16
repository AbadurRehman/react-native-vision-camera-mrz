import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MrzScanner,
  type MrzDate,
  type MrzScanResult,
  type MrzScanStatus,
  type MrzScannerHandle,
} from 'react-native-vision-camera-mrz';

interface Scan {
  result: MrzScanResult;
  /** Seconds from the MRZ first coming into view to the confirmed result. */
  seconds: number | undefined;
}

export default function App() {
  const scanner = useRef<MrzScannerHandle>(null);
  const [scan, setScan] = useState<Scan>();
  const [error, setError] = useState<string>();
  const [showMrzBoxes, setShowMrzBoxes] = useState(true);
  // When an MRZ first came into view in the current scan.
  const readingStartedAt = useRef<number>(undefined);

  const handleStatusChange = useCallback((status: MrzScanStatus) => {
    if (status === 'reading' && readingStartedAt.current === undefined) {
      readingStartedAt.current = performance.now();
    }
  }, []);

  const handleResult = useCallback((result: MrzScanResult) => {
    const startedAt = readingStartedAt.current;
    setScan({
      result,
      seconds:
        startedAt === undefined
          ? undefined
          : (performance.now() - startedAt) / 1000,
    });
  }, []);

  const scanAgain = () => {
    readingStartedAt.current = undefined;
    setScan(undefined);
    setError(undefined);
    scanner.current?.reset();
  };

  return (
    <View style={styles.container}>
      <MrzScanner
        ref={scanner}
        style={StyleSheet.absoluteFill}
        onResult={handleResult}
        onStatusChange={handleStatusChange}
        onError={(scanError) => setError(scanError.message)}
        showMrzBoxes={showMrzBoxes}
        fallback={<PermissionMessage />}
      />
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: showMrzBoxes }}
        onPress={() => setShowMrzBoxes((show) => !show)}
        style={styles.debugToggle}
      >
        <Text style={styles.debugToggleText}>
          {showMrzBoxes ? 'Hide MRZ boxes' : 'Show MRZ boxes'}
        </Text>
      </Pressable>
      {error !== undefined && scan === undefined && (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setError(undefined)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText} numberOfLines={3}>
            {error}
          </Text>
        </Pressable>
      )}
      {scan !== undefined && <ResultCard scan={scan} onScanAgain={scanAgain} />}
    </View>
  );
}

function ResultCard({
  scan,
  onScanAgain,
}: {
  scan: Scan;
  onScanAgain: () => void;
}) {
  const { fields } = scan.result;
  const rows: Array<[string, string]> = [
    ['Surname', fields.surname],
    ['Given names', fields.givenNames || '—'],
    ['Document number', fields.documentNumber],
    ['Nationality', fields.nationality],
    ['Date of birth', formatDate(fields.dateOfBirth)],
    ['Sex', fields.sex ?? '—'],
    ['Date of expiry', formatDate(fields.dateOfExpiry)],
    ['Issuing state', fields.issuingState],
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>✓ Passport scanned</Text>
      {scan.seconds !== undefined && (
        <Text style={styles.cardMeta}>Read in {scan.seconds.toFixed(1)} s</Text>
      )}
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
      <Pressable style={styles.button} onPress={onScanAgain}>
        <Text style={styles.buttonText}>Scan again</Text>
      </Pressable>
    </View>
  );
}

function PermissionMessage() {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>
        Camera access is needed to scan passports.
      </Text>
      <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
        <Text style={styles.buttonText}>Open Settings</Text>
      </Pressable>
    </View>
  );
}

function formatDate(date: MrzDate): string {
  return date.iso ?? date.raw;
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
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  debugToggle: {
    position: 'absolute',
    top: 60,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  debugToggleText: {
    color: 'white',
    fontSize: 13,
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    padding: 20,
    gap: 8,
    borderRadius: 16,
    backgroundColor: 'white',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e7e34',
  },
  cardMeta: {
    color: '#57606a',
    fontSize: 13,
    marginBottom: 4,
  },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(180, 35, 24, 0.9)',
  },
  errorText: {
    color: 'white',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: '#57606a',
    fontSize: 14,
  },
  value: {
    flexShrink: 1,
    color: '#1f2328',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  button: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1f6feb',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
