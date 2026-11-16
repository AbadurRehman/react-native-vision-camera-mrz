/**
 * Android's CameraX rejects a camera control command (torch, zoom, focus) with
 * `CameraControl.OperationCanceledException` when the camera is not running
 * yet, has just stopped, or a newer command replaced it. That is expected while
 * the camera starts and stops, and harmless: the command is simply not applied.
 */
const CANCELED_CAMERA_OPERATION = /OperationCanceledException/;

/** `true` for a harmless "camera command was canceled" error. */
export function isCanceledCameraOperation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    CANCELED_CAMERA_OPERATION.test(error.name) ||
    CANCELED_CAMERA_OPERATION.test(error.message)
  );
}
