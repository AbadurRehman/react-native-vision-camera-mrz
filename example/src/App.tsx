import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MrzScanner,
  type MrzDate,
  type MrzScanResult,
  type MrzScannerHandle,
} from 'react-native-vision-camera-mrz';

export default function App() {
  const scanner = useRef<MrzScannerHandle>(null);
  const [result, setResult] = useState<MrzScanResult>();
  const [showMrzBoxes, setShowMrzBoxes] = useState(true);

  const scanAgain = () => {
    setResult(undefined);
    scanner.current?.reset();
  };

  return (
    <View style={styles.container}>
      <MrzScanner
        ref={scanner}
        style={StyleSheet.absoluteFill}
        onResult={setResult}
        onError={(error) => console.warn('MRZ scanner error:', error.message)}
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
      {result !== undefined && (
        <ResultCard result={result} onScanAgain={scanAgain} />
      )}
    </View>
  );
}

function ResultCard({
  result,
  onScanAgain,
}: {
  result: MrzScanResult;
  onScanAgain: () => void;
}) {
  const { fields } = result;
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
    marginBottom: 4,
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
