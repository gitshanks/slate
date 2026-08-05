package space.s1ate.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SlateColors = darkColorScheme(
    primary = Color(0xFF9572F5),
    onPrimary = Color(0xFF100C18),
    background = Color(0xFF070608),
    onBackground = Color(0xFFF5F2F7),
    surface = Color(0xFF0C0A0E),
    onSurface = Color(0xFFF5F2F7),
    surfaceVariant = Color(0xFF17141A),
    onSurfaceVariant = Color(0xFFAAA3B0),
    outline = Color(0xFF302A34),
    error = Color(0xFFFF6B7A),
)

@Composable
fun SlateTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SlateColors, content = content)
}
