import { describe, expect, it } from '@jest/globals';
import { isCanceledCameraOperation } from '../cameraErrors';

describe('isCanceledCameraOperation', () => {
  it('recognizes a canceled CameraX command', () => {
    expect(
      isCanceledCameraOperation(
        new Error(
          'androidx.camera.core.CameraControl$OperationCanceledException: Camera is not active.'
        )
      )
    ).toBe(true);
    const named = new Error('Camera is not active.');
    named.name = 'OperationCanceledException';
    expect(isCanceledCameraOperation(named)).toBe(true);
  });

  it.each([
    new Error('Camera permission denied'),
    new Error('Camera is in use by another app'),
    'OperationCanceledException',
    null,
    undefined,
  ])('does not hide %p', (error) => {
    expect(isCanceledCameraOperation(error)).toBe(false);
  });
});
