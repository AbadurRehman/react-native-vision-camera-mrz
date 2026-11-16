package com.margelo.nitro.visioncameramrz

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import java.util.concurrent.TimeUnit
import kotlin.math.ceil
import kotlin.math.floor

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
    val region = regionOfInterest
    return if (region == null) {
      recognizeWholeFrame(image, rotationDegrees)
    } else {
      recognizeRegion(image, rotationDegrees, region)
    }
  }

  /** Zero-copy path: ML Kit reads the camera buffer directly. */
  private fun recognizeWholeFrame(
    image: ImageProxy,
    rotationDegrees: Int,
  ): Array<MrzTextLine> {
    val text = recognize(image.toInputImage(rotationDegrees))
    // ML Kit reports bounding boxes in the rotated (upright) image.
    val isSideways = rotationDegrees % 180 != 0
    val uprightWidth = (if (isSideways) image.height else image.width).toFloat()
    val uprightHeight = (if (isSideways) image.width else image.height).toFloat()
    return text.toSortedLines(RectF(0f, 0f, uprightWidth, uprightHeight), uprightWidth, uprightHeight)
  }

  /**
   * Crops the frame to the region before recognition, which is much faster
   * than reading the whole frame. Android's Matrix does the rotate-and-crop
   * coordinate math, so no orientation-specific formulas are needed.
   */
  private fun recognizeRegion(
    image: ImageProxy,
    rotationDegrees: Int,
    region: MrzRect,
  ): Array<MrzTextLine> {
    val bitmap = image.toBitmap()
    try {
      // Buffer pixels → upright pixels (rotated, then moved back to the origin).
      val toUpright = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
      val uprightBounds = RectF(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat())
      toUpright.mapRect(uprightBounds)
      toUpright.postTranslate(-uprightBounds.left, -uprightBounds.top)
      val uprightWidth = uprightBounds.width()
      val uprightHeight = uprightBounds.height()

      // The region in buffer pixels, rounded outwards and kept inside the buffer.
      val regionInBuffer =
        RectF(
          (region.x * uprightWidth).toFloat(),
          (region.y * uprightHeight).toFloat(),
          ((region.x + region.width) * uprightWidth).toFloat(),
          ((region.y + region.height) * uprightHeight).toFloat(),
        )
      Matrix().also { toUpright.invert(it) }.mapRect(regionInBuffer)
      val crop =
        Rect(
          floor(regionInBuffer.left).toInt(),
          floor(regionInBuffer.top).toInt(),
          ceil(regionInBuffer.right).toInt(),
          ceil(regionInBuffer.bottom).toInt(),
        )
      if (!crop.intersect(0, 0, bitmap.width, bitmap.height) || crop.isEmpty) {
        return emptyArray()
      }

      // Crop and rotate upright in one step.
      val rotation = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
      val cropped =
        Bitmap.createBitmap(bitmap, crop.left, crop.top, crop.width(), crop.height(), rotation, false)
      try {
        val text = recognize(InputImage.fromBitmap(cropped, 0))
        val cropInUpright = RectF(crop).also { toUpright.mapRect(it) }
        return text.toSortedLines(cropInUpright, uprightWidth, uprightHeight)
      } finally {
        if (cropped !== bitmap) cropped.recycle()
      }
    } finally {
      bitmap.recycle()
    }
  }

  private fun recognize(input: InputImage): Text =
    Tasks.await(sharedRecognizer.process(input), TIMEOUT_MS, TimeUnit.MILLISECONDS)

  private companion object {
    /** Upper bound for one recognition, so a stuck frame cannot block the camera. */
    const val TIMEOUT_MS = 2_000L

    /** Top to bottom, then left to right. */
    val READING_ORDER = compareBy<MrzTextLine>({ it.boundingBox.y }, { it.boundingBox.x })

    /**
     * One ML Kit client for the whole app. Recognizers differ only in their
     * region of interest, which is applied by cropping, so they can share it.
     * Sharing means no client is ever leaked when a recognizer is garbage
     * collected without `dispose()`, and the model loads only once.
     */
    val sharedRecognizer: TextRecognizer by lazy {
      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }
  }

  /**
   * Converts ML Kit's lines to normalized boxes in the whole upright frame.
   * [area] is where the recognized image lies in the upright frame, in pixels.
   */
  private fun Text.toSortedLines(
    area: RectF,
    frameWidth: Float,
    frameHeight: Float,
  ): Array<MrzTextLine> =
    textBlocks
      .asSequence()
      .flatMap { block -> block.lines }
      .mapNotNull { line ->
        line.boundingBox?.let { box ->
          MrzTextLine(line.text, box.toFrameRect(area, frameWidth, frameHeight))
        }
      }.sortedWith(READING_ORDER)
      .toList()
      .toTypedArray()
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

/** Converts a box inside [area] (pixels) to normalized frame coordinates, clamped. */
private fun Rect.toFrameRect(
  area: RectF,
  frameWidth: Float,
  frameHeight: Float,
): MrzRect {
  val normalizedLeft = ((area.left + left) / frameWidth).toDouble().coerceIn(0.0, 1.0)
  val normalizedTop = ((area.top + top) / frameHeight).toDouble().coerceIn(0.0, 1.0)
  val normalizedRight = ((area.left + right) / frameWidth).toDouble().coerceIn(0.0, 1.0)
  val normalizedBottom = ((area.top + bottom) / frameHeight).toDouble().coerceIn(0.0, 1.0)
  return MrzRect(
    normalizedLeft,
    normalizedTop,
    normalizedRight - normalizedLeft,
    normalizedBottom - normalizedTop,
  )
}
