import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { isValidRegion } from '../recognizer/options';
import { isCanceledCameraOperation } from './cameraErrors';
import {
  computePassportGuide,
  frameRectToViewRect,
  isUsableSize,
  viewRectToFrameRect,
  type PassportGuide,
  type Size,
} from './geometry';
import type { MrzScanResult, MrzScanStatus } from './scanSession';
import { DEFAULT_SCAN_REGION, useMrzScanner } from './useMrzScanner';

/** Texts shown by the scanner; override them to translate. */
export interface MrzScannerLabels {
  searching: string;
  reading: string;
  done: string;
  turnOnLight: string;
  turnOffLight: string;
}

const DEFAULT_LABELS: MrzScannerLabels = {
  searching: 'Place the passport photo page inside the frame',
  reading: 'Hold steady…',
  done: 'Passport scanned',
  turnOnLight: 'Light on',
  turnOffLight: 'Light off',
};

export interface MrzScannerHandle {
  /** Clears a finished scan and starts scanning again. */
  reset(): void;
}

export interface MrzScannerProps {
  /** Called once, when a valid MRZ has been confirmed. Scanning then stops. */
  onResult: (result: MrzScanResult) => void;
  /**
   * Called when the camera or text recognition fails. Without it, camera
   * errors are logged with `console.error`.
   */
  onError?: (error: Error) => void;
  /**
   * Called with the current status and whenever it changes: `searching` (no
   * MRZ in view), `reading` (an MRZ is in view but not confirmed yet) or
   * `done`. Useful for haptics or for measuring how long scans take.
   */
  onStatusChange?: (status: MrzScanStatus) => void;
  /**
   * Set to `false` to pause the camera, e.g. while the screen is not visible.
   * @default true
   */
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  labels?: Partial<MrzScannerLabels>;
  /** @default true (shown only on devices with a torch) */
  showTorchButton?: boolean;
  /** Draws the detected MRZ lines; useful while integrating. @default false */
  showMrzBoxes?: boolean;
  /**
   * How many recent frames must read the same valid MRZ.
   * @default 3
   */
  requiredAgreement?: number;
  /**
   * How many recent frames to consider.
   * @default 10
   */
  agreementWindow?: number;
  /** Shown instead of the camera when camera permission was denied. */
  fallback?: ReactNode;
  /** Used to find the scanner in tests. */
  testID?: string;
  ref?: Ref<MrzScannerHandle>;
}

/**
 * A ready-made passport scanner: camera, passport-shaped guide, hints and a
 * torch button. Requests camera permission when needed.
 *
 * @example
 * <MrzScanner
 *   style={{ flex: 1 }}
 *   onResult={(result) => navigation.navigate('Details', result.fields)}
 * />
 */
export function MrzScanner({
  onResult,
  onError,
  onStatusChange,
  isActive = true,
  style,
  labels,
  showTorchButton = true,
  showMrzBoxes = false,
  requiredAgreement,
  agreementWindow,
  fallback = null,
  testID,
  ref,
}: MrzScannerProps) {
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();
  const device = useCameraDevice('back');
  const [viewSize, setViewSize] = useState<Size>();
  const [frameSize, setFrameSize] = useState<Size>();
  // Undefined until the user first uses the light: Android rejects torch
  // commands sent before the camera has started.
  const [torchMode, setTorchMode] = useState<'on' | 'off'>();
  const isTorchOn = torchMode === 'on';

  useEffect(() => {
    if (canRequestPermission) {
      requestPermission();
    }
  }, [canRequestPermission, requestPermission]);

  const guide = useMemo(
    () => (isUsableSize(viewSize) ? computePassportGuide(viewSize) : undefined),
    [viewSize]
  );

  // Read only the area around the guide's MRZ zone once the frame size is known.
  const regionOfInterest = useMemo(() => {
    if (
      guide === undefined ||
      !isUsableSize(viewSize) ||
      !isUsableSize(frameSize)
    ) {
      return DEFAULT_SCAN_REGION;
    }
    const region = viewRectToFrameRect(guide.scanArea, viewSize, frameSize);
    return isValidRegion(region) ? region : DEFAULT_SCAN_REGION;
  }, [guide, viewSize, frameSize]);

  // The latest callbacks, without restarting the camera when they change.
  const callbacks = useRef({ onResult, onError, onStatusChange });
  useEffect(() => {
    callbacks.current = { onResult, onError, onStatusChange };
  });

  const handleResult = useCallback((result: MrzScanResult) => {
    // The camera stops after a scan, which turns the light off.
    setTorchMode(undefined);
    callbacks.current.onResult(result);
  }, []);

  const handleCameraError = useCallback((error: Error) => {
    if (isCanceledCameraOperation(error)) {
      return;
    }
    const report = callbacks.current.onError;
    if (report === undefined) {
      console.error(error);
    } else {
      report(error);
    }
  }, []);

  const scanner = useMrzScanner({
    onResult: handleResult,
    onError,
    regionOfInterest,
    isActive: isActive && hasPermission,
    requiredAgreement,
    agreementWindow,
  });
  const { status, mrzBoxes, frameSize: scannedFrameSize } = scanner.state;

  useEffect(() => {
    callbacks.current.onStatusChange?.(status);
  }, [status]);

  useEffect(() => {
    if (scannedFrameSize !== undefined) {
      setFrameSize(scannedFrameSize);
    }
  }, [scannedFrameSize]);

  useImperativeHandle(ref, () => ({ reset: scanner.reset }), [scanner.reset]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewSize((previous) =>
      previous?.width === width && previous.height === height
        ? previous
        : { width, height }
    );
  }, []);

  if (!hasPermission) {
    // While the permission prompt is up, show nothing rather than the fallback.
    return (
      <View testID={testID} style={[styles.container, style]}>
        {canRequestPermission ? null : fallback}
      </View>
    );
  }
  if (device === undefined) {
    // Cameras are still being listed.
    return (
      <View
        testID={testID}
        style={[styles.container, style]}
        onLayout={handleLayout}
      />
    );
  }

  const text = { ...DEFAULT_LABELS, ...labels };
  const hasTorch = device.hasTorch;

  return (
    <View
      testID={testID}
      style={[styles.container, style]}
      onLayout={handleLayout}
    >
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive && status !== 'done'}
        outputs={[scanner.frameOutput]}
        torchMode={hasTorch ? torchMode : undefined}
        onError={handleCameraError}
      />
      {guide !== undefined && <GuideOverlay guide={guide} status={status} />}
      {showMrzBoxes &&
        isUsableSize(viewSize) &&
        isUsableSize(frameSize) &&
        mrzBoxes.map((box, index) => {
          const rect = frameRectToViewRect(box, viewSize, frameSize);
          return (
            <View
              key={index}
              testID={testID === undefined ? undefined : `${testID}-mrz-line`}
              style={[
                styles.mrzBox,
                {
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              ]}
            />
          );
        })}
      {guide !== undefined && (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.hint,
            { top: guide.page.y + guide.page.height + HINT_SPACING },
          ]}
        >
          {text[status]}
        </Text>
      )}
      {showTorchButton && hasTorch && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: isTorchOn }}
          onPress={() => setTorchMode(isTorchOn ? 'off' : 'on')}
          style={styles.torchButton}
        >
          <Text style={styles.torchText}>
            {isTorchOn ? text.turnOffLight : text.turnOnLight}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const HINT_SPACING = 16;
const MASK_COLOR = 'rgba(0, 0, 0, 0.55)';
const STATUS_COLORS: Record<MrzScanStatus, string> = {
  searching: '#ffffff',
  reading: '#f2c94c',
  done: '#27ae60',
};

/** Dims everything outside the passport outline and marks the MRZ zone. */
function GuideOverlay({
  guide,
  status,
}: {
  guide: PassportGuide;
  status: MrzScanStatus;
}) {
  const { page, mrzZone } = guide;
  const color = STATUS_COLORS[status];
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <View style={[styles.mask, styles.maskTop, { height: page.y }]} />
      <View
        style={[styles.mask, styles.maskBottom, { top: page.y + page.height }]}
      />
      <View
        style={[
          styles.mask,
          styles.maskLeft,
          { top: page.y, width: page.x, height: page.height },
        ]}
      />
      <View
        style={[
          styles.mask,
          styles.maskRight,
          { top: page.y, left: page.x + page.width, height: page.height },
        ]}
      />
      <View
        style={[
          styles.page,
          {
            left: page.x,
            top: page.y,
            width: page.width,
            height: page.height,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.mrzLine,
          {
            left: mrzZone.x + 12,
            top: mrzZone.y,
            width: mrzZone.width - 24,
            borderColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  mask: {
    position: 'absolute',
    backgroundColor: MASK_COLOR,
  },
  maskTop: {
    top: 0,
    left: 0,
    right: 0,
  },
  maskBottom: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  maskLeft: {
    left: 0,
  },
  maskRight: {
    right: 0,
  },
  page: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 14,
  },
  mrzLine: {
    position: 'absolute',
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  passThrough: {
    pointerEvents: 'none',
  },
  mrzBox: {
    position: 'absolute',
    pointerEvents: 'none',
    borderWidth: 2,
    borderColor: '#27ae60',
    borderRadius: 4,
  },
  hint: {
    position: 'absolute',
    left: 24,
    right: 24,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  torchButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  torchText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
