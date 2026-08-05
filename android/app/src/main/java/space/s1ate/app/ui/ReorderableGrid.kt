package space.s1ate.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import space.s1ate.app.model.SlateTitle
import kotlin.math.roundToInt

@Composable
fun ReorderableLibraryGrid(
    source: List<SlateTitle>,
    onOpen: (SlateTitle) -> Unit,
    onCommit: suspend (List<SlateTitle>) -> Unit,
) {
    val items = remember { mutableStateListOf<SlateTitle>() }
    val bounds = remember { mutableStateMapOf<String, Rect>() }
    val scope = rememberCoroutineScope()
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    LaunchedEffect(source.map(SlateTitle::id)) {
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
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 28.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        items(items, key = { it.id }) { title ->
            val isDragging = draggingId == title.id
            val scale by animateFloatAsState(if (isDragging) 1.035f else 1f, label = "lift")
            Column(
                modifier = Modifier
                    .animateItem()
                    .onGloballyPositioned { bounds[title.id] = it.boundsInParent() }
                    .offset {
                        if (isDragging) IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt())
                        else IntOffset.Zero
                    }
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        shadowElevation = if (isDragging) 30f else 0f
                        alpha = if (isDragging) 0.96f else 1f
                    }
                    .pointerInput(title.id) {
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
            ) {
                PosterTile(title = title, onClick = { if (draggingId == null) onOpen(title) })
            }
        }
    }
}

@Composable
fun PosterTile(title: SlateTitle, onClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(15.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
            AsyncImage(title.posterUrl, title.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            if (title.imdbRating != null || title.rottenTomatoesScore != null || title.metacriticScore != null) {
                Row(
                    Modifier.align(Alignment.TopStart).padding(9.dp).background(Color.Black.copy(alpha = 0.62f), CircleShape)
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    title.imdbRating?.let { Text("IMDb", fontWeight = FontWeight.Bold, fontSize = 10.sp, color = Color.White); Text(String.format("%.1f", it), fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color.White) }
                    title.rottenTomatoesScore?.let { Text("· $it%", fontSize = 10.sp, color = Color.White) }
                        ?: title.metacriticScore?.let { Text("· $it", fontSize = 10.sp, color = Color.White) }
                }
            }
            title.rating?.let { rating ->
                val icon = when (rating) { 3.0 -> Icons.Outlined.Favorite; 2.0 -> Icons.Outlined.ThumbUp; else -> Icons.Outlined.ThumbDown }
                val tint = when (rating) { 3.0 -> Color(0xFFFF6B9D); 2.0 -> Color(0xFF5ED49A); else -> Color(0xFFFFB35C) }
                Icon(icon, null, Modifier.align(Alignment.BottomEnd).padding(9.dp).background(Color.Black.copy(0.58f), CircleShape).padding(8.dp).size(16.dp), tint = tint)
            }
        }
        Text(title.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            title.year?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            title.genres?.firstOrNull()?.let { genre ->
                if (title.year != null) Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(genre.name, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
