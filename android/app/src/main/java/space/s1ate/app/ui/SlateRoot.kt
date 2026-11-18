package space.s1ate.app.ui

import android.content.Context
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.StartOffsetType
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.NoCredentialException
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import space.s1ate.app.AppGraph
import space.s1ate.app.AuthState
import space.s1ate.app.BuildConfig
import space.s1ate.app.SlateUiState
import space.s1ate.app.SlateViewModel
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.SlateTitle

@Composable
fun SlateRoot(graph: AppGraph, sharedText: String?, listSlug: String? = null) {
    SlateTheme {
        val model: SlateViewModel = viewModel(factory = remember { SlateViewModel.Factory(graph) })
        val state by model.state.collectAsState()
        LaunchedEffect(sharedText) { model.receiveSharedText(sharedText) }
        LaunchedEffect(listSlug) { model.receiveListSlug(listSlug) }

        AnimatedContent(
            targetState = state.authState,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "auth-state",
        ) { authState ->
            when (authState) {
                AuthState.Launching -> LoadingScreen()
                AuthState.SignedOut, AuthState.SigningIn -> SignInScreen(
                    busy = authState == AuthState.SigningIn,
                    message = state.message,
                    posterColumns = state.posterColumns,
                    onIdToken = { model.signInWithGoogle(it, Build.MODEL) },
                    onError = model::showMessage,
                )
                AuthState.SignedIn -> SignedInApp(
                    state = state,
                    model = model,
                    onSignOut = model::signOut,
                )
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.dp)
    }
}

@Composable
private fun SignInScreen(
    busy: Boolean,
    message: String?,
    posterColumns: List<List<String>>,
    onIdToken: (String) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentials = remember { CredentialManager.create(context) }
    var authMode by rememberSaveable { mutableStateOf<LandingAuthMode?>(null) }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Box(
            Modifier
                .fillMaxSize()
                .then(if (authMode != null) Modifier.blur(7.dp) else Modifier),
        ) {
            LandingPosterWall(posterColumns)
            LandingScrim()
            SlateLandingWordmark(
                Modifier
                    .align(Alignment.TopCenter)
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(top = 10.dp),
            )
            LandingHero(
                onCreate = { authMode = LandingAuthMode.Create },
                onSignIn = { authMode = LandingAuthMode.SignIn },
                modifier = Modifier.align(Alignment.Center),
            )
            LandingFooter(
                Modifier
                    .align(Alignment.BottomCenter)
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(start = 18.dp, end = 18.dp, bottom = 8.dp),
            )
        }

        AnimatedVisibility(
            visible = authMode != null,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            val creating = authMode == LandingAuthMode.Create
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.22f))
                    .clickable(
                        interactionSource = null,
                        indication = null,
                        onClick = { authMode = null },
                    ),
            ) {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .padding(horizontal = 28.dp)
                        .clickable(
                            interactionSource = null,
                            indication = null,
                            onClick = {},
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        if (creating) "Create your slate" else "Sign in to slate",
                        color = Color.White,
                        fontSize = 38.sp,
                        lineHeight = 39.sp,
                        letterSpacing = (-1.8).sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Button(
                        onClick = {
                            if (BuildConfig.GOOGLE_SERVER_CLIENT_ID.isBlank()) {
                                onError("Add SLATE_GOOGLE_SERVER_CLIENT_ID to your Gradle properties.")
                                return@Button
                            }
                            scope.launch {
                                runCatching { googleIdToken(context, credentials) }
                                    .onSuccess(onIdToken)
                                    .onFailure {
                                        onError(it.message ?: "Google sign-in did not finish.")
                                    }
                            }
                        },
                        enabled = !busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 34.dp)
                            .height(54.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White,
                            contentColor = Color(0xFF151518),
                        ),
                    ) {
                        if (busy) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color(0xFF151518),
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text(
                                if (creating) "Sign up with Google" else "Sign in with Google",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                    AnimatedVisibility(visible = message != null) {
                        Text(
                            message.orEmpty(),
                            modifier = Modifier.padding(top = 15.dp),
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                        )
                    }
                    Row(
                        modifier = Modifier.padding(top = 22.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            if (creating) "Already have a slate? " else "New to slate? ",
                            color = Color.White.copy(alpha = 0.62f),
                            fontSize = 13.sp,
                        )
                        TextButton(
                            onClick = {
                                authMode = if (creating) LandingAuthMode.SignIn else LandingAuthMode.Create
                            },
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text(
                                if (creating) "Sign in" else "Create one",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
    }
}

private enum class LandingAuthMode { Create, SignIn }

@Composable
private fun LandingHero(
    onCreate: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Never lose a good\nrecommendation again.",
            color = Color.White,
            fontSize = 34.sp,
            lineHeight = 33.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-1.7).sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
        Row(
            modifier = Modifier.padding(top = 30.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            LandingPill("Create your slate", true, onCreate)
            LandingPill("Sign in", false, onSignIn)
        }
    }
}

@Composable
private fun LandingPill(title: String, prominent: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.height(50.dp),
        shape = CircleShape,
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (prominent) 0.68f else 0.2f)),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (prominent) Color.White.copy(alpha = 0.9f) else Color(0x8A18181A),
            contentColor = if (prominent) Color(0xFF151518) else Color.White.copy(alpha = 0.9f),
        ),
        contentPadding = PaddingValues(horizontal = 22.dp),
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SlateLandingWordmark(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Box(Modifier.width(15.dp).height(4.dp).clip(CircleShape).background(Color.White))
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.width(6.dp).height(4.dp).clip(CircleShape).background(Color.White))
                Box(Modifier.width(6.dp).height(4.dp).clip(CircleShape).background(Color.White))
            }
        }
        Spacer(Modifier.width(7.dp))
        Text(
            "slate",
            color = Color.White,
            fontSize = 27.sp,
            letterSpacing = (-1.2).sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun LandingFooter(modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "FREE · PRIVATE BY DEFAULT",
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 10.sp,
            letterSpacing = 0.35.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
        )
        Spacer(Modifier.weight(1f))
        Text(
            "GITHUB ↗",
            color = Color.White.copy(alpha = 0.66f),
            fontSize = 10.sp,
            letterSpacing = 0.35.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun LandingPosterWall(columns: List<List<String>>) {
    val durations = listOf(360_000, 432_000, 396_000, 456_000, 420_000, 372_000, 444_000, 408_000)
    val phases = listOf(17_000, 31_000, 43_000, 12_000, 38_000, 24_000, 51_000, 8_000)
    val motion = rememberInfiniteTransition(label = "landing-poster-wall")

    BoxWithConstraints(
        Modifier.fillMaxSize().background(Color(0xFF050505)).clipToBounds(),
        contentAlignment = Alignment.Center,
    ) {
        val posterWidth = maxWidth * 0.29f
        val posterHeight = posterWidth * 1.5f
        val gap = 8.dp
        val wallWidth = posterWidth * columns.size + gap * (columns.size - 1)

        Row(
            modifier = Modifier
                .width(wallWidth)
                .height(maxHeight * 1.26f)
                .graphicsLayer {
                    rotationZ = -5f
                    scaleX = 1.08f
                    scaleY = 1.08f
                },
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            columns.forEachIndexed { index, urls ->
                val progress by motion.animateFloat(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(
                            durationMillis = durations[index % durations.size],
                            easing = LinearEasing,
                        ),
                        repeatMode = RepeatMode.Reverse,
                        initialStartOffset = StartOffset(
                            phases[index % phases.size],
                            StartOffsetType.FastForward,
                        ),
                    ),
                    label = "landing-column-$index",
                )
                val sequenceHeight = (posterHeight + gap) * urls.size
                val direction = if (index % 2 == 0) progress else 1f - progress

                Column(
                    modifier = Modifier
                        .width(posterWidth)
                        .offset(y = -sequenceHeight * direction),
                ) {
                    repeat(2) {
                        urls.forEach { url ->
                            AsyncImage(
                                model = url,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(posterWidth)
                                    .height(posterHeight)
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(Color(0xFF171717)),
                            )
                            Spacer(Modifier.height(gap))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LandingScrim() {
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .align(Alignment.Center)
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.54f)
                .graphicsLayer { scaleX = 1.18f; scaleY = 1.56f }
                .background(
                    Brush.radialGradient(
                        listOf(
                            Color.Black.copy(alpha = 0.98f),
                            Color.Black.copy(alpha = 0.9f),
                            Color.Black.copy(alpha = 0.52f),
                            Color.Transparent,
                        ),
                    ),
                ),
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.64f),
                        Color.Transparent,
                        Color.Transparent,
                        Color.Black.copy(alpha = 0.72f),
                    ),
                ),
            ),
        )
    }
}

private suspend fun googleIdToken(context: Context, manager: CredentialManager): String {
    val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_SERVER_CLIENT_ID).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    val credential = try {
        manager.getCredential(context, request).credential
    } catch (_: NoCredentialException) {
        throw IllegalStateException("No Google account is available on this device.")
    }
    require(
        credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL,
    ) { "Google returned an unsupported credential." }
    return GoogleIdTokenCredential.createFrom(credential.data).idToken
}

internal enum class Destination(val label: String, val icon: ImageVector) {
    Library("Library", Icons.Outlined.GridView),
    Discover("Discover", Icons.Outlined.Explore),
    Lists("Lists", Icons.Outlined.Layers),
}

@Composable
private fun SignedInApp(
    state: SlateUiState,
    model: SlateViewModel,
    onSignOut: () -> Unit,
) {
    var destination by rememberSaveable { mutableStateOf(Destination.Library) }
    var shelf by rememberSaveable { mutableStateOf(Shelf.UpNext) }
    var filterFormat by rememberSaveable { mutableStateOf("") }
    var filterGenre by rememberSaveable { mutableStateOf("") }
    var filterYear by rememberSaveable { mutableStateOf("") }
    var filterReaction by rememberSaveable { mutableStateOf("") }
    var filterSort by rememberSaveable { mutableStateOf("") }
    val filters = LibraryFilters(filterFormat, filterGenre, filterYear, filterReaction, filterSort)

    var selectedTitleId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedCatalogType by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedCatalogId by rememberSaveable { mutableStateOf<Int?>(null) }
    var selectedPersonId by rememberSaveable { mutableStateOf<Int?>(null) }
    var showSearch by rememberSaveable { mutableStateOf(false) }
    var showProfile by rememberSaveable { mutableStateOf(false) }
    var showImport by rememberSaveable { mutableStateOf(false) }
    var listsRefresh by rememberSaveable { mutableStateOf(0) }
    val selectedTitle = state.titles.firstOrNull { it.id == selectedTitleId }
    val listSlug = state.pendingListSlug
    val detailOpen = selectedTitle != null || selectedCatalogId != null || selectedPersonId != null
    val overlayOpen = detailOpen || showProfile || showImport || listSlug != null
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it) }
        model.clearMessage()
    }
    // A link shared into the app goes straight to "Add from a link".
    LaunchedEffect(state.sharedText) {
        if (state.sharedText != null) {
            showSearch = false
            showProfile = false
            showImport = true
        }
    }

    fun closeDetail() {
        selectedTitleId = null
        selectedCatalogId = null
        selectedCatalogType = null
        selectedPersonId = null
    }

    fun goTo(next: Destination) {
        closeDetail()
        showProfile = false
        showSearch = false
        showImport = false
        model.clearListSlug()
        destination = next
    }

    BackHandler(enabled = showSearch || overlayOpen || destination != Destination.Library) {
        when {
            showSearch -> showSearch = false
            selectedPersonId != null -> selectedPersonId = null
            selectedCatalogId != null -> {
                selectedCatalogId = null
                selectedCatalogType = null
            }
            selectedTitleId != null -> selectedTitleId = null
            showImport -> { showImport = false; model.clearSharedText() }
            listSlug != null -> model.clearListSlug()
            showProfile -> showProfile = false
            else -> destination = Destination.Library
        }
    }

    val dockInset = PaddingValues(
        bottom = SlateDockHeight + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(),
    )
    // What fills the screen under the dock, as one key, so a change of screen fades up.
    val screenKey = when {
        selectedPersonId != null -> "person-$selectedPersonId"
        selectedCatalogId != null -> "catalog-$selectedCatalogType-$selectedCatalogId"
        selectedTitle != null -> "title-${selectedTitle.id}"
        showImport -> "import"
        listSlug != null -> "list-$listSlug"
        showProfile -> "profile"
        else -> destination.name
    }

    Box(Modifier.fillMaxSize().background(SlateBackground)) {
        Column(Modifier.fillMaxSize()) {
            // Full-bleed screens (a title, a list from a link) bring their own top edge.
            if (!detailOpen && listSlug == null) {
                SlateTopBar(
                    profile = state.profile,
                    avatarBytes = state.avatarBytes,
                    onLogo = { goTo(Destination.Library) },
                    onProfile = { showProfile = true; showSearch = false; showImport = false },
                )
            }
            Box(Modifier.fillMaxSize().arriveOn(screenKey)) {
                when {
                    selectedPersonId != null -> PersonScreen(
                        model = model,
                        personId = selectedPersonId!!,
                        onBack = { selectedPersonId = null },
                        onOpenTitle = { type, id ->
                            selectedPersonId = null
                            selectedCatalogType = type.name
                            selectedCatalogId = id
                        },
                    )
                    selectedCatalogId != null && selectedCatalogType != null -> DiscoverScreen(
                        model = model,
                        mediaType = space.s1ate.app.model.MediaType.valueOf(selectedCatalogType!!),
                        tmdbId = selectedCatalogId!!,
                        onBack = { selectedCatalogId = null; selectedCatalogType = null },
                        onOpenSaved = { id -> selectedCatalogId = null; selectedCatalogType = null; selectedTitleId = id },
                        onOpenTitle = { type, id -> selectedCatalogType = type.name; selectedCatalogId = id },
                        onOpenPerson = { id -> selectedCatalogId = null; selectedCatalogType = null; selectedPersonId = id },
                    )
                    selectedTitle != null -> TitleDetailScreen(
                        title = selectedTitle,
                        model = model,
                        onBack = { selectedTitleId = null },
                        onRemoved = { selectedTitleId = null },
                        onOpenTitle = { type, id ->
                            selectedTitleId = null
                            selectedCatalogType = type.name
                            selectedCatalogId = id
                        },
                        onOpenPerson = { id -> selectedTitleId = null; selectedPersonId = id },
                    )
                    showImport -> ImportScreen(
                        model = model,
                        initialText = state.sharedText,
                        onClose = { showImport = false; model.clearSharedText() },
                        onOpenTitle = { type, id -> selectedCatalogType = type.name; selectedCatalogId = id },
                    )
                    listSlug != null -> CuratedListScreen(
                        model = model,
                        slug = listSlug,
                        onBack = model::clearListSlug,
                        onOpenTitle = { type, id -> selectedCatalogType = type.name; selectedCatalogId = id },
                        onOpenLists = { listsRefresh += 1; goTo(Destination.Lists) },
                    )
                    showProfile -> ProfileScreenAdvanced(state, model, onClose = { showProfile = false }, onSignOut = onSignOut, bottomInset = dockInset)
                    else -> when (destination) {
                        Destination.Library -> LibraryScreen(
                            titles = state.titles,
                            newEpisodes = state.newEpisodes,
                            hasLists = state.lists.isNotEmpty(),
                            shelf = shelf,
                            onShelf = { shelf = it },
                            filters = filters,
                            onFilters = {
                                filterFormat = it.format
                                filterGenre = it.genre
                                filterYear = it.year
                                filterReaction = it.reaction
                                filterSort = it.sort
                            },
                            onOpenTitle = { selectedTitleId = it.id },
                            onReorder = { status, ordered -> model.reorderStatus(status, ordered) },
                            onAdd = { showSearch = true },
                            onAddFromLink = { showImport = true },
                            onMakeList = { name, ids ->
                                model.createListFromTitles(name, ids)
                                listsRefresh += 1
                                goTo(Destination.Lists)
                            },
                            bottomInset = dockInset,
                        )
                        Destination.Discover -> DiscoverHomeScreen(
                            rails = state.discoverRails,
                            onLoad = { model.loadDiscover(force = state.discoverRails?.isEmpty() == true) },
                            onOpenTitle = { type, id -> selectedCatalogType = type.name; selectedCatalogId = id },
                            bottomInset = dockInset,
                        )
                        Destination.Lists -> ListsScreenAdvanced(
                            model = model,
                            refreshKey = listsRefresh,
                            onOpenTitle = { selectedTitleId = it },
                            bottomInset = dockInset,
                        )
                    }
                }
            }
        }

        // The dock stays put on the three main screens and on Profile, and
        // gets out of the way of anything that fills the screen.
        AnimatedVisibility(
            visible = !detailOpen && !showImport && listSlug == null,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(120)),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            SlateDock(
                items = Destination.entries.map { it.label to it.icon },
                selectedIndex = destination.ordinal,
                onSelect = { goTo(Destination.entries[it]) },
                onAdd = { showSearch = true },
            )
        }

        SnackbarHost(
            snackbar,
            Modifier.align(Alignment.BottomCenter).padding(dockInset).padding(bottom = 8.dp),
        )

        AnimatedVisibility(
            visible = showSearch,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(150)),
        ) {
            SearchScreen(
                model = model,
                onBack = { showSearch = false },
                onOpenTitle = { type, id ->
                    showSearch = false
                    selectedCatalogType = type.name
                    selectedCatalogId = id
                },
                onOpenSaved = { id -> showSearch = false; selectedTitleId = id },
                onOpenPerson = { id -> showSearch = false; selectedPersonId = id },
                onAddFromLink = { showSearch = false; showImport = true },
            )
        }
    }
}
