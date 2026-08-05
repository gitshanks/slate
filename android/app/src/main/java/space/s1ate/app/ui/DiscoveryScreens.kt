package space.s1ate.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import space.s1ate.app.SlateViewModel
import space.s1ate.app.model.CatalogPerson
import space.s1ate.app.model.CatalogSearchPayload
import space.s1ate.app.model.CatalogTitle
import space.s1ate.app.model.DiscoverDetailPayload
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.PersonDetailPayload
import space.s1ate.app.model.TitlePerson

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    model: SlateViewModel,
    onBack: () -> Unit,
    onOpenTitle: (MediaType, Int) -> Unit,
    onOpenSaved: (String) -> Unit,
    onOpenPerson: (Int) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<CatalogSearchPayload?>(null) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(query) {
        val clean = query.trim()
        if (clean.isEmpty()) { result = null; loading = false; return@LaunchedEffect }
        loading = true
        delay(260)
        runCatching { model.search(clean) }
            .onSuccess { result = it }
            .onFailure { model.showMessage(it.message ?: "Search did not finish.") }
        loading = false
    }

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TopAppBar(
            title = { Text("Search", fontWeight = FontWeight.Bold) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } },
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Titles, cast, crew") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
        )
        when {
            query.isBlank() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.PersonSearch, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(12.dp))
                    Text("Find your next watch", fontWeight = FontWeight.SemiBold)
                    Text("Search films, series, cast, and crew.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(strokeWidth = 2.dp)
            }
            else -> LazyColumn(
                Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                result?.people?.takeIf { it.isNotEmpty() }?.let { people ->
                    item { PeopleSearchRail(people, onOpenPerson) }
                }
                result?.approximateQuery?.let { close ->
                    item {
                        Text(
                            "Showing close matches for “$close”",
                            modifier = Modifier.padding(horizontal = 18.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp,
                        )
                    }
                }
                result?.results.orEmpty().chunked(2).forEach { row ->
                    item(key = row.joinToString { it.id }) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            row.forEach { title ->
                                CatalogTileCard(
                                    title,
                                    Modifier.weight(1f),
                                    onClick = { title.saved?.let { onOpenSaved(it.id) } ?: onOpenTitle(title.mediaType, title.tmdbId) },
                                )
                            }
                            repeat(2 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun PeopleSearchRail(people: List<CatalogPerson>, onOpen: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("PEOPLE", Modifier.padding(horizontal = 18.dp), fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(
            Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            people.forEach { person ->
                Column(Modifier.width(92.dp).clickable { onOpen(person.id) }, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    AsyncImage(person.profileUrl, person.name, Modifier.size(92.dp).clip(RoundedCornerShape(15.dp)), contentScale = ContentScale.Crop)
                    Text(person.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(person.knownForDepartment ?: "Person", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
            }
        }
    }
}

@Composable
fun CatalogTileCard(title: CatalogTitle, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier.clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box {
            AsyncImage(
                title.posterUrl,
                title.title,
                Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(15.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop,
            )
            if (title.saved != null) {
                Icon(
                    Icons.Outlined.Check,
                    null,
                    tint = Color.Black,
                    modifier = Modifier.align(Alignment.TopEnd).padding(9.dp).background(Color.White.copy(alpha = 0.9f), CircleShape).padding(6.dp).size(15.dp),
                )
            }
        }
        Text(title.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(title.year ?: title.mediaType.name.replaceFirstChar(Char::uppercase), fontSize = 12.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun DiscoverScreen(
    model: SlateViewModel,
    mediaType: MediaType,
    tmdbId: Int,
    onBack: () -> Unit,
    onOpenSaved: (String) -> Unit,
    onOpenTitle: (MediaType, Int) -> Unit,
    onOpenPerson: (Int) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var detail by remember(mediaType, tmdbId) { mutableStateOf<DiscoverDetailPayload?>(null) }
    var addMenu by remember { mutableStateOf(false) }
    var adding by remember { mutableStateOf(false) }

    LaunchedEffect(mediaType, tmdbId) {
        runCatching { model.discover(mediaType, tmdbId) }
            .onSuccess { detail = it }
            .onFailure { model.showMessage(it.message ?: "Title could not be loaded.") }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (detail == null) {
            CircularProgressIndicator(Modifier.align(Alignment.Center), strokeWidth = 2.dp)
        } else {
            val current = detail!!
            LazyColumn(Modifier.fillMaxSize()) {
                item {
                    Box(Modifier.fillMaxWidth().height(430.dp)) {
                        AsyncImage(current.title.backdropUrl, current.title.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(0.1f), Color.Black.copy(0.52f), Color.Black))))
                        IconButton(onBack, Modifier.align(Alignment.TopStart).padding(14.dp).background(Color.Black.copy(0.38f), CircleShape)) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back", tint = Color.White)
                        }
                    }
                }
                item {
                    Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 48.dp)) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(if (mediaType == MediaType.movie) "FILM" else "SERIES", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White.copy(0.62f))
                            current.title.year?.let { Text("· $it", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White.copy(0.62f)) }
                            current.title.runtime?.let { Text("· ${if (it >= 60) "${it / 60}H ${it % 60}M" else "${it}M"}", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White.copy(0.62f)) }
                        }
                        Text(current.title.title, color = Color.White, fontSize = 38.sp, lineHeight = 39.sp, letterSpacing = (-1.7).sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                        Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            current.savedTitle?.let { saved ->
                                DiscoveryPill("In your ${saved.status.label.lowercase()}", Icons.Outlined.Check, true) { onOpenSaved(saved.id) }
                            } ?: Box {
                                DiscoveryPill(if (adding) "Adding…" else "Add to slate", Icons.Outlined.Schedule, true) { addMenu = true }
                                DropdownMenu(addMenu, { addMenu = false }) {
                                    listOf(LibraryStatus.want, LibraryStatus.watching, LibraryStatus.watched).forEach { status ->
                                        DropdownMenuItem(
                                            text = { Text(status.label) },
                                            onClick = {
                                                addMenu = false; adding = true
                                                scope.launch {
                                                    runCatching { model.addCatalogTitle(tmdbId, mediaType, status) }
                                                        .onSuccess { detail = current.copy(savedTitle = it) }
                                                        .onFailure { model.showMessage(it.message ?: "Could not add title.") }
                                                    adding = false
                                                }
                                            },
                                        )
                                    }
                                }
                            }
                            current.trailerKey?.let { key ->
                                val context = androidx.compose.ui.platform.LocalContext.current
                                DiscoveryPill("Trailer", Icons.Outlined.PlayArrow) {
                                    context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://www.youtube.com/watch?v=$key")))
                                }
                            }
                        }
                        current.title.overview?.takeIf(String::isNotBlank)?.let {
                            Text(it, color = Color.White.copy(0.82f), fontSize = 16.sp, lineHeight = 25.sp, modifier = Modifier.padding(top = 24.dp))
                        }
                        DiscoveryPeople("Cast", current.cast, onOpenPerson)
                        DiscoveryPeople("Crew", current.crew, onOpenPerson)
                        DiscoveryRecommendations(current.title.title, current.recommendations, onOpenTitle)
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoveryPill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, highlighted: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(if (highlighted) Color(0xFF9B7BFF).copy(0.2f) else Color.White.copy(0.07f)).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(17.dp), tint = if (highlighted) Color(0xFFB89BFF) else Color.White.copy(0.82f))
        Text(label, color = if (highlighted) Color(0xFFB89BFF) else Color.White.copy(0.82f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun DiscoveryPeople(label: String, people: List<TitlePerson>, onOpen: (Int) -> Unit) {
    if (people.isEmpty()) return
    Column(Modifier.padding(top = 44.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(label, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        people.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { person ->
                    Column(Modifier.weight(1f).clickable { onOpen(person.id) }, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        AsyncImage(person.profileUrl, person.name, Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(13.dp)), contentScale = ContentScale.Crop)
                        Text(person.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                        Text(person.subtitle.orEmpty(), color = Color.White.copy(0.48f), fontSize = 10.sp, maxLines = 1)
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun DiscoveryRecommendations(label: String, titles: List<CatalogTitle>, onOpen: (MediaType, Int) -> Unit) {
    if (titles.isEmpty()) return
    Column(Modifier.padding(top = 48.dp), verticalArrangement = Arrangement.spacedBy(17.dp)) {
        Text("If you liked $label…", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        titles.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                row.forEach { title -> CatalogTileCard(title, Modifier.weight(1f)) { onOpen(title.mediaType, title.tmdbId) } }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
fun PersonScreen(model: SlateViewModel, personId: Int, onBack: () -> Unit, onOpenTitle: (MediaType, Int) -> Unit) {
    var person by remember(personId) { mutableStateOf<PersonDetailPayload?>(null) }
    LaunchedEffect(personId) {
        runCatching { model.person(personId) }.onSuccess { person = it }.onFailure { model.showMessage(it.message ?: "Person could not be loaded.") }
    }
    LazyColumn(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 12.dp, start = 8.dp, end = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                Spacer(Modifier.weight(1f))
            }
        }
        person?.let { value ->
            item {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.Top) {
                        AsyncImage(value.profileUrl, value.name, Modifier.width(128.dp).height(192.dp).clip(RoundedCornerShape(18.dp)), contentScale = ContentScale.Crop)
                        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text(value.knownForDepartment.uppercase(), fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(value.name, fontSize = 32.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold)
                            value.birthday?.let { Text(it.take(4), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            value.placeOfBirth?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    value.biography?.takeIf(String::isNotBlank)?.let { Text(it, color = Color.White.copy(0.8f), lineHeight = 24.sp) }
                    Text("Known for", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    value.knownFor.chunked(3).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                            row.forEach { title -> CatalogTileCard(title, Modifier.weight(1f)) { onOpenTitle(title.mediaType, title.tmdbId) } }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        } ?: item { Box(Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(strokeWidth = 2.dp) } }
    }
}
