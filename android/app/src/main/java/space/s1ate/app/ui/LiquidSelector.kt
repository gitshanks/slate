package space.s1ate.app.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * The two springs of a liquid selector, in the same units as the web's
 * `components/liquid-selector.tsx` (stiffness and damping at mass 1): the
 * leading edge runs ahead and the trailing edge follows, so the body stretches
 * as it travels and settles back into a pill.
 */
data class LiquidSprings(
    val leadStiffness: Float,
    val leadDamping: Float,
    val tailStiffness: Float,
    val tailDamping: Float,
)

/** Small controls: segmented filters and switches. */
val LiquidControl = LiquidSprings(380f, 29f, 235f, 26f)

/** The dock only: the same motion, played slower. */
val LiquidDock = LiquidSprings(250f, 23f, 150f, 21f)

private fun ratio(stiffness: Float, damping: Float) = damping / (2f * sqrt(stiffness))

@Composable
internal fun reduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    }
}

/**
 * Slate's selector for every control that moves a marker between options
 * (DESIGN.md, Motion): one continuous body in the theme colour that flows to
 * the chosen option, can be dragged as well as tapped, and draws the chosen
 * label's ink itself so the colour changes exactly where the body is.
 *
 * Each option takes its label's width plus an equal share of the spare room.
 * The caller sets the height.
 */
@Composable
fun LiquidSelector(
    count: Int,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    springs: LiquidSprings = LiquidControl,
    trackColor: Color = Color.White.copy(alpha = 0.055f),
    restColor: Color = SlateMutedText,
    inset: Dp = 4.dp,
    item: @Composable (index: Int) -> Unit,
) {
    val still = reduceMotion()
    val scope = rememberCoroutineScope()
    val latestSelect by rememberUpdatedState(onSelect)
    val current by rememberUpdatedState(selectedIndex)
    // What the selector shows. It moves on the tap itself; the owner hears
    // about it a frame later, so heavy work never holds the marker back.
    var shown by remember { mutableIntStateOf(selectedIndex) }
    val lead = remember { Animatable(selectedIndex.toFloat()) }
    val tail = remember { Animatable(selectedIndex.toFloat()) }
    val blob = remember { Path() }

    suspend fun settle(target: Int) {
        val to = target.toFloat()
        if (still) {
            lead.snapTo(to)
            tail.snapTo(to)
            return
        }
        scope.launch {
            lead.animateTo(to, spring(ratio(springs.leadStiffness, springs.leadDamping), springs.leadStiffness))
        }
        scope.launch {
            tail.animateTo(to, spring(ratio(springs.tailStiffness, springs.tailDamping), springs.tailStiffness))
        }
    }

    fun choose(index: Int) {
        val target = index.coerceIn(0, count - 1)
        shown = target
        scope.launch {
            settle(target)
            withFrameNanos { }
            if (target != current) latestSelect(target)
        }
    }

    LaunchedEffect(selectedIndex) {
        if (selectedIndex != shown || lead.targetValue != selectedIndex.toFloat()) {
            shown = selectedIndex
            settle(selectedIndex)
        }
    }

    val primary = SlateAccent
    val ink = SlateOnAccent

    // Where each option sits, in pixels: every label gets its own width plus
    // an equal share of what is left, so short and long labels breathe alike.
    var lefts by remember { mutableStateOf(FloatArray(0)) }
    var widths by remember { mutableStateOf(FloatArray(0)) }

    fun leftAt(position: Float): Float {
        val last = lefts.size - 1
        if (last < 0) return 0f
        if (position <= 0f) return lefts[0] + position * widths[0]
        if (position >= last) return lefts[last] + (position - last) * widths[last]
        val index = position.toInt()
        val part = position - index
        return lefts[index] + (lefts[index + 1] - lefts[index]) * part
    }

    fun widthAt(position: Float): Float {
        val last = widths.size - 1
        if (last < 0) return 0f
        val clamped = position.coerceIn(0f, last.toFloat())
        val index = clamped.toInt().coerceAtMost(last)
        val next = min(index + 1, last)
        return widths[index] + (widths[next] - widths[index]) * (clamped - index)
    }

    val slots = remember(count) {
        MeasurePolicy { measurables, constraints ->
            val height = constraints.maxHeight
            val total = constraints.maxWidth
            val natural = measurables.map { it.maxIntrinsicWidth(height) }
            val spare = total - natural.sum()
            val sizes = if (spare >= 0) {
                natural.mapIndexed { index, width -> width + spare / count + if (index < spare % count) 1 else 0 }
            } else {
                List(count) { index -> total / count + if (index < total % count) 1 else 0 }
            }
            val placeables = measurables.mapIndexed { index, measurable ->
                measurable.measure(Constraints.fixed(sizes[index], height))
            }
            val starts = FloatArray(count)
            var x = 0
            sizes.forEachIndexed { index, size -> starts[index] = x.toFloat(); x += size }
            val sizesPx = FloatArray(count) { sizes[it].toFloat() }
            if (!starts.contentEquals(lefts)) lefts = starts
            if (!sizesPx.contentEquals(widths)) widths = sizesPx
            layout(total, height) {
                var at = 0
                placeables.forEachIndexed { index, placeable -> placeable.place(at, 0); at += sizes[index] }
            }
        }
    }

    Box(
        modifier
            .clip(CircleShape)
            .background(trackColor)
            .padding(inset)
            .pointerInput(count) {
                var position = 0f
                detectHorizontalDragGestures(
                    onDragStart = { position = lead.value },
                    onDragCancel = { choose(shown) },
                    onDragEnd = { choose(position.roundToInt()) },
                    onHorizontalDrag = { change, amount ->
                        change.consume()
                        val slot = widthAt(position)
                        if (slot <= 0f) return@detectHorizontalDragGestures
                        position += amount / slot
                        // Past either end the body gives a little, then resists.
                        val last = (count - 1).toFloat()
                        val held = when {
                            position < 0f -> position * 0.3f
                            position > last -> last + (position - last) * 0.3f
                            else -> position
                        }
                        scope.launch {
                            lead.snapTo(held)
                            if (still) tail.snapTo(held)
                        }
                        if (!still) {
                            scope.launch {
                                tail.animateTo(held, spring(ratio(springs.tailStiffness, springs.tailDamping), springs.tailStiffness))
                            }
                        }
                    },
                )
            },
    ) {
        fun buildBlob(size: Size) {
            blob.rewind()
            if (widths.isEmpty()) return
            val a = lead.value
            val b = tail.value
            val give = widthAt(a) * 0.12f
            val left = min(leftAt(a), leftAt(b)).coerceAtLeast(-give)
            val right = max(leftAt(a) + widthAt(a), leftAt(b) + widthAt(b)).coerceAtMost(size.width + give)
            // A stretched body thins slightly, never below most of its height.
            val stretch = ((right - left) / widthAt(a) - 1f).coerceAtLeast(0f)
            val height = size.height * (1f - min(0.16f, stretch * 0.11f))
            val top = (size.height - height) / 2f
            blob.addRoundRect(
                RoundRect(left, top, right, top + height, CornerRadius(height / 2f)),
            )
        }

        Canvas(Modifier.matchParentSize()) {
            buildBlob(size)
            drawPath(blob, primary)
        }

        // Resting labels, which also take the taps.
        Layout(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(),
            measurePolicy = slots,
            content = {
                CompositionLocalProvider(LocalContentColor provides restColor) {
                    repeat(count) { index ->
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .clickable(interactionSource = null, indication = null) { choose(index) }
                                .semantics { role = Role.Tab; selected = index == shown }
                                .padding(horizontal = 6.dp),
                            contentAlignment = Alignment.Center,
                        ) { item(index) }
                    }
                }
            },
        )

        // The same labels in the ink colour, visible only inside the body.
        Layout(
            modifier = Modifier
                .matchParentSize()
                .clearAndSetSemantics { }
                .drawWithContent {
                    buildBlob(size)
                    clipPath(blob) { this@drawWithContent.drawContent() }
                },
            measurePolicy = slots,
            content = {
                CompositionLocalProvider(LocalContentColor provides ink) {
                    repeat(count) { index ->
                        Box(Modifier.padding(horizontal = 6.dp), contentAlignment = Alignment.Center) { item(index) }
                    }
                }
            },
        )
    }
}
