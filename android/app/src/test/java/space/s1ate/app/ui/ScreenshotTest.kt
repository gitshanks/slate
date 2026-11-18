package space.s1ate.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import coil3.ColorImage
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.annotation.DelicateCoilApi
import coil3.annotation.ExperimentalCoilApi
import coil3.test.FakeImageLoaderEngine
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import space.s1ate.app.model.DiscoverRail
import space.s1ate.app.model.DiscoverRailItem
import space.s1ate.app.model.Genre
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.NewEpisode
import space.s1ate.app.model.SlateTitle

/**
 * Renders the main screens to PNG files under `app/build/shots/` so spacing can
 * be checked at phone sizes on a machine with no emulator. Posters are flat
 * colour blocks; everything else is the real layout.
 */
@OptIn(ExperimentalCoilApi::class, DelicateCoilApi::class)
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], application = android.app.Application::class)
class ScreenshotTest {
    @Before
    fun fakePosters() {
        val engine = FakeImageLoaderEngine.Builder()
            .default(ColorImage(0xFF3B4A5A.toInt(), width = 200, height = 300))
            .build()
        SingletonImageLoader.setUnsafe(
            ImageLoader.Builder(ApplicationProvider.getApplicationContext()).components { add(engine) }.build(),
        )
    }

    private val genres = listOf(
        Genre(28, "Action"), Genre(12, "Adventure"), Genre(35, "Comedy"), Genre(80, "Crime"),
        Genre(18, "Drama"), Genre(14, "Fantasy"), Genre(27, "Horror"), Genre(9648, "Mystery"),
        Genre(10749, "Romance"), Genre(878, "Science Fiction"), Genre(53, "Thriller"),
    )

    private fun title(index: Int, status: LibraryStatus, rating: Double? = null) = SlateTitle(
        id = "t$index",
        tmdbId = index,
        mediaType = if (index % 3 == 0) MediaType.tv else MediaType.movie,
        title = "Title $index",
        posterPath = "/p$index.jpg",
        releaseDate = "${1996 + index}-05-01",
        genres = listOf(genres[index % genres.size], genres[(index + 4) % genres.size]),
        status = status,
        rating = rating,
        favorite = false,
        addedAt = "2026-11-${10 + index % 9}T10:00:00Z",
        updatedAt = "2026-11-10T10:00:00Z",
        position = index,
        imdbRating = 6.0 + index % 4,
    )

    private val library = (1..14).map { title(it, LibraryStatus.want) } +
        (15..18).map { title(it, LibraryStatus.watching) } +
        (19..27).map { title(it, LibraryStatus.watched, rating = (it % 3 + 1).toDouble()) }

    private val episodes = listOf(
        NewEpisode("t15", "Slow Horses", "/e1.jpg", 5, 3, "Tall Tales", "2026-11-17"),
        NewEpisode("t18", "The Diplomat", "/e2.jpg", 3, 6, "Amagansett", "2026-11-12"),
    )

    private val dock = listOf(
        "Library" to Icons.Outlined.GridView,
        "Discover" to Icons.Outlined.Explore,
        "Lists" to Icons.Outlined.Layers,
    )

    @Composable
    private fun Frame(tab: Int, content: @Composable (PaddingValues) -> Unit) {
        SlateTheme {
            Box(Modifier.fillMaxSize().background(SlateBackground)) {
                Column(Modifier.fillMaxSize()) {
                    SlateTopBar(profile = null, avatarBytes = null, onLogo = {}, onProfile = {})
                    content(PaddingValues(bottom = SlateDockHeight))
                }
                SlateDock(dock, tab, {}, {}, Modifier.align(Alignment.BottomCenter))
            }
        }
    }

    @Composable
    private fun Library(titles: List<SlateTitle>, shelf: Shelf, filters: LibraryFilters = LibraryFilters(), hasLists: Boolean = true, episodes: List<NewEpisode> = emptyList()) {
        Frame(0) { inset ->
            LibraryScreen(
                titles = titles,
                newEpisodes = episodes,
                hasLists = hasLists,
                shelf = shelf,
                onShelf = {},
                filters = filters,
                onFilters = {},
                onOpenTitle = {},
                onReorder = { _, _ -> },
                onAdd = {},
                onAddFromLink = {},
                onMakeList = { _, _ -> },
                bottomInset = inset,
            )
        }
    }

    @Composable
    private fun Sheet(shelf: Shelf, filters: LibraryFilters, count: Int) {
        SlateTheme {
            Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.BottomCenter) {
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        .background(SlateSurface).padding(top = 25.dp),
                ) {
                    FilterPanel(shelf, filters, genres, true, count, {}, {}, 16.dp)
                }
            }
        }
    }

    private fun shot(name: String, content: @Composable () -> Unit) =
        captureRoboImage("build/shots/$name.png") { content() }

    @Test @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun library360() = shot("library-upnext-360") { Library(library, Shelf.UpNext) }

    @Test @Config(qualifiers = "w320dp-h640dp-xhdpi")
    fun library320() = shot("library-watched-filtered-320") {
        Library(library, Shelf.Watched, LibraryFilters(format = "movie", year = "2010s"))
    }

    @Test @Config(qualifiers = "w412dp-h915dp-xxhdpi")
    fun libraryAll412() = shot("library-all-nudges-412") {
        Library(library, Shelf.All, hasLists = false, episodes = episodes)
    }

    @Test @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun librarySmall() = shot("library-small-360") { Library(library.take(3), Shelf.UpNext) }

    @Test @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun libraryEmpty() = shot("library-empty-360") { Library(emptyList(), Shelf.UpNext) }

    @Test @Config(qualifiers = "w800dp-h1280dp-xhdpi")
    fun libraryTablet() = shot("library-tablet-800") { Library(library, Shelf.UpNext, hasLists = false) }

    @Test @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun sheet360() = shot("filters-watched-360") {
        Sheet(Shelf.Watched, LibraryFilters(format = "tv", genre = "18", reaction = "loved", sort = "recent"), 4)
    }

    @Test @Config(qualifiers = "w320dp-h640dp-xhdpi")
    fun sheet320() = shot("filters-upnext-320") { Sheet(Shelf.UpNext, LibraryFilters(), 14) }

    @Test @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun discover360() = shot("discover-360") {
        val rails = listOf("Based on your library", "Trending this week", "Now playing").mapIndexed { r, name ->
            DiscoverRail("r$r", name, (1..8).map { DiscoverRailItem(r * 10 + it, MediaType.movie, "Film $it", "/d$r$it.jpg", saved = it == 2) })
        }
        Frame(1) { inset -> DiscoverHomeScreen(rails, {}, { _, _ -> }, inset) }
    }
}
