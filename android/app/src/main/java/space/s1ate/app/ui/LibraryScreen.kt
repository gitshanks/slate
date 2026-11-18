package space.s1ate.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import space.s1ate.app.model.Genre
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.NewEpisode
import space.s1ate.app.model.SlateTitle

/** The shelves of the Library's selector, in the web's order and wording. */
internal enum class Shelf(val label: String, val status: LibraryStatus?) {
    All("All", null),
    UpNext("Up Next", LibraryStatus.want),
    Watching("Watching", LibraryStatus.watching),
    Watched("Watched", LibraryStatus.watched),
}

/**
 * What the Filters sheet holds. Format, genre, year and reaction are filters;
 * the order is not, so Clear all leaves it (and the shelf) alone.
 */
internal data class LibraryFilters(
    val format: String = "",
    val genre: String = "",
    val year: String = "",
    val reaction: String = "",
    val sort: String = "",
) {
    fun cleared() = LibraryFilters(sort = sort)
}

private data class Option(val value: String, val label: String, val icon: ImageVector? = null)

private val FormatOptions = listOf(
    Option("", "All", Icons.Outlined.Layers),
    Option("movie", "Films", Icons.Outlined.Movie),
    Option("tv", "Series", Icons.Outlined.Tv),
)
private val YearOptions = listOf(
    Option("", "Any"),
    Option("2020s", "2020s"),
    Option("2010s", "2010s"),
    Option("2000s", "2000s"),
    Option("older", "Older"),
)
private val ReactionOptions = listOf(
    Option("", "All"),
    Option("loved", "Loved", Icons.Outlined.FavoriteBorder),
    Option("liked", "Liked", Icons.Outlined.ThumbUp),
    Option("disliked", "Disliked", Icons.Outlined.ThumbDown),
)

private fun sortOptions(shelf: Shelf, hasDates: Boolean) = listOfNotNull(
    Option("", "Your order"),
    Option("recent", if (shelf == Shelf.Watched) "Recently watched" else "Recently added"),
    Option("rating", "Highest rated"),
    if (hasDates) Option("year", "Newest release") else null,
)

private fun decade(year: String): IntRange? = when (year) {
    "2020s" -> 2020 until 2030
    "2010s" -> 2010 until 2020
    "2000s" -> 2000 until 2010
    "older" -> 0 until 2000
    else -> null
}

private fun SlateTitle.releaseYear(): Int? = releaseDate?.take(4)?.toIntOrNull()

private fun SlateTitle.recentKey(watchedShelf: Boolean): String =
    if (watchedShelf && status == LibraryStatus.watched && watchedAt != null) watchedAt else addedAt

/** The web's `filterAndSort` (lib/filter-utils.ts), on the phone's own models. */
internal fun filterAndSort(all: List<SlateTitle>, shelf: Shelf, filters: LibraryFilters): List<SlateTitle> {
    val scoped = if (shelf.status == null) interleaveShelves(all) else all
        .filter { it.status == shelf.status }
        .sortedWith(compareBy<SlateTitle> { it.position }.thenByDescending { it.recentKey(shelf == Shelf.Watched) })

    val reaction = if (shelf == Shelf.Watched) filters.reaction else ""
    val wantedRating = when (reaction) { "loved" -> 3; "liked" -> 2; "disliked" -> 1; else -> null }
    val genreId = filters.genre.toIntOrNull()
    val years = decade(filters.year)

    val filtered = scoped.filter { title ->
        (filters.format.isEmpty() || title.mediaType.name == filters.format) &&
            (wantedRating == null || title.rating?.toInt() == wantedRating) &&
            (genreId == null || title.genres.orEmpty().any { it.id == genreId }) &&
            (years == null || title.releaseYear()?.let { it in years } == true)
    }
    return when (filters.sort) {
        "recent" -> filtered.sortedByDescending { it.recentKey(shelf == Shelf.Watched || shelf == Shelf.All) }
        "rating" -> filtered.sortedByDescending { it.imdbRating ?: it.tmdbRating ?: Double.NEGATIVE_INFINITY }
        "year" -> filtered.sortedByDescending { it.releaseYear() ?: Int.MIN_VALUE }
        else -> filtered
    }
}

/** All shelves together: one from each in turn, so no shelf buries the others. */
private fun interleaveShelves(all: List<SlateTitle>): List<SlateTitle> {
    val shelves = listOf(LibraryStatus.want, LibraryStatus.watching, LibraryStatus.watched).map { status ->
        all.filter { it.status == status }
            .sortedWith(compareBy<SlateTitle> { it.position }.thenByDescending { it.addedAt })
    }
    val longest = shelves.maxOfOrNull { it.size } ?: 0
    return buildList {
        for (index in 0 until longest) shelves.forEach { shelf -> shelf.getOrNull(index)?.let(::add) }
    }
}

internal fun extractGenres(all: List<SlateTitle>): List<Genre> =
    all.flatMap { it.genres.orEmpty() }.distinctBy { it.id }.sortedBy { it.name }

@Composable
internal fun LibraryScreen(
    titles: List<SlateTitle>,
    newEpisodes: List<NewEpisode>,
    hasLists: Boolean,
    shelf: Shelf,
    onShelf: (Shelf) -> Unit,
    filters: LibraryFilters,
    onFilters: (LibraryFilters) -> Unit,
    onOpenTitle: (SlateTitle) -> Unit,
    onReorder: suspend (LibraryStatus, List<SlateTitle>) -> Unit,
    onAdd: () -> Unit,
    onAddFromLink: () -> Unit,
    onMakeList: suspend (String, List<String>) -> Unit,
    bottomInset: PaddingValues,
) {
    var sheetOpen by remember { mutableStateOf(false) }
    val genres = remember(titles) { extractGenres(titles) }
    // A genre that left the library no longer counts or filters.
    val effective = remember(filters, genres, shelf) {
        filters.copy(
            genre = filters.genre.takeIf { id -> genres.any { it.id.toString() == id } }.orEmpty(),
            reaction = if (shelf == Shelf.Watched) filters.reaction else "",
        )
    }
    val visible = remember(titles, shelf, effective) { filterAndSort(titles, shelf, effective) }
    val activeCount = listOf(effective.format, effective.genre, effective.year, effective.reaction).count { it.isNotEmpty() }
    val canReorder = shelf.status != null && effective.sort.isEmpty() && activeCount == 0

    Column(Modifier.fillMaxSize().background(SlateBackground)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = SlateGutter).padding(top = 4.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LiquidSelector(
                count = Shelf.entries.size,
                selectedIndex = shelf.ordinal,
                onSelect = { onShelf(Shelf.entries[it]) },
                // Fills the row on a phone; on a wide window it stops growing.
                modifier = Modifier.weight(1f, fill = false).widthIn(max = 420.dp).height(40.dp),
            ) { index ->
                Text(
                    Shelf.entries[index].label,
                    color = LocalContentColor.current,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    softWrap = false,
                )
            }
            FiltersButton(activeCount) { sheetOpen = true }
        }

        when {
            titles.isEmpty() -> EmptyLibrary(onAdd, onAddFromLink, bottomInset)
            else -> ReorderableLibraryGrid(
                source = visible,
                onOpen = onOpenTitle,
                reorderable = canReorder,
                modifier = Modifier.fillMaxSize().arriveOn(shelf to effective),
                contentPadding = PaddingValues(
                    start = SlateGutter,
                    end = SlateGutter,
                    bottom = bottomInset.calculateBottomPadding() + 16.dp,
                ),
                header = {
                    fullWidthItem("library-nudges") {
                        LibraryNudges(
                            titles = titles,
                            newEpisodes = newEpisodes,
                            hasLists = hasLists,
                            onOpenTitle = { id -> titles.firstOrNull { it.id == id }?.let(onOpenTitle) },
                            onAdd = onAdd,
                            onAddFromLink = onAddFromLink,
                            onMakeList = onMakeList,
                        )
                    }
                    if (visible.isEmpty()) {
                        fullWidthItem("library-no-match") {
                            EmptyMessage(
                                title = "No titles match",
                                body = "Try another shelf or clear a filter.",
                                modifier = Modifier.padding(top = 72.dp),
                            )
                        }
                    }
                },
                onCommit = { ordered -> shelf.status?.let { onReorder(it, ordered) } },
            )
        }
    }

    if (sheetOpen) {
        FilterSheet(
            shelf = shelf,
            filters = effective,
            genres = genres,
            hasDates = titles.any { it.releaseDate != null },
            resultCount = visible.size,
            onChange = onFilters,
            onDismiss = { sheetOpen = false },
        )
    }
}

/** One button for every filter. It turns to the theme colour and counts them once any is set. */
@Composable
private fun FiltersButton(activeCount: Int, onClick: () -> Unit) {
    val on = activeCount > 0
    val tint = if (on) SlateAccent else SlateMutedText
    Row(
        Modifier
            .height(40.dp)
            .widthIn(min = 40.dp)
            .pressable(onClick = onClick)
            .clip(CircleShape)
            .background(if (on) SlateAccent.copy(alpha = 0.12f) else SlateFill)
            .border(1.dp, if (on) SlateAccent.copy(alpha = 0.4f) else SlateBorder, CircleShape)
            .padding(horizontal = 12.dp)
            .semantics {
                contentDescription = if (on) "Filters, $activeCount applied" else "Filters"
            },
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Tune, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        if (on) Text("$activeCount", color = tint, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun FilterSheet(
    shelf: Shelf,
    filters: LibraryFilters,
    genres: List<Genre>,
    hasDates: Boolean,
    resultCount: Int,
    onChange: (LibraryFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val close: () -> Unit = {
        scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SlateSurface,
        contentColor = Color.White,
        scrimColor = Color.Black.copy(alpha = 0.6f),
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = {
            Box(
                Modifier.padding(top = 12.dp, bottom = 8.dp).size(width = 40.dp, height = 5.dp)
                    .clip(CircleShape).background(Color.White.copy(alpha = 0.18f)),
            )
        },
    ) {
        FilterPanel(
            shelf = shelf,
            filters = filters,
            genres = genres,
            hasDates = hasDates,
            resultCount = resultCount,
            onChange = onChange,
            onDone = close,
            bottomPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 16.dp,
        )
    }
}

/** What the Filters sheet holds, apart from the sheet itself. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FilterPanel(
    shelf: Shelf,
    filters: LibraryFilters,
    genres: List<Genre>,
    hasDates: Boolean,
    resultCount: Int,
    onChange: (LibraryFilters) -> Unit,
    onDone: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp,
) {
    val activeCount = listOf(filters.format, filters.genre, filters.year, filters.reaction).count { it.isNotEmpty() }
    run {
        Column(Modifier.fillMaxWidth().padding(horizontal = SlateGutter)) {
            Row(Modifier.fillMaxWidth().height(40.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Filters",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                if (activeCount > 0) {
                    Text(
                        "Clear all",
                        color = SlateMutedText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .pressable { onChange(filters.cleared()) }
                            .padding(start = 12.dp, top = 10.dp, bottom = 10.dp),
                    )
                }
            }

            Column(
                Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(top = 8.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                PanelSection("Format") {
                    SegmentedOptions(FormatOptions, filters.format) { onChange(filters.copy(format = it)) }
                }
                if (genres.isNotEmpty()) {
                    PanelSection("Genre") {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            GenreChip("All", filters.genre.isEmpty()) { onChange(filters.copy(genre = "")) }
                            genres.forEach { genre ->
                                val id = genre.id.toString()
                                GenreChip(genre.name, filters.genre == id) { onChange(filters.copy(genre = id)) }
                            }
                        }
                    }
                }
                PanelSection("Year") {
                    SegmentedOptions(YearOptions, filters.year) { onChange(filters.copy(year = it)) }
                }
                if (shelf == Shelf.Watched) {
                    PanelSection("Reaction") {
                        SegmentedOptions(ReactionOptions, filters.reaction) { onChange(filters.copy(reaction = it)) }
                    }
                }
                PanelSection("Sort by") {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        sortOptions(shelf, hasDates).forEach { option ->
                            SortRow(option.label, option.value == filters.sort) { onChange(filters.copy(sort = option.value)) }
                        }
                    }
                }
            }

            SlatePrimaryButton(
                label = when (resultCount) {
                    0 -> "No titles match"
                    1 -> "Show 1 title"
                    else -> "Show $resultCount titles"
                },
                onClick = onDone,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .padding(bottom = bottomPadding),
            )
        }
    }
}

@Composable
private fun PanelSection(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label,
            color = SlateMutedText,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 4.dp).semantics { heading() },
        )
        content()
    }
}

@Composable
private fun SegmentedOptions(options: List<Option>, value: String, onChange: (String) -> Unit) {
    LiquidSelector(
        count = options.size,
        selectedIndex = options.indexOfFirst { it.value == value }.coerceAtLeast(0),
        onSelect = { onChange(options[it].value) },
        modifier = Modifier.fillMaxWidth().height(44.dp),
    ) { index ->
        val option = options[index]
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Icons give way first when four or more options share a phone's width.
            if (option.icon != null && options.size <= 3) {
                Icon(option.icon, contentDescription = null, modifier = Modifier.size(16.dp))
            }
            Text(
                option.label,
                color = LocalContentColor.current,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                softWrap = false,
            )
        }
    }
}

@Composable
private fun GenreChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .height(40.dp)
            .pressable(role = Role.RadioButton, onClick = onClick)
            .clip(CircleShape)
            .background(if (active) SlateAccent.copy(alpha = 0.12f) else SlateFill)
            .border(1.dp, if (active) SlateAccent.copy(alpha = 0.4f) else SlateBorder, CircleShape)
            .padding(horizontal = 14.dp)
            .semantics { selected = active },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) SlateAccent else SlateMutedText,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Composable
private fun SortRow(label: String, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .pressable(role = Role.RadioButton, onClick = onClick)
            .clip(RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp)
            .semantics { selected = active },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = if (active) Color.White else SlateMutedText,
            fontSize = 14.sp,
            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (active) {
            Icon(Icons.Outlined.Check, contentDescription = null, tint = SlateAccent, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun EmptyLibrary(onAdd: () -> Unit, onAddFromLink: () -> Unit, bottomInset: PaddingValues) {
    Box(
        Modifier.fillMaxSize().padding(bottom = bottomInset.calculateBottomPadding()),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 320.dp).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            EmptyMessage(
                title = "Your slate is empty",
                body = "Add the first title you do not want to forget, or bring some over from a link.",
            )
            Spacer(Modifier.height(20.dp))
            SlatePrimaryButton("Add a title", Modifier.fillMaxWidth(), onClick = onAdd)
            Spacer(Modifier.height(8.dp))
            SlateSecondaryButton("Add from a link", Modifier.fillMaxWidth(), onClick = onAddFromLink)
        }
    }
}

@Composable
internal fun EmptyMessage(title: String, body: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(body, color = SlateMutedText, fontSize = 14.sp, lineHeight = 20.sp, textAlign = TextAlign.Center)
    }
}
