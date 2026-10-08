package com.margelo.nitro.visioncameramrz

import android.graphics.PixelFormat
import android.graphics.Rect
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import java.util.concurrent.TimeUnit

/** Recognizes text in VisionCamera frames with ML Kit's bundled Latin model. */
@DoNotStrip
@Keep
class HybridMrzTextRecognizer(
  options: MrzTextRecognizerOptions,
) : HybridMrzTextRecognizerSpec() {
  private val regionOfInterest: MrzRect? =
    options.regionOfInterest?.also { it.requireValidRegionOfInterest() }

  override fun recognizeText(frame: HybridFrameSpec): Array<MrzTextLine> {
    val image =
      (frame as? NativeFrame)?.image
        ?: throw IllegalArgumentException("The frame is not a VisionCamera frame.")
    val rotationDegrees = image.imageInfo.rotationDegrees
    val text =
      Tasks.await(
        sharedRecognizer.process(image.toInputImage(rotationDegrees)),
        TIMEOUT_MS,
        TimeUnit.MILLISECONDS,
      )

    // ML Kit reports bounding boxes in the rotated (upright) image.
    val isSideways = rotationDegrees % 180 != 0
    val uprightWidth = (if (isSideways) image.height else image.width).toDouble()
    val uprightHeight = (if (isSideways) image.width else image.height).toDouble()

    return text.textBlocks
      .asSequence()
      .flatMap { block -> block.lines }
      .mapNotNull { line ->
        line.boundingBox?.let { box ->
          MrzTextLine(line.text, box.toNormalizedRect(uprightWidth, uprightHeight))
        }
      }
      .filter { line -> regionOfInterest?.containsCenterOf(line.boundingBox) ?: true }
      .sortedWith(READING_ORDER)
      .toList()
      .toTypedArray()
  }

  private companion object {
    /** Upper bound for one recognition, so a stuck frame cannot block the camera. */
    const val TIMEOUT_MS = 2_000L

    /** Top to bottom, then left to right. */
    val READING_ORDER = compareBy<MrzTextLine>({ it.boundingBox.y }, { it.boundingBox.x })

    /**
     * One ML Kit client for the whole app. Recognizers differ only in their
     * region of interest, which is applied afterwards, so they can share it.
     * Sharing means no client is ever leaked when a recognizer is garbage
     * collected without `dispose()`, and the model loads only once.
     */
    val sharedRecognizer: TextRecognizer by lazy {
      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }
  }
}

@OptIn(ExperimentalGetImage::class)
private fun ImageProxy.toInputImage(rotationDegrees: Int): InputImage {
  if (format == PixelFormat.RGBA_8888) {
    // ML Kit cannot wrap an RGBA media image directly.
    return InputImage.fromBitmap(toBitmap(), rotationDegrees)
  }
  val mediaImage =
    image ?: throw IllegalStateException("The frame has no image data. Was it already disposed?")
  return InputImage.fromMediaImage(mediaImage, rotationDegrees)
}

/** Converts a pixel rectangle to normalized coordinates, clamped to the image. */
private fun Rect.toNormalizedRect(imageWidth: Double, imageHeight: Double): MrzRect {
  val normalizedLeft = (left / imageWidth).coerceIn(0.0, 1.0)
  val normalizedTop = (top / imageHeight).coerceIn(0.0, 1.0)
  val normalizedRight = (right / imageWidth).coerceIn(0.0, 1.0)
  val normalizedBottom = (bottom / imageHeight).coerceIn(0.0, 1.0)
  return MrzRect(
    normalizedLeft,
    normalizedTop,
    normalizedRight - normalizedLeft,
    normalizedBottom - normalizedTop,
  )
}
