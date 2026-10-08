import CoreGraphics
import NitroModules
import Vision
import VisionCamera

/// Recognizes text in VisionCamera frames with Apple's Vision framework.
final class HybridMrzTextRecognizer: HybridMrzTextRecognizerSpec {
  /// The area to process, in Vision coordinates (normalized, origin at the bottom-left).
  private let visionRegion: CGRect

  init(options: MrzTextRecognizerOptions) throws {
    if let region = options.regionOfInterest {
      try region.validateAsRegionOfInterest()
      visionRegion = region.toVisionRect()
    } else {
      visionRegion = CGRect(x: 0, y: 0, width: 1, height: 1)
    }
    super.init()
  }

  func recognizeText(frame: any HybridFrameSpec) throws -> [MrzTextLine] {
    guard let nativeFrame = frame as? any NativeFrame else {
      throw RuntimeError.error(withMessage: "The frame is not a VisionCamera frame.")
    }
    guard let sampleBuffer = nativeFrame.sampleBuffer else {
      throw RuntimeError.error(withMessage: "The frame has no image data. Was it already disposed?")
    }

    // A new request per call keeps the recognizer free of shared mutable state.
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // MRZ text is not natural language; "correcting" it would introduce errors.
    request.usesLanguageCorrection = false
    request.regionOfInterest = visionRegion

    let handler = VNImageRequestHandler(
      cmSampleBuffer: sampleBuffer,
      orientation: frame.orientation.visionOrientation,
      options: [:]
    )
    try handler.perform([request])

    return (request.results ?? [])
      .compactMap { observation -> MrzTextLine? in
        guard let candidate = observation.topCandidates(1).first else {
          return nil
        }
        let boundingBox = MrzRect(visionBox: observation.boundingBox, in: visionRegion)
        return MrzTextLine(text: candidate.string, boundingBox: boundingBox)
      }
      .sorted(by: MrzTextLine.isInReadingOrder)
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
  /// The orientation Vision needs to read the frame upright. Mirroring is
  /// deliberately ignored: the sensor image itself is never mirrored, so text
  /// in it reads normally.
  var visionOrientation: CGImagePropertyOrientation {
    switch self {
    case .up:
      return .up
    case .down:
      return .down
    case .left:
      return .left
    case .right:
      return .right
    }
  }
}
