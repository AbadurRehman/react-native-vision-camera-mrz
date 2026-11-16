# react-native-vision-camera-mrz

Scan the machine-readable zone (MRZ) of passports with [VisionCamera v5](https://visioncamera.margelo.com). Runs fully on-device with no network calls and no license key.

> **Work in progress.** Not published to npm yet. v0.1 scans passports (TD3) and validates them against the ICAO 9303 check digits.

Unlike standalone MRZ scanners that ship their own camera view, this is a **frame processor plugin**: add MRZ scanning to the VisionCamera you already use for photos, barcodes or face detection.

_Community plugin, not affiliated with Margelo or the VisionCamera team._

## Requirements

- `react-native-vision-camera` 5.x with `react-native-vision-camera-worklets` and `react-native-worklets` (for frame processors)
- `react-native-nitro-modules`
- iOS 15.1+, Android 7.0+ (API 24)

## Installation

```sh
npm install react-native-vision-camera-mrz
```

Add the worklets Babel plugin if you haven't already (`babel.config.js`):

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

Add the camera permission: `NSCameraUsageDescription` in `Info.plist` on iOS, `android.permission.CAMERA` in `AndroidManifest.xml` on Android.

## Usage

### Drop-in scanner

`<MrzScanner />` shows the camera with a passport-shaped guide, hints and a torch button, asks for camera permission, and calls `onResult` once:

```tsx
import { MrzScanner } from 'react-native-vision-camera-mrz';

<MrzScanner
  style={{ flex: 1 }}
  onResult={(result) => {
    const { surname, givenNames, documentNumber, dateOfBirth } = result.fields;
    // dateOfBirth.iso → '1974-08-12'
  }}
/>;
```

Scanning stops after a result. Call `reset()` on its `ref` to scan another document. Translate the texts with `labels`, and show what was detected with `showMrzBoxes` while integrating.

### Your own camera screen

`useMrzScanner` does the same work and returns a frame output for your own `<Camera />`:

```tsx
import { Camera } from 'react-native-vision-camera';
import { useMrzScanner } from 'react-native-vision-camera-mrz';

const { frameOutput, state, reset } = useMrzScanner({
  onResult: (result) => console.log(result.fields.documentNumber),
});

return <Camera device="back" isActive outputs={[frameOutput]} />;
// state.status: 'searching' | 'reading' | 'done'
```

### How a scan is confirmed

OCR rarely reads an MRZ perfectly: it drops fillers (`<`), splits lines into pieces, and confuses `O` and `0`. For each frame, the scanner joins the pieces of each row, rebuilds both MRZ lines from the fixed passport layout, and keeps the frame only if every check digit matches.

A result is reported once the same second line has been read in 3 of the last 10 frames (`requiredAgreement`, `agreementWindow`). The first line (names and issuing state) has no check digits, so it is decided by a character-by-character vote across those frames, and the issuing state and nationality must be known country or organization codes.

Already have OCR output from elsewhere, such as a photo? Feed the lines of each image to `new MrzScanSession().process(lines)`; it does the same work without a camera.

### Reading text in a frame processor

For full control, `useMrzTextRecognizer` gives you the raw text recognizer: Apple Vision on iOS, ML Kit with a bundled model on Android (works offline, no download on first launch).

```tsx
import { useFrameOutput } from 'react-native-vision-camera';
import { useMrzTextRecognizer } from 'react-native-vision-camera-mrz';

const recognizer = useMrzTextRecognizer({
  // Normalized (0-1) region of the upright frame; only text inside is returned.
  regionOfInterest: { x: 0, y: 0.55, width: 1, height: 0.3 },
});

const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet';
    try {
      const lines = recognizer.recognizeText(frame); // [{ text, boundingBox }]
      // Send `lines` to JS with scheduleOnRN(...) and pass them to parseMrz.
    } finally {
      frame.dispose();
    }
  },
});
```

Lines come back in reading order. Bounding boxes are normalized to the upright frame (origin top-left, not mirrored).

### Parsing an MRZ

`parseMrz` validates and parses MRZ text from any source, such as OCR output or manual entry. It cleans up OCR noise (case, spaces, look-alike characters such as `O`/`0` in date fields) and never throws.

```ts
import { parseMrz } from 'react-native-vision-camera-mrz';

const result = parseMrz([
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
]);

if (!result.ok) {
  // Not a supported MRZ: result.error.code, e.g. 'UNSUPPORTED_FORMAT'
} else if (!result.valid) {
  // Read, but something is wrong: result.issues, e.g. a check digit mismatch
  // or an unknown country code ('UNKNOWN_CODE')
} else {
  result.fields.surname; // 'ERIKSSON'
  result.fields.givenNames; // 'ANNA MARIA'
  result.fields.documentNumber; // 'L898902C3'
  result.fields.dateOfBirth.iso; // '1974-08-12'
}
```

Two-digit years are resolved against today: birth dates take the most recent year that isn't in the future, and expiry dates may be up to 20 years ahead. Pass `{ referenceDate }` for reproducible results.

> The result contains personal data. Don't log it or send it anywhere without the document holder's consent.

## Supported documents

| Document | MRZ format | Status |
| --- | --- | --- |
| Passports | TD3 (2 × 44) | Supported |
| ID cards, residence permits | TD1 (3 × 30) | Planned |
| Visas | MRV-A / MRV-B | Planned |

Out of scope: documents without an MRZ, such as US driver's licenses (PDF417 barcode) or India's Aadhaar (QR code).

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
