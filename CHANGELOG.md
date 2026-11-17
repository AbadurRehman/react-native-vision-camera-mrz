# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org).

## 0.2.0

First release: on-device passport (TD3) MRZ scanning for VisionCamera v5.

### Scanner

- `<MrzScanner />`: a ready-made scanner with a passport-shaped guide, hints, a light button and translatable texts. It requests camera permission and reports one result.
- `useMrzScanner`: the same scanning as a frame output for your own `<Camera />`.
- `onStatusChange` reports `searching`, `reading` and `done`, for haptics or timing scans.
- Results are reported only when every check digit matches and the same MRZ is read in 3 of the last 10 frames (configurable). The names line, which has no check digits, is decided by a character-by-character vote across those frames.
- Repairs common OCR damage: missing `<` fillers, lines split into several pieces, and look-alike characters such as `O` and `0`.
- `MrzScanSession` runs the same confirmation on OCR output from any source, without a camera.

### Text recognition

- Native text recognizer for frame processors, built on Nitro Modules: Apple Vision on iOS, ML Kit with a bundled model on Android. It works offline from the first launch.
- The frame is turned upright and cropped to the region of interest before recognition, which makes recognition faster and keeps small text readable.

### Parser

- `parseMrz` validates and parses TD3 MRZ text from any source and never throws.
- Checks all five ICAO 9303 check digits, dates, sex and the issuing state and nationality codes, including one-letter codes such as `D` for Germany.
- Resolves two-digit years for birth and expiry dates, with `referenceDate` for reproducible results.
- `computeCheckDigit` for ICAO 9303 check digits.
