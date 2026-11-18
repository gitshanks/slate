package space.s1ate.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import space.s1ate.app.SlateViewModel
import space.s1ate.app.model.CuratedList
import space.s1ate.app.model.DiscoverRail
import space.s1ate.app.model.DiscoverRailItem
import space.s1ate.app.model.MediaType

/** Discover: what to watch next, as rails of posters (the web's Discover page). */
@Composable
internal fun DiscoverHomeScreen(
    rails: List<DiscoverRail>?,
    onLoad: () -> Unit,
    onOpenTitle: (MediaType, Int) -> Unit,
    bottomInset: PaddingValues,
) {
    LaunchedEffect(Unit) { onLoad() }

    when {
        rails == null -> DiscoverPlaceholder()
        rails.isEmpty() -> Box(Modifier.fillMaxSize().padding(bottom = bottomInset.calculateBottomPadding()), Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                EmptyMessage("Discover is not loading", "Check your connection and try again.")
                SlateSecondaryButton("Try again", onClick = onLoad)
            }
        }
        else -> LazyColumn(
            Modifier.fillMaxSize().arriveOn(rails.size),
            contentPadding = PaddingValues(top = 4.dp, bottom = bottomInset.calculateBottomPadding() + 16.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            items(rails, key = { it.id }) { rail ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        rail.title,
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = SlateGutter).semantics { heading() },
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = SlateGutter),
                        horizontalArrangement = Arrangement.spacedBy(SlatePosterGap),
                    ) {
                        items(rail.items, key = { it.id }) { item ->
                            RailPoster(item, Modifier.width(116.dp)) { onOpenTitle(item.mediaType, item.tmdbId) }
                        }
                    }
                }
            }
        }
    }
}

/** The shape of Discover while it loads: the rails' own layout, held in place. */
@Composable
private fun DiscoverPlaceholder() {
    Column(Modifier.fillMaxSize().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
        repeat(3) {
            Column(Modifier.padding(start = SlateGutter), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(width = 148.dp, height = 18.dp).clip(RoundedCornerShape(6.dp)).background(SlateFill))
                Row(horizontalArrangement = Arrangement.spacedBy(SlatePosterGap)) {
                    repeat(4) {
                        Box(Modifier.width(116.dp).aspectRatio(2f / 3f).clip(RoundedCornerShape(12.dp)).background(SlateFill))
                    }
                }
            }
        }
    }
}

/** A catalogue poster. A tick marks one already on your slate. */
@Composable
internal fun RailPoster(item: DiscoverRailItem, modifier: Modifier = Modifier, saved: Boolean = item.saved, onClick: () -> Unit) {
    PosterFrame(
        item.posterUrl,
        item.title,
        modifier.pressable(onClick = onClick).semantics {
            contentDescription = if (saved) "${item.title}, on your slate" else item.title
        },
    ) {
        if (saved) {
            Icon(
                Icons.Outlined.Check,
                contentDescription = null,
                tint = SlateOnAccent,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .background(SlateAccent, CircleShape)
                    .padding(4.dp)
                    .size(12.dp),
            )
        }
    }
}

/**
 * A list made by Slate, opened from a s1ate.space/l/<slug> link: its name, why
 * it exists, one action across the full width, and the posters.
 */
@Composable
internal fun CuratedListScreen(
    model: SlateViewModel,
    slug: String,
    onBack: () -> Unit,
    onOpenTitle: (MediaType, Int) -> Unit,
    onOpenLists: () -> Unit,
) {
    var list by remember(slug) { mutableStateOf<CuratedList?>(null) }
    var failed by remember(slug) { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember(slug) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(slug) {
        runCatching { model.curatedList(slug) }
            .onSuccess { list = it }
            .onFailure { failed = true }
    }

    Column(Modifier.fillMaxSize().background(SlateBackground).windowInsetsPadding(WindowInsets.statusBars)) {
        Box(Modifier.height(56.dp).padding(start = 4.dp), contentAlignment = Alignment.CenterStart) {
            Box(Modifier.size(48.dp).pressable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
        }
        val current = list
        when {
            failed -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                EmptyMessage("That list is no longer here", "It may have been renamed or taken down.")
            }
            current == null -> Box(Modifier.fillMaxSize())
            else -> {
                val everySaved = saved || current.titles.all { it.saved }
                LazyVerticalGrid(
                    columns = SlatePosterCells,
                    modifier = Modifier.fillMaxSize().arriveOn(current.slug),
                    contentPadding = PaddingValues(start = SlateGutter, end = SlateGutter, bottom = 32.dp),
                    horizontalArrangement = Arrangement.spacedBy(SlatePosterGap),
                    verticalArrangement = Arrangement.spacedBy(SlatePosterGap),
                ) {
                    fullWidthItem("header") {
                        Column(Modifier.padding(top = 8.dp, bottom = 14.dp)) {
                            Text(
                                current.name,
                                color = Color.White,
                                fontSize = 34.sp,
                                lineHeight = 38.sp,
                                letterSpacing = (-1).sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.semantics { heading() },
                            )
                            Text(
                                "A list by ${current.curator}",
                                color = SlateAccent,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                            current.description?.takeIf(String::isNotBlank)?.let {
                                Text(
                                    it,
                                    color = Color.White.copy(alpha = 0.66f),
                                    fontSize = 16.sp,
                                    lineHeight = 24.sp,
                                    modifier = Modifier.padding(top = 12.dp),
                                )
                            }
                            SlatePrimaryButton(
                                label = when {
                                    saving -> "Adding"
                                    saved -> "On your slate. Open your lists"
                                    else -> "Add to your slate"
                                },
                                enabled = !saving,
                                modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                            ) {
                                if (saved) onOpenLists() else {
                                    saving = true
                                    scope.launch {
                                        runCatching { model.addCuratedList(slug) }
                                            .onSuccess { saved = true }
                                            .onFailure { model.showMessage(it.message ?: "That did not work. Try again.") }
                                        saving = false
                                    }
                                }
                            }
                        }
                    }
                    items(current.titles, key = { it.id }) { item ->
                        RailPoster(item, saved = everySaved || item.saved) { onOpenTitle(item.mediaType, item.tmdbId) }
                    }
                }
            }
        }
    }
}
