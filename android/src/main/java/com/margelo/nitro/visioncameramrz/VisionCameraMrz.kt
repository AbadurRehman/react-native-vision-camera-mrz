package com.margelo.nitro.visioncameramrz

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.camera.HybridFrameSpec

@DoNotStrip
class VisionCameraMrz : HybridVisionCameraMrzSpec() {
  // Phase 1 smoke test: proves a VisionCamera Frame reaches Kotlin.
  // Replaced by the MRZ text recognizer in Phase 3.
  override fun describeFrame(frame: HybridFrameSpec): String {
    return "${frame.width.toInt()}x${frame.height.toInt()}"
  }
}
