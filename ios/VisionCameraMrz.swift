import NitroModules
import VisionCamera

class VisionCameraMrz: HybridVisionCameraMrzSpec {
  // Phase 1 smoke test: proves a VisionCamera Frame reaches Swift.
  // Replaced by the MRZ text recognizer in Phase 3.
  func describeFrame(frame: any HybridFrameSpec) throws -> String {
    return "\(Int(frame.width))x\(Int(frame.height))"
  }
}
