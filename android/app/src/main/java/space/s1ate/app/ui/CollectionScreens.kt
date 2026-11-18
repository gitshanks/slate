package space.s1ate.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
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
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
    refreshKey: Int,
    onOpenTitle: (String) -> Unit,
    bottomInset: PaddingValues = PaddingValues(),
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
    LaunchedEffect(refreshKey) { load() }

    if (selectedId != null) {
        BackHandler { selectedId = null }
        ListDetailScreen(model, selectedId!!, onBack = { selectedId = null }, onOpenTitle = onOpenTitle, bottomInset = bottomInset)
        return
    }

    Column(modifier.fillMaxSize().background(SlateBackground)) {
        SlateScreenTitle(
            "Lists",
            modifier = Modifier.padding(horizontal = SlateGutter).padding(top = 4.dp, bottom = 20.dp),
            trailing = {
                Row(
                    Modifier
                        .height(40.dp)
                        .pressable { createDialog = true }
                        .clip(CircleShape)
                        .background(SlateFill)
                        .border(1.dp, SlateBorder, CircleShape)
                        .padding(start = 12.dp, end = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Add, null, Modifier.size(16.dp), tint = Color.White)
                    Text("New list", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.White)
                }
            },
        )
        when {
            loading -> Box(Modifier.fillMaxSize())
            summaries.isEmpty() -> Box(Modifier.fillMaxSize().padding(bottom = bottomInset.calculateBottomPadding()), Alignment.Center) {
                Column(Modifier.widthIn(max = 320.dp).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    EmptyMessage("No lists yet", "Group titles for a mood, a trip or a film night.")
                    Spacer(Modifier.height(20.dp))
                    SlatePrimaryButton("Make a list", Modifier.fillMaxWidth()) { createDialog = true }
                }
            }
            else -> LazyColumn(
                Modifier.fillMaxSize().arriveOn(summaries.size),
                contentPadding = PaddingValues(start = SlateGutter, end = SlateGutter, bottom = bottomInset.calculateBottomPadding()),
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
                Text("Empty so far", Modifier.align(Alignment.Center), color = SlateMutedText, fontSize = 13.sp)
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
            Text(if (list.count == 1) "1 title" else "${list.count} titles", fontSize = 13.sp, color = SlateMutedText)
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
    bottomInset: PaddingValues = PaddingValues(),
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
            title = { Text(detail?.list?.name.orEmpty(), fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            windowInsets = WindowInsets(0),
            colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground),
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
            Box(Modifier.fillMaxSize())
        } else if (titles.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(bottom = bottomInset.calculateBottomPadding()), Alignment.Center) {
                Column(Modifier.widthIn(max = 320.dp).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    EmptyMessage("Nothing in this list yet", "Add titles from your library.")
                    Spacer(Modifier.height(20.dp))
                    SlatePrimaryButton("Add a title", Modifier.fillMaxWidth()) { add = true }
                }
            }
        } else {
            ReorderableLibraryGrid(
                source = titles,
                modifier = Modifier.arriveOn(listId),
                contentPadding = PaddingValues(start = SlateGutter, end = SlateGutter, top = 8.dp, bottom = bottomInset.calculateBottomPadding() + 16.dp),
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

/**
 * Profile: who you are as the headline, what is on each shelf, then the
 * settings in one group (the web's `components/profile-screen.tsx`).
 */
@Composable
fun ProfileScreenAdvanced(
    state: SlateUiState,
    model: SlateViewModel,
    onClose: () -> Unit,
    onSignOut: () -> Unit,
    bottomInset: PaddingValues = PaddingValues(),
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

    LazyColumn(
        Modifier.fillMaxSize().background(SlateBackground),
        contentPadding = PaddingValues(
            start = SlateGutter,
            end = SlateGutter,
            top = 8.dp,
            bottom = bottomInset.calculateBottomPadding() + 24.dp,
        ),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(
                    Modifier.size(72.dp).pressable { photoPicker.launch("image/*") }.clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    val savedBitmap = remember(state.avatarBytes) {
                        state.avatarBytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                    }
                    (preview ?: savedBitmap)?.let {
                        androidx.compose.foundation.Image(it.asImageBitmap(), "Change your photo", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    } ?: AsyncImage(profile?.avatarUrl, "Change your photo", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BasicTextField(
                        value = name,
                        onValueChange = { name = it },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp),
                        cursorBrush = SolidColor(SlateAccent),
                        singleLine = true,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("@", color = SlateMutedText, fontSize = 15.sp)
                        BasicTextField(
                            value = username,
                            onValueChange = { value -> username = value.lowercase().filter { char -> char.isLetterOrDigit() || char == '-' } },
                            modifier = Modifier.weight(1f),
                            textStyle = androidx.compose.ui.text.TextStyle(color = SlateMutedText, fontSize = 15.sp),
                            cursorBrush = SolidColor(SlateAccent),
                            singleLine = true,
                        )
                    }
                }
            }

            // What is on each shelf, in the Library's own words.
            Row(
                Modifier.fillMaxWidth().padding(top = 24.dp).clip(RoundedCornerShape(16.dp)).background(SlateSurface)
                    .border(1.dp, SlateBorder, RoundedCornerShape(16.dp)).padding(vertical = 16.dp),
            ) {
                listOf(
                    "Up Next" to space.s1ate.app.model.LibraryStatus.want,
                    "Watching" to space.s1ate.app.model.LibraryStatus.watching,
                    "Watched" to space.s1ate.app.model.LibraryStatus.watched,
                ).forEach { (label, status) ->
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${state.titles.count { it.status == status }}", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        Text(label, color = SlateMutedText, fontSize = 12.sp)
                    }
                }
            }

            Column(
                Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SlateSurface)
                    .border(1.dp, SlateBorder, RoundedCornerShape(16.dp)),
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (isPublic) Icons.Outlined.Public else Icons.Outlined.Lock, null, tint = SlateMutedText, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Share your slate", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                        Text(
                            if (isPublic) "Anyone with your link can browse it." else "Only you can see it.",
                            fontSize = 13.sp,
                            color = SlateMutedText,
                        )
                    }
                    Switch(
                        isPublic,
                        { isPublic = it },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = SlateAccent,
                            checkedThumbColor = SlateOnAccent,
                            uncheckedTrackColor = Color.White.copy(alpha = 0.08f),
                            uncheckedThumbColor = SlateMutedText,
                            uncheckedBorderColor = Color.Transparent,
                        ),
                    )
                }
                if (isPublic) {
                    HorizontalDivider(color = SlateBorder)
                    Row(
                        Modifier.fillMaxWidth().pressable {
                            val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                                type = "text/plain"; putExtra(android.content.Intent.EXTRA_TEXT, "https://www.s1ate.space/u/$username")
                            }
                            context.startActivity(android.content.Intent.createChooser(send, "Share your slate"))
                        }.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Share, null, tint = SlateMutedText, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(14.dp))
                        Text("s1ate.space/u/$username", color = Color.White, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                HorizontalDivider(color = SlateBorder)
                Row(
                    Modifier.fillMaxWidth().pressable(onClick = onSignOut).padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, null, tint = Color(0xFFFF6B7A), modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(14.dp))
                    Text("Sign out", color = Color(0xFFFF6B7A), fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
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

/**
 * Add from a link: paste, look, pick. One field, the source it read, and the
 * titles it found as posters that show their own state (a tick once saved).
 */
@Composable
fun ImportScreen(
    model: SlateViewModel,
    initialText: String?,
    onClose: () -> Unit,
    onOpenTitle: (space.s1ate.app.model.MediaType, Int) -> Unit,
) {
    var text by remember(initialText) { mutableStateOf(initialText.orEmpty()) }
    var resolution by remember { mutableStateOf<SharedLinkResolution?>(null) }
    var resolving by remember { mutableStateOf(false) }
    var added by remember { mutableStateOf(setOf<String>()) }
    var adding by remember { mutableStateOf(setOf<String>()) }
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current

    suspend fun resolve() {
        if (text.isBlank() || resolving) return
        keyboard?.hide()
        resolving = true
        runCatching { model.resolveSharedText(text) }.onSuccess { resolution = it }
            .onFailure { model.showMessage(it.message ?: "That link could not be read.") }
        resolving = false
    }
    suspend fun add(candidate: SharedLinkCandidate) {
        if (candidate.inLibrary || candidate.id in added || candidate.id in adding) return
        adding = adding + candidate.id
        runCatching { model.addCatalogTitle(candidate.tmdbId, candidate.mediaType) }
            .onSuccess { added = added + candidate.id }
            .onFailure { model.showMessage(it.message ?: "Title could not be added.") }
        adding = adding - candidate.id
    }
    LaunchedEffect(initialText) { if (!initialText.isNullOrBlank()) resolve() }

    val candidates = resolution?.candidates.orEmpty()
    val pending = candidates.filterNot { it.inLibrary || it.id in added }

    Column(Modifier.fillMaxSize().background(SlateBackground).imePadding()) {
        LazyVerticalGrid(
            columns = SlatePosterCells,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = SlateGutter, end = SlateGutter, bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(SlatePosterGap),
            verticalArrangement = Arrangement.spacedBy(SlatePosterGap),
        ) {
            fullWidthItem("header") {
                Column(Modifier.padding(bottom = 10.dp)) {
                    SlateScreenTitle(
                        "Add from a link",
                        trailing = {
                            Box(Modifier.offset(x = 12.dp).size(48.dp).pressable(onClick = onClose), contentAlignment = Alignment.Center) {
                                Icon(Icons.Outlined.Close, contentDescription = "Close", tint = Color.White)
                            }
                        },
                    )
                    Text(
                        "Paste a post, video, article or list. Slate finds the films and series mentioned in it.",
                        color = SlateMutedText,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    Row(
                        Modifier.fillMaxWidth().padding(top = 16.dp).height(52.dp).clip(CircleShape).background(SlateFill)
                            .border(1.dp, SlateBorder, CircleShape).padding(start = 18.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                            if (text.isEmpty()) Text("Paste a link", color = SlateMutedText, fontSize = 15.sp)
                            BasicTextField(
                                value = text,
                                onValueChange = { text = it },
                                modifier = Modifier.fillMaxWidth(),
                                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp),
                                cursorBrush = SolidColor(SlateAccent),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Search),
                                keyboardActions = KeyboardActions(onSearch = { scope.launch { resolve() } }),
                            )
                        }
                        Box(
                            Modifier.padding(start = 8.dp).height(44.dp).widthIn(min = 72.dp)
                                .pressable(enabled = text.isNotBlank() && !resolving) { scope.launch { resolve() } }
                                .clip(CircleShape)
                                .background(SlateAccent.copy(alpha = if (text.isNotBlank()) 1f else 0.35f))
                                .padding(horizontal = 16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (resolving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = SlateOnAccent)
                            else Text("Find", color = SlateOnAccent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    resolution?.let { result ->
                        val source = result.source.title ?: result.source.hostname
                        Text(
                            when {
                                result.candidates.isEmpty() -> "Nothing found in that link."
                                source != null -> "${result.candidates.size} found in $source"
                                else -> "${result.candidates.size} found"
                            },
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 24.dp),
                        )
                        result.warning?.let {
                            Text(it, color = SlateMutedText, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
            gridItems(candidates, key = { it.id }) { candidate ->
                val isSaved = candidate.inLibrary || candidate.id in added
                PosterFrame(
                    candidate.posterUrl,
                    candidate.title,
                    Modifier.pressable {
                        if (isSaved) onOpenTitle(candidate.mediaType, candidate.tmdbId) else scope.launch { add(candidate) }
                    }.semantics {
                        contentDescription = if (isSaved) "${candidate.title}, on your slate" else "Add ${candidate.title}"
                    },
                ) {
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(6.dp).size(24.dp).clip(CircleShape)
                            .background(if (isSaved) SlateAccent else Color.Black.copy(alpha = 0.62f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (isSaved) Icons.Outlined.Check else Icons.Outlined.Add,
                            contentDescription = null,
                            tint = if (isSaved) SlateOnAccent else Color.White,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
        }
        if (candidates.isNotEmpty()) {
            SlatePrimaryButton(
                label = when {
                    pending.isEmpty() -> "All on your slate. Done"
                    pending.size == 1 -> "Add 1 title"
                    else -> "Add all ${pending.size} titles"
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = SlateGutter)
                    .padding(top = 8.dp)
                    .padding(bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 16.dp),
            ) {
                if (pending.isEmpty()) onClose() else scope.launch { pending.forEach { add(it) } }
            }
        }
    }
}
