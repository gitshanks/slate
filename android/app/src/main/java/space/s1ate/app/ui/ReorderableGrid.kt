package space.s1ate.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import space.s1ate.app.model.SlateTitle
import kotlin.math.roundToInt

/** Posters per row: three on a phone, more as the window widens. */
internal val SlatePosterGap = 10.dp
internal val SlatePosterCells: GridCells = object : GridCells {
    override fun Density.calculateCrossAxisCellSizes(availableSize: Int, spacing: Int): List<Int> {
        val count = maxOf(3, (availableSize + spacing) / (132.dp.roundToPx() + spacing))
        val cell = (availableSize - spacing * (count - 1)) / count
        val extra = (availableSize - spacing * (count - 1)) % count
        return List(count) { index -> cell + if (index < extra) 1 else 0 }
    }
}

/**
 * The shelf: a grid of posters, as on the web's phone Library. With
 * [reorderable] a long press lifts a poster and dragging moves it; the new
 * order settles locally at once and is handed to [onCommit].
 *
 * [header] scrolls with the posters and spans the full width.
 */
@Composable
fun ReorderableLibraryGrid(
    source: List<SlateTitle>,
    onOpen: (SlateTitle) -> Unit,
    modifier: Modifier = Modifier,
    reorderable: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(start = SlateGutter, end = SlateGutter, bottom = 28.dp),
    header: (LazyGridScope.() -> Unit)? = null,
    onCommit: suspend (List<SlateTitle>) -> Unit = {},
) {
    val items = remember { mutableStateListOf<SlateTitle>() }
    val bounds = remember { mutableStateMapOf<String, Rect>() }
    val scope = rememberCoroutineScope()
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    LaunchedEffect(source) {
        if (draggingId == null) {
            items.clear()
            items.addAll(source)
        }
    }

    fun finish() {
        if (draggingId == null) return
        draggingId = null
        dragOffset = Offset.Zero
        scope.launch { runCatching { onCommit(items.toList()) } }
    }

    LazyVerticalGrid(
        columns = SlatePosterCells,
        modifier = modifier,
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(SlatePosterGap),
        verticalArrangement = Arrangement.spacedBy(SlatePosterGap),
    ) {
        header?.invoke(this)
        items(items, key = { it.id }) { title ->
            val isDragging = draggingId == title.id
            val scale by animateFloatAsState(if (isDragging) 1.05f else 1f, label = "lift")
            Box(
                modifier = Modifier
                    .then(if (isDragging) Modifier else Modifier.animateItem())
                    .zIndex(if (isDragging) 1f else 0f)
                    .onGloballyPositioned { bounds[title.id] = it.boundsInParent() }
                    .offset {
                        if (isDragging) IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt())
                        else IntOffset.Zero
                    }
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        shadowElevation = if (isDragging) 30f else 0f
                        shape = RoundedCornerShape(12.dp)
                    }
                    .then(
                        if (!reorderable) Modifier else Modifier.pointerInput(title.id) {
                            detectDragGesturesAfterLongPress(
                                onDragStart = { draggingId = title.id; dragOffset = Offset.Zero },
                                onDragCancel = ::finish,
                                onDragEnd = ::finish,
                                onDrag = { change, amount ->
                                    change.consume()
                                    dragOffset += amount
                                    val sourceBounds = bounds[title.id] ?: return@detectDragGesturesAfterLongPress
                                    val center = sourceBounds.center + dragOffset
                                    val target = bounds.entries.firstOrNull { (id, rect) -> id != title.id && rect.contains(center) }
                                        ?: return@detectDragGesturesAfterLongPress
                                    val from = items.indexOfFirst { it.id == title.id }
                                    val to = items.indexOfFirst { it.id == target.key }
                                    if (from >= 0 && to >= 0 && from != to) {
                                        val targetBounds = target.value
                                        items.add(to, items.removeAt(from))
                                        dragOffset -= targetBounds.topLeft - sourceBounds.topLeft
                                    }
                                },
                            )
                        },
                    ),
            ) {
                PosterTile(title = title, onClick = { if (draggingId == null) onOpen(title) })
            }
        }
    }
}

/** A full-width row inside a poster grid. */
internal fun LazyGridScope.fullWidthItem(key: Any, content: @Composable () -> Unit) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }) { content() }
}

/** One poster. The artwork is the whole tile; a reaction shows as a small badge. */
@Composable
fun PosterTile(title: SlateTitle, onClick: () -> Unit, modifier: Modifier = Modifier) {
    PosterFrame(title.posterUrl, title.title, modifier.pressable(onClick = onClick)) {
        title.rating?.let { rating ->
            val icon = when (rating) {
                3.0 -> Icons.Outlined.Favorite
                2.0 -> Icons.Outlined.ThumbUp
                else -> Icons.Outlined.ThumbDown
            }
            Icon(
                icon,
                contentDescription = when (rating) { 3.0 -> "Loved"; 2.0 -> "Liked"; else -> "Disliked" },
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
                    .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                    .padding(6.dp)
                    .size(13.dp),
            )
        }
    }
}

/** A 2:3 poster with the title set in its place until, or unless, the artwork loads. */
@Composable
internal fun PosterFrame(
    url: String?,
    title: String,
    modifier: Modifier = Modifier,
    overlay: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit = {},
) {
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(2f / 3f)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF1B1B1E)),
    ) {
        if (url == null) {
            Text(
                title,
                color = SlateMutedText,
                fontSize = 12.sp,
                lineHeight = 15.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.Center).padding(8.dp),
            )
        } else {
            AsyncImage(url, title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        overlay()
    }
}
