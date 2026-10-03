package expo.modules.pixoraeditor

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class PixoraEditorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PixoraEditor")

    AsyncFunction("processImageAsync") { sourceUri: String, options: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("React context not available")
      
      // Parse URI
      val uri = android.net.Uri.parse(sourceUri)
      
      // 1. Decode Original Bitmap
      val inputStream = context.contentResolver.openInputStream(uri) ?: throw Exception("Could not open input stream")
      val originalBitmap = BitmapFactory.decodeStream(inputStream)
      inputStream.close()

      // 2. Handle EXIF Rotation from original
      val exifStream = context.contentResolver.openInputStream(uri)
      val exifRotation = if (exifStream != null) {
        val exif = ExifInterface(exifStream)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        exifStream.close()
        when (orientation) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> 0f
        }
      } else {
        0f
      }

      // Apply EXIF first
      var currentBitmap = originalBitmap
      if (exifRotation != 0f) {
        val exifMatrix = Matrix()
        exifMatrix.postRotate(exifRotation)
        val rotated = Bitmap.createBitmap(currentBitmap, 0, 0, currentBitmap.width, currentBitmap.height, exifMatrix, true)
        if (rotated != currentBitmap) {
          currentBitmap.recycle()
          currentBitmap = rotated
        }
      }

      // 3. Setup User Transform Matrix (Flip, Rotate)
      val matrix = Matrix()
      
      val flipX = options["flipX"] as? Boolean ?: false
      val flipY = options["flipY"] as? Boolean ?: false
      if (flipX) matrix.postScale(-1f, 1f, currentBitmap.width / 2f, currentBitmap.height / 2f)
      if (flipY) matrix.postScale(1f, -1f, currentBitmap.width / 2f, currentBitmap.height / 2f)

      val rotate = (options["rotation"] as? Double)?.toFloat() ?: 0f
      if (rotate != 0f) {
        matrix.postRotate(rotate, currentBitmap.width / 2f, currentBitmap.height / 2f)
      }

      // 4. Apply Spatial Transformations
      var transformedBitmap = currentBitmap
      if (flipX || flipY || rotate != 0f) {
        val transformed = Bitmap.createBitmap(currentBitmap, 0, 0, currentBitmap.width, currentBitmap.height, matrix, true)
        if (transformed != currentBitmap) {
          currentBitmap.recycle()
          transformedBitmap = transformed
        }
      }

      // 5. Apply Crop on the transformed image
      // Expecting normalized coordinates (0.0 to 1.0) relative to the visible transformed image
      val crop = options["crop"] as? Map<*, *>
      if (crop != null) {
        val normX = (crop["originX"] as? Double)?.toFloat() ?: 0f
        val normY = (crop["originY"] as? Double)?.toFloat() ?: 0f
        val normW = (crop["width"] as? Double)?.toFloat() ?: 1f
        val normH = (crop["height"] as? Double)?.toFloat() ?: 1f

        var cropX = (normX * transformedBitmap.width).toInt()
        var cropY = (normY * transformedBitmap.height).toInt()
        var cropW = (normW * transformedBitmap.width).toInt()
        var cropH = (normH * transformedBitmap.height).toInt()

        // Clamp to valid bounds
        cropX = Math.max(0, Math.min(cropX, transformedBitmap.width - 1))
        cropY = Math.max(0, Math.min(cropY, transformedBitmap.height - 1))
        cropW = Math.max(1, Math.min(cropW, transformedBitmap.width - cropX))
        cropH = Math.max(1, Math.min(cropH, transformedBitmap.height - cropY))

        val cropped = Bitmap.createBitmap(transformedBitmap, cropX, cropY, cropW, cropH)
        if (cropped != transformedBitmap) {
          transformedBitmap.recycle()
          transformedBitmap = cropped
        }
      }

      // 5. Apply Color Matrix (Brightness, Contrast, Saturation, Warmth, Filter)
      val brightness = (options["brightness"] as? Double)?.toFloat() ?: 0f
      val contrast = (options["contrast"] as? Double)?.toFloat() ?: 1f
      val saturation = (options["saturation"] as? Double)?.toFloat() ?: 1f
      val warmth = (options["warmth"] as? Double)?.toFloat() ?: 0f
      val filter = options["filter"] as? String ?: "Original"

      val colorMatrix = ColorMatrix()

      // Saturation
      colorMatrix.setSaturation(saturation)

      // Contrast and Brightness
      // Matrix: 
      // [ C, 0, 0, 0, B ]
      // [ 0, C, 0, 0, B ]
      // [ 0, 0, C, 0, B ]
      // [ 0, 0, 0, 1, 0 ]
      val b = brightness * 255f
      val contrastMatrix = ColorMatrix(floatArrayOf(
        contrast, 0f, 0f, 0f, b,
        0f, contrast, 0f, 0f, b,
        0f, 0f, contrast, 0f, b,
        0f, 0f, 0f, 1f, 0f
      ))
      colorMatrix.postConcat(contrastMatrix)

      // Warmth (Temperature)
      // Positive warmth = more red, less blue. Negative = more blue, less red.
      if (warmth != 0f) {
        val r = 1f + (warmth * 0.2f)
        val g = 1f + (warmth * 0.05f)
        val bl = 1f - (warmth * 0.2f)
        val warmthMatrix = ColorMatrix(floatArrayOf(
          r, 0f, 0f, 0f, 0f,
          0f, g, 0f, 0f, 0f,
          0f, 0f, bl, 0f, 0f,
          0f, 0f, 0f, 1f, 0f
        ))
        colorMatrix.postConcat(warmthMatrix)
      }

      // Preset Filters
      if (filter == "Mono") {
        val monoMatrix = ColorMatrix()
        monoMatrix.setSaturation(0f)
        colorMatrix.postConcat(monoMatrix)
      } else if (filter == "Vintage") {
        val sepiaMatrix = ColorMatrix(floatArrayOf(
          0.393f, 0.769f, 0.189f, 0f, 0f,
          0.349f, 0.686f, 0.168f, 0f, 0f,
          0.272f, 0.534f, 0.131f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f
        ))
        colorMatrix.postConcat(sepiaMatrix)
      } else if (filter == "Fade") {
        val fadeMatrix = ColorMatrix(floatArrayOf(
          0.8f, 0.1f, 0.1f, 0f, 20f,
          0.1f, 0.8f, 0.1f, 0f, 20f,
          0.1f, 0.1f, 0.8f, 0f, 20f,
          0f, 0f, 0f, 1f, 0f
        ))
        colorMatrix.postConcat(fadeMatrix)
      } else if (filter == "Cool") {
        val coolMatrix = ColorMatrix(floatArrayOf(
          0.9f, 0f, 0f, 0f, 0f,
          0f, 0.95f, 0f, 0f, 0f,
          0f, 0f, 1.15f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f
        ))
        colorMatrix.postConcat(coolMatrix)
      } else if (filter == "Warm") {
        val warmFilterMatrix = ColorMatrix(floatArrayOf(
          1.15f, 0f, 0f, 0f, 0f,
          0f, 1.05f, 0f, 0f, 0f,
          0f, 0f, 0.9f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f
        ))
        colorMatrix.postConcat(warmFilterMatrix)
      }

      val paint = Paint()
      paint.colorFilter = ColorMatrixColorFilter(colorMatrix)

      val finalBitmap = Bitmap.createBitmap(transformedBitmap.width, transformedBitmap.height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(finalBitmap)
      canvas.drawBitmap(transformedBitmap, 0f, 0f, paint)

      if (transformedBitmap != finalBitmap) {
        transformedBitmap.recycle()
      }

      // 6. Write to temporary file
      val cacheDir = context.cacheDir
      val outputFile = File(cacheDir, "pixora_export_${UUID.randomUUID()}.jpg")
      val outStream = FileOutputStream(outputFile)
      finalBitmap.compress(Bitmap.CompressFormat.JPEG, 95, outStream)
      outStream.flush()
      outStream.close()

      finalBitmap.recycle()

      // Return URI string
      outputFile.toURI().toString()
    }
  }
}
