import CoreGraphics
import CoreImage
import NitroModules
import Vision
import VisionCamera

/// Recognizes text in VisionCamera frames with Apple's Vision framework.
final class HybridMrzTextRecognizer: HybridMrzTextRecognizerSpec {
  /// The area to read, in normalized coordinates of the upright frame with the
  /// origin at the bottom-left (Core Image and Vision coordinates).
  private let region: CGRect

  /// One Core Image context for all recognizers: creating one is expensive.
  private static let ciContext = CIContext(options: [.cacheIntermediates: false])

  /**
   * Smallest text Vision looks for, as a share of the cropped image's height.
   * MRZ characters are about a tenth of the scan area's height when the
   * passport fills the guide; this leaves room for holding it further away.
   */
  private static let minimumTextHeight: Float = 0.02

  init(options: MrzTextRecognizerOptions) throws {
    if let regionOfInterest = options.regionOfInterest {
      try regionOfInterest.validateAsRegionOfInterest()
      region = regionOfInterest.toVisionRect()
    } else {
      region = CGRect(x: 0, y: 0, width: 1, height: 1)
    }
    super.init()
  }

  func recognizeText(frame: any HybridFrameSpec) throws -> [MrzTextLine] {
    guard let nativeFrame = frame as? any NativeFrame else {
      throw RuntimeError.error(withMessage: "The frame is not a VisionCamera frame.")
    }
    guard
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      throw RuntimeError.error(withMessage: "The frame has no image data. Was it already disposed?")
    }

    // Rotate the camera image upright and crop it to the region ourselves,
    // rather than passing the orientation and a region of interest to Vision:
    // that keeps the coordinate math unambiguous, and Vision measures
    // `minimumTextHeight` against the small cropped image.
    let upright = CIImage(cvPixelBuffer: pixelBuffer)
      .oriented(frame.orientation.visionOrientation)
      .movedToOrigin()
    let size = upright.extent.size
    let area = CGRect(
      x: region.minX * size.width,
      y: region.minY * size.height,
      width: region.width * size.width,
      height: region.height * size.height
    )
    .integral
    .intersection(upright.extent)
    guard !area.isNull, area.width >= 1, area.height >= 1 else {
      return []
    }
    let cropped = upright.cropped(to: area).movedToOrigin()

    // A new request per call keeps the recognizer free of shared mutable state.
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // MRZ text is not natural language; "correcting" it would introduce errors.
    request.usesLanguageCorrection = false
    request.minimumTextHeight = Self.minimumTextHeight

    let handler = VNImageRequestHandler(
      ciImage: cropped,
      orientation: .up,
      options: [.ciContext: Self.ciContext]
    )
    try handler.perform([request])

    // Where the cropped image lies in the upright frame (normalized).
    let normalizedArea = CGRect(
      x: area.minX / size.width,
      y: area.minY / size.height,
      width: area.width / size.width,
      height: area.height / size.height
    )
    return (request.results ?? [])
      .compactMap { observation -> MrzTextLine? in
        guard let candidate = observation.topCandidates(1).first else {
          return nil
        }
        let boundingBox = MrzRect(visionBox: observation.boundingBox, in: normalizedArea)
        return MrzTextLine(text: candidate.string, boundingBox: boundingBox)
      }
      .sorted(by: MrzTextLine.isInReadingOrder)
  }
}

extension CIImage {
  /// The same image with its extent's origin moved to (0, 0).
  fileprivate func movedToOrigin() -> CIImage {
    transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
  }
}

extension MrzTextLine {
  /// Top to bottom, then left to right.
  static func isInReadingOrder(_ first: MrzTextLine, _ second: MrzTextLine) -> Bool {
    let a = first.boundingBox
    let b = second.boundingBox
    return a.y == b.y ? a.x < b.x : a.y < b.y
  }
}

extension CameraOrientation {
  /// The EXIF orientation that turns the camera image upright.
  ///
  /// VisionCamera names the direction the image is turned; EXIF names the
  /// direction to turn it to display it. So `.left` ("turned 90° left", what
  /// CameraX reports as 90° and a portrait iPhone's landscape buffers are)
  /// is EXIF `.right` ("rotate 90° clockwise to display"), and vice versa.
  /// Mirroring is ignored: only the back camera is used, and its images are
  /// never mirrored.
  var visionOrientation: CGImagePropertyOrientation {
    switch self {
    case .up:
      return .up
    case .down:
      return .down
    case .left:
      return .right
    case .right:
      return .left
    }
  }
}
