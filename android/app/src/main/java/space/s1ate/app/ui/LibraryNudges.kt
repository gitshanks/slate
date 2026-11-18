package space.s1ate.app.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.NewEpisode
import space.s1ate.app.model.SlateTitle
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale

// The prompts above the shelf, as on the web (lib/library-nudges.ts):
// - a show you are watching has a new episode out;
// - under five titles: the fastest ways to a library worth having;
// - ten titles and no list yet: a first list made from what is saved.

private const val SMALL_LIBRARY_TITLES = 5
private const val LIST_SUGGESTION_TITLES = 10
private const val PREFS = "slate-library-prompts"

internal data class ListSuggestion(val name: String, val titleIds: List<String>, val posters: List<String>)

/** The genre with the most titles still to watch, so the list is something to pick from. */
internal fun suggestList(titles: List<SlateTitle>): ListSuggestion? {
    if (titles.size < LIST_SUGGESTION_TITLES) return null
    val unwatched = titles.filter { it.status == LibraryStatus.want || it.status == LibraryStatus.watching }
    val pool = if (unwatched.size >= 4) unwatched else titles
    val byGenre = LinkedHashMap<String, MutableList<SlateTitle>>()
    pool.forEach { title ->
        title.genres.orEmpty().forEach { genre ->
            if (genre.name.isNotBlank()) byGenre.getOrPut(genre.name) { mutableListOf() }.add(title)
        }
    }
    val (genre, group) = byGenre.entries.maxByOrNull { it.value.size } ?: return null
    if (group.size < 4) return null
    val picked = group.take(12)
    return ListSuggestion(
        name = "${genre.replace(" & ", " and ")} night",
        titleIds = picked.map { it.id },
        posters = picked.mapNotNull { it.posterPath }.take(4).map { "https://image.tmdb.org/t/p/w185$it" },
    )
}

/** "out today", "out yesterday", a weekday within the week, else "out 3 Nov". */
private fun airedLabel(airDate: String): String {
    val aired = runCatching { LocalDate.parse(airDate) }.getOrNull() ?: return ""
    val days = ChronoUnit.DAYS.between(aired, LocalDate.now())
    return when {
        days <= 0 -> "out today"
        days == 1L -> "out yesterday"
        days < 7 -> "out ${aired.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())}"
        else -> "out ${aired.format(DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()))}"
    }
}

@Composable
internal fun LibraryNudges(
    titles: List<SlateTitle>,
    newEpisodes: List<NewEpisode>,
    hasLists: Boolean,
    onOpenTitle: (String) -> Unit,
    onAdd: () -> Unit,
    onAddFromLink: () -> Unit,
    onMakeList: suspend (String, List<String>) -> Unit,
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
    var hidden by remember { mutableStateOf(prefs.getStringSet("hidden", emptySet()).orEmpty().toSet()) }
    val hide: (String) -> Unit = { kind ->
        hidden = hidden + kind
        prefs.edit().putStringSet("hidden", hidden).apply()
    }
    val scope = rememberCoroutineScope()
    var creating by remember { mutableStateOf(false) }
    var createError by remember { mutableStateOf(false) }

    val remaining = SMALL_LIBRARY_TITLES - titles.size
    val showSmall = titles.isNotEmpty() && remaining > 0 && "small" !in hidden
    val suggestion = remember(titles, hasLists) { if (hasLists) null else suggestList(titles) }
    val showList = suggestion != null && "list" !in hidden
    val episodes = remember(newEpisodes, titles) {
        newEpisodes.filter { item -> titles.any { it.id == item.titleId } }
    }
    if (episodes.isEmpty() && !showSmall && !showList) return

    Column(Modifier.fillMaxWidth().padding(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (episodes.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "New episodes",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.semantics { heading() },
                )
                // The row runs to both screen edges; its first poster lines up with the grid.
                LazyRow(
                    Modifier.bleed(SlateGutter),
                    contentPadding = PaddingValues(horizontal = SlateGutter),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(episodes, key = { it.titleId }) { item ->
                        val aired = airedLabel(item.airDate)
                        Column(
                            Modifier
                                .width(112.dp)
                                .pressable { onOpenTitle(item.titleId) }
                                .semantics {
                                    contentDescription = "${item.title}, season ${item.season} episode ${item.episode}, $aired"
                                },
                        ) {
                            PosterFrame(item.posterUrl, item.title)
                            Text(
                                item.title,
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                            Text(
                                buildAnnotatedString {
                                    withStyle(SpanStyle(color = SlateAccent, fontWeight = FontWeight.SemiBold)) {
                                        append("S${item.season} E${item.episode}")
                                    }
                                    append(" $aired")
                                },
                                color = SlateMutedText,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }

        if (showSmall) {
            NudgeCard(
                top = { LibrarySlots(titles.take(SMALL_LIBRARY_TITLES).map { it.posterPath }, titles.size) },
                heading = "$remaining more and Slate gets to know your taste",
                body = "Recommendations learn from what you save. Search for a few, or pull them in from a link.",
                onDismiss = { hide("small") },
            ) {
                SlatePrimaryButton("Find titles", Modifier.weight(1f), onClick = onAdd)
                SlateSecondaryButton("Add from a link", Modifier.weight(1f), onClick = onAddFromLink)
            }
        }

        if (showList && suggestion != null) {
            NudgeCard(
                top = {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        suggestion.posters.forEach { Thumb(it) }
                        val more = suggestion.titleIds.size - suggestion.posters.size
                        if (more > 0) {
                            Box(ThumbModifier.background(Color.White.copy(alpha = 0.06f)), contentAlignment = Alignment.Center) {
                                Text("+$more", color = SlateMutedText, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                },
                heading = "Make ${suggestion.name} your first list",
                body = if (createError) "That list could not be made. Try once more."
                else "${suggestion.titleIds.size} titles you saved, ready to share with whoever you watch with.",
                bodyIsError = createError,
                onDismiss = { if (!creating) hide("list") },
            ) {
                SlatePrimaryButton(
                    if (creating) "Making it…" else "Make this list",
                    Modifier.weight(1f),
                    enabled = !creating,
                ) {
                    creating = true
                    createError = false
                    scope.launch {
                        runCatching { onMakeList(suggestion.name, suggestion.titleIds) }
                            .onSuccess { hide("list") }
                            .onFailure { createError = true }
                        creating = false
                    }
                }
            }
        }
    }
}

/**
 * The frame every Library prompt shares (DESIGN.md, Interaction): the close
 * button pinned to the top-right corner with the text kept clear of it, and
 * the actions in one row of equal widths, a single action taking the row.
 */
@Composable
private fun NudgeCard(
    top: @Composable () -> Unit,
    heading: String,
    body: String,
    onDismiss: () -> Unit,
    bodyIsError: Boolean = false,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Box(
        Modifier
            .widthIn(max = 520.dp)
            .fillMaxWidth()
            .arriveOn(Unit)
            .clip(RoundedCornerShape(16.dp))
            .background(SlateSurface.copy(alpha = 0.6f))
            .border(1.dp, SlateBorder, RoundedCornerShape(16.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Column(Modifier.padding(end = 36.dp)) {
                top()
                Text(
                    heading,
                    color = Color.White,
                    fontSize = 16.sp,
                    lineHeight = 21.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 12.dp).semantics { heading() },
                )
                Text(
                    body,
                    color = if (bodyIsError) Color(0xFFFF6B7A) else SlateMutedText,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                Modifier.fillMaxWidth().padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                content = actions,
            )
        }
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .padding(6.dp)
                .size(44.dp)
                .pressable(onClick = onDismiss)
                .semantics { contentDescription = "Hide this" },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Close, contentDescription = null, tint = SlateMutedText, modifier = Modifier.size(16.dp))
        }
    }
}

private val ThumbModifier = Modifier.width(48.dp).height(72.dp).clip(RoundedCornerShape(8.dp))

@Composable
private fun Thumb(url: String?) {
    if (url == null) Box(ThumbModifier.background(Color(0xFF1B1B1E)))
    else AsyncImage(url, null, ThumbModifier.background(Color(0xFF1B1B1E)), contentScale = ContentScale.Crop)
}

/** The five slots of a library worth having: what is saved, then the places still to fill. */
@Composable
private fun LibrarySlots(posterPaths: List<String?>, count: Int) {
    Row(
        Modifier.semantics { contentDescription = "$count of $SMALL_LIBRARY_TITLES titles saved" },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        repeat(SMALL_LIBRARY_TITLES) { index ->
            if (index < count) {
                Thumb(posterPaths.getOrNull(index)?.let { "https://image.tmdb.org/t/p/w185$it" })
            } else {
                Box(ThumbModifier.border(1.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(8.dp)))
            }
        }
    }
}

/** Lets a child of a padded column run to both edges of the screen. */
internal fun Modifier.bleed(gutter: androidx.compose.ui.unit.Dp): Modifier = layout { measurable, constraints ->
    val extra = gutter.roundToPx() * 2
    val placeable = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.minWidth + extra))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-gutter.roundToPx(), 0) }
}
