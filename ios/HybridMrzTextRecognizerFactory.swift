import NitroModules

final class HybridMrzTextRecognizerFactory: HybridMrzTextRecognizerFactorySpec {
  func createTextRecognizer(options: MrzTextRecognizerOptions) throws
    -> any HybridMrzTextRecognizerSpec
  {
    return try HybridMrzTextRecognizer(options: options)
  }
}
