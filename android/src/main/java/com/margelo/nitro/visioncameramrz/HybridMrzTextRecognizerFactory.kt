package com.margelo.nitro.visioncameramrz

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
@Keep
class HybridMrzTextRecognizerFactory : HybridMrzTextRecognizerFactorySpec() {
  override fun createTextRecognizer(options: MrzTextRecognizerOptions): HybridMrzTextRecognizerSpec =
    HybridMrzTextRecognizer(options)
}
