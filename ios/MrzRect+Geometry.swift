import CoreGraphics
import NitroModules

/// `MrzRect` uses normalized coordinates of the upright frame with the origin at
/// the top-left. Vision uses normalized coordinates with the origin at the
/// bottom-left.
extension MrzRect {
  /// Allows for floating-point error in `x + width` and `y + height`.
  private static let tolerance = 1e-9

  func validateAsRegionOfInterest() throws {
    let isFinite = [x, y, width, height].allSatisfy { $0.isFinite }
    guard
      isFinite, x >= 0, y >= 0, width > 0, height > 0,
      x + width <= 1 + Self.tolerance, y + height <= 1 + Self.tolerance
    else {
      throw RuntimeError.error(
        withMessage: "regionOfInterest must lie inside the frame (normalized 0-1).")
    }
  }

  /// Converts to Vision coordinates, clamped so Vision never rejects the region.
  func toVisionRect() -> CGRect {
    let clampedWidth = min(width, 1 - x)
    let clampedHeight = min(height, 1 - y)
    return CGRect(
      x: x,
      y: 1 - y - clampedHeight,
      width: clampedWidth,
      height: clampedHeight
    )
  }

  /// Converts a Vision bounding box, which is relative to the processed
  /// `region`, to the whole upright frame.
  init(visionBox box: CGRect, in region: CGRect) {
    let left = region.minX + box.minX * region.width
    let bottom = region.minY + box.minY * region.height
    let width = box.width * region.width
    let height = box.height * region.height
    self.init(
      x: Double(left),
      y: Double(1 - bottom - height),
      width: Double(width),
      height: Double(height)
    )
  }
}
