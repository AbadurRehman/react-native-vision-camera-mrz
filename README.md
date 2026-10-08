# react-native-vision-camera-mrz

Scan the machine-readable zone (MRZ) of passports with [VisionCamera v5](https://visioncamera.margelo.com). Runs fully on-device with no network calls and no license key.

> **Work in progress.** Not published to npm yet. Planned for v0.1: passports (TD3), parsed and validated against ICAO 9303 check digits.

Unlike standalone MRZ scanners that ship their own camera view, this is a **frame processor plugin**: add MRZ scanning to the VisionCamera you already use for photos, barcodes or face detection.

_Community plugin, not affiliated with Margelo or the VisionCamera team._

## Requirements

- `react-native-vision-camera` 5.x (with `react-native-vision-camera-worklets` and `react-native-worklets` for frame processors)
- `react-native-nitro-modules`

## Installation

```sh
npm install react-native-vision-camera-mrz
```

## Usage

Coming soon. The API will be a `useMrzScanner()` hook plus a drop-in `<MrzScanner />` component.

## Supported documents

| Document | MRZ format | Status |
| --- | --- | --- |
| Passports | TD3 (2 × 44) | Planned for v0.1 |
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
