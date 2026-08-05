package space.s1ate.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Share
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import space.s1ate.app.SlateUiState
import space.s1ate.app.SlateViewModel
import space.s1ate.app.model.SharedLinkCandidate
import space.s1ate.app.model.SharedLinkResolution
import space.s1ate.app.model.SlateListDetailPayload
import space.s1ate.app.model.SlateListSummary
import space.s1ate.app.model.SlateProfile
import space.s1ate.app.model.SlateTitle
import java.io.ByteArrayOutputStream

@Composable
fun ProfileAvatarButton(profile: SlateProfile?, data: ByteArray? = null, onClick: () -> Unit) {
    IconButton(onClick) {
        val bitmap = remember(data) { data?.let { BitmapFactory.decodeByteArray(it, 0, it.size) } }
        if (bitmap != null) {
            androidx.compose.foundation.Image(
                bitmap.asImageBitmap(),
                profile?.displayName ?: "Profile",
                Modifier.size(31.dp).clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            AsyncImage(
                profile?.avatarUrl,
                profile?.displayName ?: "Profile",
                Modifier.size(31.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListsScreenAdvanced(
    model: SlateViewModel,
    profile: SlateProfile?,
    avatarBytes: ByteArray?,
    onOpenTitle: (String) -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var summaries by remember { mutableStateOf<List<SlateListSummary>>(emptyList()) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var createDialog by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<SlateListSummary?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    suspend fun load() {
        runCatching { model.listSummaries() }.onSuccess { summaries = it }
            .onFailure { model.showMessage(it.message ?: "Lists could not be loaded.") }
        loading = false
    }
    LaunchedEffect(Unit) { load() }

    if (selectedId != null) {
        BackHandler { selectedId = null }
        ListDetailScreen(model, selectedId!!, onBack = { selectedId = null }, onOpenTitle = onOpenTitle)
        return
    }

    Column(modifier.fillMaxSize().background(SlateBackground)) {
        SlateSectionHeader(
            eyebrow = "Collections",
            title = "Lists",
            modifier = Modifier.padding(horizontal = 18.dp).padding(top = 20.dp, bottom = 26.dp),
            trailing = {
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.055f))
                        .clickable { createDialog = true }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Add, null, Modifier.size(17.dp), tint = Color.White.copy(alpha = 0.82f))
                    Text("New list", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.82f))
                }
            },
        )
        when {
            loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(strokeWidth = 2.dp) }
            summaries.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No lists yet", fontWeight = FontWeight.SemiBold)
                    Text("Group titles for a mood, trip, or movie night.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                items(summaries, key = { it.id }) { list ->
                    ListSummaryCard(
                        list = list,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { selectedId = list.id },
                        onShare = {
                            val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(android.content.Intent.EXTRA_TEXT, "https://www.s1ate.space/lists/${list.slug}")
                            }
                            context.startActivity(android.content.Intent.createChooser(send, list.name))
                        },
                        onDelete = { deleting = list },
                    )
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }

    if (createDialog) {
        ListEditorDialog("New list", "", "", { createDialog = false }) { name, description ->
            runCatching { model.createList(name, description) }
                .onSuccess { summaries = listOf(it) + summaries; createDialog = false }
                .onFailure { model.showMessage(it.message ?: "List could not be created.") }
        }
    }
    deleting?.let { list ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete ${list.name}?") },
            text = { Text("This removes the list, not the titles in your library.") },
            confirmButton = {
                TextButton({
                    deleting = null
                    scope.launch {
                        runCatching { model.deleteList(list.id) }
                            .onSuccess { summaries = summaries.filterNot { it.id == list.id } }
                            .onFailure { model.showMessage(it.message ?: "List could not be deleted.") }
                    }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton({ deleting = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ListSummaryCard(
    list: SlateListSummary,
    modifier: Modifier,
    onClick: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(
        modifier.clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(15.dp)).background(Color.White.copy(0.04f))) {
            if (list.posters.isEmpty()) {
                Icon(Icons.Outlined.Download, null, Modifier.align(Alignment.Center), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Row(Modifier.align(Alignment.Center), horizontalArrangement = Arrangement.spacedBy((-29).dp)) {
                    list.posters.take(4).forEach { url ->
                        AsyncImage(url, null, Modifier.width(91.dp).height(137.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                    }
                }
            }
            Row(
                Modifier.align(Alignment.TopEnd).padding(11.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Icon(
                    Icons.Outlined.Share,
                    contentDescription = "Share ${list.name}",
                    tint = Color.White.copy(alpha = 0.78f),
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.72f)).clickable(onClick = onShare).padding(8.dp),
                )
                Icon(
                    Icons.Outlined.Delete,
                    contentDescription = "Delete ${list.name}",
                    tint = Color.White.copy(alpha = 0.78f),
                    modifier = Modifier.size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.72f)).clickable(onClick = onDelete).padding(8.dp),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(list.name, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text("${list.count}", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        list.description?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ListDetailScreen(
    model: SlateViewModel,
    listId: String,
    onBack: () -> Unit,
    onOpenTitle: (String) -> Unit,
) {
    var detail by remember(listId) { mutableStateOf<SlateListDetailPayload?>(null) }
    var menu by remember { mutableStateOf(false) }
    var edit by remember { mutableStateOf(false) }
    var add by remember { mutableStateOf(false) }
    var delete by remember { mutableStateOf(false) }

    suspend fun load() {
        runCatching { model.listDetail(listId) }.onSuccess { detail = it }
            .onFailure { model.showMessage(it.message ?: "List could not be loaded.") }
    }
    LaunchedEffect(listId) { load() }

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TopAppBar(
            title = { Text(detail?.list?.name ?: "List", fontWeight = FontWeight.Bold, maxLines = 1) },
            navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") } },
            actions = {
                IconButton({ add = true }) { Icon(Icons.Outlined.Add, "Add title") }
                Box {
                    IconButton({ menu = true }) { Icon(Icons.Outlined.MoreHoriz, "More") }
                    DropdownMenu(menu, { menu = false }) {
                        DropdownMenuItem({ Text("Edit list") }, { menu = false; edit = true }, leadingIcon = { Icon(Icons.Outlined.Edit, null) })
                        DropdownMenuItem({ Text("Delete list") }, { menu = false; delete = true }, leadingIcon = { Icon(Icons.Outlined.Delete, null) })
                    }
                }
            },
        )
        detail?.list?.description?.takeIf(String::isNotBlank)?.let {
            Text(it, Modifier.padding(horizontal = 18.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val titles = detail?.titles
        if (titles == null) {
            Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(strokeWidth = 2.dp) }
        } else if (titles.isEmpty()) {
            Box(Modifier.fillMaxSize(), Alignment.Center) { Text("Empty list", fontWeight = FontWeight.SemiBold) }
        } else {
            ReorderableLibraryGrid(
                source = titles,
                onOpen = { onOpenTitle(it.id) },
                onCommit = { ordered ->
                    detail = detail?.copy(titles = ordered)
                    model.reorderList(listId, ordered)
                },
            )
        }
    }

    if (add) {
        CandidatePicker(detail?.candidates.orEmpty(), { add = false }) { title ->
            runCatching { model.addTitleToList(listId, title.id) }
                .onSuccess {
                    detail = detail?.copy(titles = detail!!.titles + title, candidates = detail!!.candidates.filterNot { it.id == title.id })
                    add = false
                }
                .onFailure { model.showMessage(it.message ?: "Title could not be added.") }
        }
    }
    if (edit) {
        ListEditorDialog("Edit list", detail?.list?.name.orEmpty(), detail?.list?.description.orEmpty(), { edit = false }) { name, description ->
            runCatching { model.updateList(listId, name, description) }.onSuccess { list ->
                detail = detail?.copy(list = list); edit = false
            }.onFailure { model.showMessage(it.message ?: "List could not be saved.") }
        }
    }
    if (delete) {
        AlertDialog(
            onDismissRequest = { delete = false },
            title = { Text("Delete this list?") },
            confirmButton = { TextButton({
                kotlinx.coroutines.MainScope().launch {
                    runCatching { model.deleteList(listId) }.onSuccess { onBack() }
                        .onFailure { model.showMessage(it.message ?: "List could not be deleted.") }
                }
            }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton({ delete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun CandidatePicker(candidates: List<SlateTitle>, onDismiss: () -> Unit, onAdd: suspend (SlateTitle) -> Unit) {
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add a title") },
        text = {
            Column {
                OutlinedTextField(query, { query = it }, placeholder = { Text("Filter your library") }, singleLine = true)
                LazyColumn(Modifier.height(360.dp).padding(top = 10.dp)) {
                    items(candidates.count { query.isBlank() || it.title.contains(query, true) }) { index ->
                        val title = candidates.filter { query.isBlank() || it.title.contains(query, true) }[index]
                        Row(Modifier.fillMaxWidth().clickable { scope.launch { onAdd(title) } }.padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                            AsyncImage(title.posterUrl, title.title, Modifier.width(40.dp).height(60.dp).clip(RoundedCornerShape(7.dp)), contentScale = ContentScale.Crop)
                            Spacer(Modifier.width(12.dp)); Text(title.title, Modifier.weight(1f)); Icon(Icons.Outlined.Add, null)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ListEditorDialog(title: String, initialName: String, initialDescription: String, onDismiss: () -> Unit, onSave: suspend (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(initialName) }
    var description by remember { mutableStateOf(initialDescription) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
            OutlinedTextField(description, { description = it }, label = { Text("Description (optional)") }, minLines = 3)
        } },
        confirmButton = { TextButton({ scope.launch { onSave(name.trim(), description.trim()) } }, enabled = name.isNotBlank()) { Text("Save") } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreenAdvanced(
    state: SlateUiState,
    model: SlateViewModel,
    onClose: () -> Unit,
    onSignOut: () -> Unit,
) {
    val profile = state.profile
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember(profile?.id) { mutableStateOf(profile?.displayName.orEmpty()) }
    var username by remember(profile?.id) { mutableStateOf(profile?.username.orEmpty()) }
    var isPublic by remember(profile?.id) { mutableStateOf(profile?.isPublic ?: false) }
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var hydrated by remember { mutableStateOf(false) }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            runCatching {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Photo could not be read.")
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: error("Photo could not be read.")
                preview = bitmap
                model.uploadAvatar(bitmap.slateAvatarBytes(), "image/jpeg")
            }.onFailure { model.showMessage(it.message ?: "Photo could not be saved.") }
        }
    }

    LaunchedEffect(profile?.id) { hydrated = profile != null }
    LaunchedEffect(name, username, isPublic, hydrated) {
        if (!hydrated || profile == null) return@LaunchedEffect
        val cleanName = name.trim().replace(Regex("\\s+"), " ")
        val cleanUsername = username.trim().lowercase()
        if (cleanName.length !in 2..60 || !Regex("^[a-z0-9][a-z0-9-]{2,29}$").matches(cleanUsername)) return@LaunchedEffect
        if (cleanName == profile.displayName && cleanUsername == profile.username && isPublic == profile.isPublic) return@LaunchedEffect
        delay(650)
        runCatching { model.updateProfile(cleanName, cleanUsername, isPublic) }
            .onFailure { model.showMessage(it.message ?: "Profile could not be saved.") }
    }

    Column(Modifier.fillMaxSize().background(SlateBackground)) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                SlateSectionHeader(
                    eyebrow = "Your slate",
                    title = "Profile",
                    modifier = Modifier.padding(top = 20.dp),
                )
                Text(
                    "Edit what friends see and choose whether your slate can be shared.",
                    color = SlateMuted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 26.dp),
                )

                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(SlateSurface).padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    Box(Modifier.size(82.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable { photoPicker.launch("image/*") }) {
                        val savedBitmap = remember(state.avatarBytes) {
                            state.avatarBytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                        }
                        (preview ?: savedBitmap)?.let {
                            androidx.compose.foundation.Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        } ?: AsyncImage(profile?.avatarUrl, profile?.displayName, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(
                            if (isPublic) "PUBLIC" else "PRIVATE",
                            color = SlateViolet,
                            fontSize = 10.sp,
                            letterSpacing = 1.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace,
                        )
                        BasicTextField(
                            value = name,
                            onValueChange = { name = it },
                            modifier = Modifier.fillMaxWidth(),
                            textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.7).sp),
                            cursorBrush = SolidColor(SlateViolet),
                            singleLine = true,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("@", color = SlateMuted, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                            BasicTextField(
                                value = username,
                                onValueChange = { value -> username = value.lowercase().filter { char -> char.isLetterOrDigit() || char == '-' } },
                                modifier = Modifier.weight(1f),
                                textStyle = androidx.compose.ui.text.TextStyle(color = SlateMuted, fontSize = 14.sp, fontFamily = FontFamily.Monospace),
                                cursorBrush = SolidColor(SlateViolet),
                                singleLine = true,
                            )
                        }
                    }
                }
                Column(
                    Modifier.padding(top = 18.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(SlateSurface),
                ) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (isPublic) Icons.Outlined.Public else Icons.Outlined.Lock, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Share your slate", fontWeight = FontWeight.SemiBold)
                            Text(if (isPublic) "Anyone with your link can browse it." else "Your slate is private by default.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(isPublic, { isPublic = it })
                    }
                    if (isPublic) {
                        HorizontalDivider(color = Color.White.copy(0.08f))
                        Row(Modifier.fillMaxWidth().clickable {
                            val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                                type = "text/plain"; putExtra(android.content.Intent.EXTRA_TEXT, "https://www.s1ate.space/u/$username")
                            }
                            context.startActivity(android.content.Intent.createChooser(send, "Share your slate"))
                        }.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Share, null)
                            Spacer(Modifier.width(14.dp))
                            Text("s1ate.space/u/$username", fontSize = 13.sp, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                TextButton(onSignOut, Modifier.padding(top = 34.dp).padding(bottom = 24.dp)) { Text("Sign out", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}

private fun Bitmap.slateAvatarBytes(): ByteArray {
    val maxSide = 900f
    val scale = minOf(1f, maxSide / maxOf(width, height).toFloat())
    val resized = if (scale < 1f) Bitmap.createScaledBitmap(this, (width * scale).toInt(), (height * scale).toInt(), true) else this
    var quality = 82
    var value: ByteArray
    do {
        val stream = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, quality, stream)
        value = stream.toByteArray()
        quality -= 8
    } while (value.size > 640 * 1024 && quality >= 34)
    return value
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportScreen(model: SlateViewModel, profile: SlateProfile?, avatarBytes: ByteArray?, initialText: String?, onProfile: () -> Unit, modifier: Modifier = Modifier) {
    var text by remember(initialText) { mutableStateOf(initialText.orEmpty()) }
    var resolution by remember { mutableStateOf<SharedLinkResolution?>(null) }
    var resolving by remember { mutableStateOf(false) }
    var added by remember { mutableStateOf(setOf<String>()) }
    val scope = rememberCoroutineScope()

    suspend fun resolve() {
        resolving = true
        runCatching { model.resolveSharedText(text) }.onSuccess { resolution = it }
            .onFailure { model.showMessage(it.message ?: "Shared link could not be read.") }
        resolving = false
    }
    suspend fun add(candidate: SharedLinkCandidate) {
        if (candidate.inLibrary || candidate.id in added) return
        runCatching { model.addCatalogTitle(candidate.tmdbId, candidate.mediaType) }
            .onSuccess { added = added + candidate.id }
            .onFailure { model.showMessage(it.message ?: "Title could not be added.") }
    }
    LaunchedEffect(initialText) { if (!initialText.isNullOrBlank()) resolve() }

    Column(modifier.fillMaxSize().background(SlateBackground)) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                SlateSectionHeader(
                    eyebrow = "Import",
                    title = "Bring it into slate",
                    modifier = Modifier.padding(top = 20.dp),
                )
                Text("Move recommendations from links or another service into your slate.", color = SlateMuted, fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 10.dp))
                Text("FROM ANYWHERE ON THE WEB", fontSize = 11.sp, letterSpacing = 1.5.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, color = SlateMuted, modifier = Modifier.padding(top = 34.dp))
                Text("Add from a link", fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.7).sp, modifier = Modifier.padding(top = 7.dp))
                Text("Paste an Instagram, TikTok, YouTube, IMDb, Letterboxd, or article link. Slate finds the films and shows mentioned inside it.", color = SlateMuted, fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 8.dp))
                Column(
                    Modifier.fillMaxWidth().padding(top = 20.dp).clip(RoundedCornerShape(18.dp)).background(SlateSurface).padding(14.dp),
                ) {
                    OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth().height(112.dp), placeholder = { Text("Paste a link or recommendation text") })
                    Button(
                        { scope.launch { resolve() } },
                        enabled = text.isNotBlank() && !resolving,
                        modifier = Modifier.fillMaxWidth().padding(top = 11.dp).height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary, contentColor = Color.Black),
                        shape = RoundedCornerShape(16.dp),
                    ) { if (resolving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.Black) else Text("Find titles", fontWeight = FontWeight.SemiBold) }
                }
                resolution?.warning?.let { Text(it, color = Color(0xFFFFB36B), fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp)) }
            }
            resolution?.let { result ->
                item {
                    Row(Modifier.padding(top = 30.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("FOUND ${result.candidates.size} TITLES", fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                        TextButton({ scope.launch { result.candidates.forEach { add(it) } } }) { Text("Add all") }
                    }
                }
                items(result.candidates.size, key = { result.candidates[it].id }) { index ->
                    val candidate = result.candidates[index]
                    ImportCandidate(candidate, candidate.inLibrary || candidate.id in added) { scope.launch { add(candidate) } }
                }
            }
            item { Spacer(Modifier.height(28.dp)) }
        }
    }
}

@Composable
private fun ImportCandidate(candidate: SharedLinkCandidate, added: Boolean, onAdd: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(16.dp)).background(Color.White.copy(0.04f)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(candidate.posterUrl, candidate.title, Modifier.width(62.dp).height(93.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(candidate.title, fontWeight = FontWeight.SemiBold, maxLines = 2)
            Text(candidate.year ?: candidate.mediaType.name, fontSize = 12.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(candidate.sourceTitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
        IconButton(onAdd, enabled = !added) {
            Icon(if (added) Icons.Outlined.Check else Icons.Outlined.Add, null, tint = if (added) Color.White else MaterialTheme.colorScheme.primary)
        }
    }
}
