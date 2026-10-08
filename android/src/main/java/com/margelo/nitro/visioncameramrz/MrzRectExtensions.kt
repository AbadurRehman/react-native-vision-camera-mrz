package com.margelo.nitro.visioncameramrz

/** Allows for floating-point error in `x + width` and `y + height`. */
private const val TOLERANCE = 1e-9

/** `MrzRect` uses normalized coordinates of the upright frame, origin top-left. */
internal fun MrzRect.requireValidRegionOfInterest() {
  val isFinite = listOf(x, y, width, height).all { it.isFinite() }
  require(
    isFinite &&
      x >= 0 &&
      y >= 0 &&
      width > 0 &&
      height > 0 &&
      x + width <= 1 + TOLERANCE &&
      y + height <= 1 + TOLERANCE,
  ) {
    "regionOfInterest must lie inside the frame (normalized 0-1)."
  }
}

internal fun MrzRect.containsCenterOf(other: MrzRect): Boolean {
  val centerX = other.x + other.width / 2
  val centerY = other.y + other.height / 2
  return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height
}
