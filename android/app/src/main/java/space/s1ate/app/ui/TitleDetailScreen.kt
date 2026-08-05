package space.s1ate.app.ui

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.PlaylistAdd
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.SmartDisplay
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import space.s1ate.app.SlateViewModel
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.SlateTitle
import space.s1ate.app.model.TitleDetailPayload
import space.s1ate.app.model.TitleListOption
import space.s1ate.app.model.TitlePerson
import space.s1ate.app.model.TitleRecommendation
import space.s1ate.app.model.TitleWatchProvider

private val SlateViolet = Color(0xFF9B7BFF)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TitleDetailScreen(
    title: SlateTitle,
    model: SlateViewModel,
    onBack: () -> Unit,
    onRemoved: () -> Unit,
    onOpenTitle: (MediaType, Int) -> Unit,
    onOpenPerson: (Int) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var detail by remember(title.id) { mutableStateOf<TitleDetailPayload?>(null) }
    var loading by remember(title.id) { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var statusMenu by remember { mutableStateOf(false) }
    var ratingMenu by remember { mutableStateOf(false) }
    var moreSheet by remember { mutableStateOf(false) }
    var providerSheet by remember { mutableStateOf(false) }
    var listSheet by remember { mutableStateOf(false) }
    var noteDialog by remember { mutableStateOf(false) }
    var removeDialog by remember { mutableStateOf(false) }
    val current = detail?.title ?: title

    fun launchUrl(value: String) {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(value))) }
            .onFailure { error = "That link could not be opened." }
    }

    LaunchedEffect(title.id) {
        runCatching { model.titleDetail(title.id) }
            .onSuccess { detail = it }
            .onFailure { error = it.message }
        loading = false
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Box(Modifier.fillMaxWidth().height(430.dp)) {
                    AsyncImage(
                        model = current.backdropUrl ?: current.posterUrl,
                        contentDescription = current.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(
                        Modifier.fillMaxSize().background(
                            Brush.verticalGradient(
                                listOf(Color.Black.copy(alpha = 0.16f), Color.Black.copy(alpha = 0.5f), Color.Black),
                            ),
                        ),
                    )
                    Box(
                        Modifier.fillMaxSize().background(
                            Brush.horizontalGradient(listOf(Color.Black.copy(alpha = 0.66f), Color.Transparent)),
                        ),
                    )
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.align(Alignment.TopStart).padding(14.dp).background(
                            Color.Black.copy(alpha = 0.38f), CircleShape,
                        ),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back", tint = Color.White)
                    }
                }
            }

            item {
                Column(Modifier.padding(start = 18.dp, end = 18.dp, bottom = 24.dp)) {
                    Metadata(current)
                    Text(
                        current.title,
                        modifier = Modifier.padding(top = 8.dp),
                        color = Color.White,
                        fontSize = 38.sp,
                        lineHeight = 39.sp,
                        letterSpacing = (-1.7).sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Row(
                        Modifier.padding(top = 22.dp).horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(9.dp),
                    ) {
                        Box {
                            ActionPill(current.status.label, statusIcon(current.status), highlighted = true) {
                                statusMenu = true
                            }
                            DropdownMenu(expanded = statusMenu, onDismissRequest = { statusMenu = false }) {
                                listOf(
                                    Triple(LibraryStatus.want, "Want", Icons.Outlined.Schedule),
                                    Triple(LibraryStatus.watching, "Watching", Icons.Outlined.Visibility),
                                    Triple(LibraryStatus.watched, "Watched", Icons.Outlined.Check),
                                ).forEach { (status, label, icon) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        leadingIcon = { Icon(icon, null) },
                                        onClick = {
                                            statusMenu = false
                                            scope.launch {
                                                runCatching { model.setStatus(current.id, status) }
                                                    .onSuccess { updated -> detail = detail?.copy(title = updated) }
                                                    .onFailure { error = it.message }
                                            }
                                        },
                                    )
                                }
                            }
                        }
                        Box {
                            ActionPill(ratingLabel(current.rating), ratingIcon(current.rating)) { ratingMenu = true }
                            DropdownMenu(expanded = ratingMenu, onDismissRequest = { ratingMenu = false }) {
                                listOf(
                                    Triple(3, "Love", Icons.Outlined.Favorite),
                                    Triple(2, "Like", Icons.Outlined.ThumbUp),
                                    Triple(1, "Dislike", Icons.Outlined.ThumbDown),
                                ).forEach { (rating, label, icon) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        leadingIcon = { Icon(icon, null) },
                                        onClick = {
                                            ratingMenu = false
                                            scope.launch {
                                                runCatching { model.setRating(current.id, rating) }
                                                    .onSuccess { updated -> detail = detail?.copy(title = updated) }
                                                    .onFailure { error = it.message }
                                            }
                                        },
                                    )
                                }
                                if (current.rating != null) {
                                    HorizontalDivider()
                                    DropdownMenuItem(
                                        text = { Text("Clear") },
                                        leadingIcon = { Icon(Icons.Outlined.Close, null) },
                                        onClick = {
                                            ratingMenu = false
                                            scope.launch {
                                                runCatching { model.setRating(current.id, null) }
                                                    .onSuccess { updated -> detail = detail?.copy(title = updated) }
                                                    .onFailure { error = it.message }
                                            }
                                        },
                                    )
                                }
                            }
                        }
                        ActionPill("More", Icons.Outlined.MoreHoriz) { moreSheet = true }
                    }

                    current.overview?.takeIf(String::isNotBlank)?.let {
                        Text(
                            it,
                            modifier = Modifier.padding(top = 24.dp),
                            color = Color.White.copy(alpha = 0.82f),
                            fontSize = 16.sp,
                            lineHeight = 25.sp,
                        )
                    }
                    current.review?.takeIf(String::isNotBlank)?.let { NoteCard(it) }

                    if (loading) {
                        Box(Modifier.fillMaxWidth().padding(vertical = 70.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                        }
                    } else {
                        detail?.cast?.takeIf(List<*>::isNotEmpty)?.let { PeopleSection("Cast", it, onOpenPerson) }
                        detail?.crew?.takeIf(List<*>::isNotEmpty)?.let { PeopleSection("Crew", it, onOpenPerson) }
                        detail?.recommendations?.takeIf(List<*>::isNotEmpty)?.let {
                            RecommendationsSection(current.title, it, onOpenTitle)
                        }
                    }
                }
            }
        }

        error?.let { message ->
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(16.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF252129))
                    .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = message,
                    modifier = Modifier.weight(1f),
                    color = Color.White.copy(alpha = 0.86f),
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                )
                TextButton(onClick = { error = null }) { Text("Dismiss") }
            }
        }
    }

    if (moreSheet) {
        ModalBottomSheet(onDismissRequest = { moreSheet = false }, containerColor = Color(0xFF151418)) {
            Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 28.dp)) {
                detail?.trailerKey?.let { key ->
                    SheetAction("Watch trailer", Icons.Outlined.PlayArrow) {
                        moreSheet = false
                        launchUrl("https://www.youtube.com/watch?v=$key")
                    }
                }
                if (!detail?.watchProviders?.providers.isNullOrEmpty()) {
                    SheetAction("Where to watch", Icons.Outlined.SmartDisplay) {
                        moreSheet = false
                        providerSheet = true
                    }
                }
                SheetAction("Add to list", Icons.AutoMirrored.Outlined.PlaylistAdd) {
                    moreSheet = false
                    listSheet = true
                }
                SheetAction(if (current.review.isNullOrBlank()) "Add note" else "Edit note", Icons.Outlined.EditNote) {
                    moreSheet = false
                    noteDialog = true
                }
                HorizontalDivider(Modifier.padding(vertical = 8.dp), color = Color.White.copy(alpha = 0.09f))
                SheetAction("Remove from library", Icons.Outlined.Delete, danger = true) {
                    moreSheet = false
                    removeDialog = true
                }
            }
        }
    }

    if (providerSheet) {
        ModalBottomSheet(onDismissRequest = { providerSheet = false }, containerColor = Color(0xFF151418)) {
            Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 28.dp)) {
                Text("Where to watch", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(15.dp))
                detail?.watchProviders?.providers.orEmpty().forEach { provider ->
                    ProviderRow(provider) {
                        providerSheet = false
                        launchUrl(providerUrl(provider, current.title, detail?.watchProviders?.link))
                    }
                }
            }
        }
    }

    if (listSheet) {
        ListSheet(
            lists = detail?.lists.orEmpty(),
            onDismiss = { listSheet = false },
            onAdd = { list ->
                runCatching { model.addTitleToList(current.id, listId = list.id) }
                    .onSuccess { updated ->
                        detail = detail?.copy(lists = detail?.lists.orEmpty().map {
                            if (it.id == updated.id) updated else it
                        })
                        listSheet = false
                    }
                    .onFailure { error = it.message }
            },
            onCreate = { name ->
                runCatching { model.addTitleToList(current.id, name = name) }
                    .onSuccess { created ->
                        detail = detail?.copy(lists = detail?.lists.orEmpty() + created)
                        listSheet = false
                    }
                    .onFailure { error = it.message }
            },
        )
    }

    if (noteDialog) {
        var note by remember(noteDialog) { mutableStateOf(current.review.orEmpty()) }
        AlertDialog(
            onDismissRequest = { noteDialog = false },
            title = { Text(current.title) },
            text = {
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    modifier = Modifier.fillMaxWidth().height(170.dp),
                    label = { Text("Your private note") },
                )
            },
            dismissButton = { TextButton(onClick = { noteDialog = false }) { Text("Cancel") } },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        runCatching { model.setReview(current.id, note) }
                            .onSuccess { updated ->
                                detail = detail?.copy(title = updated)
                                noteDialog = false
                            }
                            .onFailure { error = it.message }
                    }
                }) { Text("Save") }
            },
        )
    }

    if (removeDialog) {
        AlertDialog(
            onDismissRequest = { removeDialog = false },
            title = { Text("Remove ${current.title}?") },
            text = { Text("This removes it from your library and lists.") },
            dismissButton = { TextButton(onClick = { removeDialog = false }) { Text("Cancel") } },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        runCatching { model.removeTitle(current.id) }
                            .onSuccess { onRemoved() }
                            .onFailure { error = it.message }
                    }
                }) { Text("Remove", color = MaterialTheme.colorScheme.error) }
            },
        )
    }

}

@Composable
private fun Metadata(title: SlateTitle) {
    Row(
        Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        title.runtime?.let { MetaText(if (it >= 60) "${it / 60}H ${it % 60}M" else "${it}M") }
        title.year?.let { MetaText(it) }
        title.imdbRating?.let { RatingChip("IMDb", String.format("%.1f", it)) }
        title.rottenTomatoesScore?.let { RatingChip("RT", "$it%") }
            ?: title.metacriticScore?.let { RatingChip("MC", "$it") }
        title.genres.orEmpty().take(3).forEach { MetaText(it.name.uppercase()) }
    }
}

@Composable
private fun MetaText(value: String) {
    Text(value, color = Color.White.copy(alpha = 0.62f), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
}

@Composable
private fun RatingChip(label: String, value: String) {
    Row(
        Modifier.background(Color.Black.copy(alpha = 0.46f), CircleShape).padding(horizontal = 7.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = Color.White.copy(alpha = 0.82f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Text(value, color = Color.White.copy(alpha = 0.82f), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun ActionPill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, highlighted: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (highlighted) SlateViolet.copy(alpha = 0.19f) else Color.White.copy(alpha = 0.07f))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (highlighted) SlateViolet else Color.White.copy(alpha = 0.82f), modifier = Modifier.size(17.dp))
        Text(label, color = if (highlighted) SlateViolet else Color.White.copy(alpha = 0.82f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun NoteCard(review: String) {
    Column(
        Modifier.padding(top = 30.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.055f)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("YOUR NOTE", color = Color.White.copy(alpha = 0.46f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
        Text(review, color = Color.White.copy(alpha = 0.84f), fontSize = 15.sp, lineHeight = 22.sp)
    }
}

@Composable
private fun PeopleSection(label: String, people: List<TitlePerson>, onOpenPerson: (Int) -> Unit) {
    Column(Modifier.padding(top = 44.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(label, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        people.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { person ->
                    Column(
                        Modifier.weight(1f).clickable { onOpenPerson(person.id) },
                        verticalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        AsyncImage(
                            model = person.profileUrl,
                            contentDescription = person.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(13.dp)).background(Color.White.copy(alpha = 0.06f)),
                        )
                        Text(person.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        person.subtitle?.let { Text(it, color = Color.White.copy(alpha = 0.48f), fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun RecommendationsSection(label: String, items: List<TitleRecommendation>, onOpenTitle: (MediaType, Int) -> Unit) {
    Column(Modifier.padding(top = 48.dp), verticalArrangement = Arrangement.spacedBy(17.dp)) {
        Text("If you liked $label…", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        items.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                row.forEach { item ->
                    Column(
                        Modifier.weight(1f).clickable { onOpenTitle(item.mediaType, item.tmdbId) },
                        verticalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        AsyncImage(
                            model = item.posterUrl,
                            contentDescription = item.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(13.dp)).background(Color.White.copy(alpha = 0.06f)),
                        )
                        Text(item.title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        item.year?.let { Text(it, color = Color.White.copy(alpha = 0.48f), fontSize = 11.sp, fontFamily = FontFamily.Monospace) }
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun SheetAction(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (danger) MaterialTheme.colorScheme.error else Color.White, modifier = Modifier.size(21.dp))
        Spacer(Modifier.width(13.dp))
        Text(label, color = if (danger) MaterialTheme.colorScheme.error else Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun ProviderRow(provider: TitleWatchProvider, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(provider.logoUrl, provider.name, Modifier.size(42.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop)
        Spacer(Modifier.width(14.dp))
        Text(provider.name, color = Color.White, fontSize = 16.sp, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, tint = Color.White.copy(alpha = 0.42f), modifier = Modifier.size(18.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ListSheet(
    lists: List<TitleListOption>,
    onDismiss: () -> Unit,
    onAdd: suspend (TitleListOption) -> Unit,
    onCreate: suspend (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF151418)) {
        Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 28.dp)) {
            Text("Add to list", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(14.dp))
            lists.forEach { list ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).clickable(enabled = !busy && !list.containsTitle) {
                        busy = true
                        scope.launch { onAdd(list); busy = false }
                    }.padding(vertical = 13.dp, horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(list.name, color = Color.White, modifier = Modifier.weight(1f))
                    if (list.containsTitle) Icon(Icons.Outlined.Check, null, tint = SlateViolet)
                }
            }
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("New list") },
                modifier = Modifier.fillMaxWidth().padding(top = 15.dp),
                singleLine = true,
            )
            Button(
                onClick = { busy = true; scope.launch { onCreate(name.trim()); busy = false } },
                enabled = name.isNotBlank() && !busy,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SlateViolet, contentColor = Color.Black),
            ) { Text("Create and add", fontWeight = FontWeight.SemiBold) }
        }
    }
}

private fun statusIcon(status: LibraryStatus) = when (status) {
    LibraryStatus.want -> Icons.Outlined.Schedule
    LibraryStatus.watching -> Icons.Outlined.Visibility
    LibraryStatus.watched -> Icons.Outlined.Check
    LibraryStatus.dropped -> Icons.Outlined.Close
}

private fun ratingLabel(rating: Double?) = when (rating) { 3.0 -> "Love"; 2.0 -> "Like"; 1.0 -> "Dislike"; else -> "Rate" }
private fun ratingIcon(rating: Double?) = when (rating) { 3.0 -> Icons.Outlined.Favorite; 2.0 -> Icons.Outlined.ThumbUp; 1.0 -> Icons.Outlined.ThumbDown; else -> Icons.Outlined.Close }

private fun providerUrl(provider: TitleWatchProvider, title: String, fallback: String?): String {
    val query = Uri.encode(title)
    return when (provider.id) {
        8, 1796 -> "https://www.netflix.com/search?q=$query"
        15 -> "https://www.hulu.com/search?q=$query"
        337 -> "https://www.disneyplus.com/search?q=$query"
        384, 1899 -> "https://play.max.com/search?q=$query"
        531 -> "https://www.paramountplus.com/search/?q=$query"
        2, 350 -> "https://tv.apple.com/search?term=$query"
        else -> fallback ?: "https://www.google.com/search?q=${Uri.encode("watch $title")}"
    }
}
