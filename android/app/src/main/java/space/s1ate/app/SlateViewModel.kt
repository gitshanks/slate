package space.s1ate.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.LandingBackdrop
import space.s1ate.app.model.CatalogSearchPayload
import space.s1ate.app.model.DiscoverDetailPayload
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.PersonDetailPayload
import space.s1ate.app.model.PersistedSession
import space.s1ate.app.model.SlateList
import space.s1ate.app.model.SlateProfile
import space.s1ate.app.model.SlateTitle
import space.s1ate.app.model.SharedLinkResolution
import space.s1ate.app.model.SlateListDetailPayload
import space.s1ate.app.model.SlateListSummary
import space.s1ate.app.model.TitleDetailPayload
import space.s1ate.app.model.TitleListOption
import space.s1ate.app.model.TokenPayload
import space.s1ate.app.network.ApiException

enum class AuthState { Launching, SignedOut, SigningIn, SignedIn }

data class SlateUiState(
    val authState: AuthState = AuthState.Launching,
    val profile: SlateProfile? = null,
    val titles: List<SlateTitle> = emptyList(),
    val lists: List<SlateList> = emptyList(),
    val message: String? = null,
    val sharedText: String? = null,
    val posterColumns: List<List<String>> = LandingBackdrop.fallback.posterColumns,
    val avatarBytes: ByteArray? = null,
)

class SlateViewModel(private val graph: AppGraph) : ViewModel() {
    private val mutableState = MutableStateFlow(SlateUiState())
    val state: StateFlow<SlateUiState> = mutableState.asStateFlow()
    private var tokens: TokenPayload? = null

    init {
        viewModelScope.launch { refreshLandingBackdrop() }
        viewModelScope.launch { bootstrap() }
    }

    private suspend fun refreshLandingBackdrop() {
        val backdrop = runCatching { graph.api.landing() }.getOrNull() ?: return
        if (backdrop.posterColumns.isNotEmpty()) {
            mutableState.update { it.copy(posterColumns = backdrop.posterColumns) }
        }
    }

    fun signInWithGoogle(idToken: String, deviceName: String) {
        viewModelScope.launch {
            mutableState.update { it.copy(authState = AuthState.SigningIn, message = null) }
            runCatching { graph.api.signInWithGoogle(idToken, deviceName) }
                .onSuccess { session ->
                    tokens = session.tokens
                    graph.sessionStore.save(PersistedSession(session.tokens, session.user))
                    mutableState.update {
                        it.copy(authState = AuthState.SignedIn, profile = session.user)
                    }
                    refreshAvatar()
                    refreshLibrary()
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            authState = AuthState.SignedOut,
                            message = error.message ?: "Google sign-in did not finish.",
                        )
                    }
                }
        }
    }

    fun refreshLibrary() {
        viewModelScope.launch { refreshLibraryInternal() }
    }

    fun signOut() {
        val accessToken = tokens?.accessToken
        clearSession()
        if (accessToken != null) {
            viewModelScope.launch { runCatching { graph.api.logout(accessToken) } }
        }
    }

    fun receiveSharedText(text: String?) {
        val clean = text?.trim()?.takeIf(String::isNotEmpty) ?: return
        mutableState.update {
            it.copy(
                sharedText = clean,
                message = "Ready to find titles in the shared link.",
            )
        }
    }

    fun clearMessage() {
        mutableState.update { it.copy(message = null) }
    }

    fun showMessage(message: String) {
        mutableState.update { it.copy(message = message) }
    }

    fun titles(status: LibraryStatus): List<SlateTitle> = state.value.titles
        .filter { it.status == status }
        .sortedWith(compareBy<SlateTitle> { it.position }.thenByDescending { it.addedAt })

    suspend fun titleDetail(id: String): TitleDetailPayload = withAuthenticatedToken { accessToken ->
        graph.api.titleDetail(accessToken, id)
    }

    suspend fun search(query: String): CatalogSearchPayload = withAuthenticatedToken { accessToken ->
        graph.api.search(accessToken, query)
    }

    suspend fun discover(mediaType: MediaType, tmdbId: Int): DiscoverDetailPayload =
        withAuthenticatedToken { accessToken -> graph.api.discoverDetail(accessToken, mediaType, tmdbId) }

    suspend fun person(id: Int): PersonDetailPayload = withAuthenticatedToken { accessToken ->
        graph.api.person(accessToken, id)
    }

    suspend fun addCatalogTitle(
        tmdbId: Int,
        mediaType: MediaType,
        status: LibraryStatus = LibraryStatus.want,
    ): SlateTitle = mutateTitle(appendIfMissing = true) { accessToken ->
        graph.api.addCatalogTitle(accessToken, tmdbId, mediaType, status)
    }

    suspend fun setStatus(id: String, status: LibraryStatus): SlateTitle = mutateTitle { accessToken ->
        graph.api.updateTitleStatus(accessToken, id, status.name)
    }

    suspend fun setRating(id: String, rating: Int?): SlateTitle = mutateTitle { accessToken ->
        graph.api.updateTitleRating(accessToken, id, rating)
    }

    suspend fun setReview(id: String, review: String): SlateTitle = mutateTitle { accessToken ->
        graph.api.updateTitleReview(accessToken, id, review)
    }

    suspend fun removeTitle(id: String) {
        withAuthenticatedToken { accessToken -> graph.api.removeTitle(accessToken, id) }
        val updated = state.value.titles.filterNot { it.id == id }
        graph.libraryCache.replace(updated)
        mutableState.update { it.copy(titles = updated) }
    }

    suspend fun addTitleToList(
        id: String,
        listId: String? = null,
        name: String? = null,
    ): TitleListOption {
        val list = withAuthenticatedToken { accessToken ->
            graph.api.addTitleToList(accessToken, id, listId, name)
        }
        mutableState.update { current ->
            if (current.lists.any { it.id == list.id }) current else current.copy(
                lists = current.lists + SlateList(
                    id = list.id,
                    slug = list.slug,
                    name = list.name,
                    description = list.description,
                    createdAt = list.createdAt,
                    updatedAt = list.updatedAt,
                ),
            )
        }
        return list
    }

    suspend fun reorderStatus(status: LibraryStatus, ordered: List<SlateTitle>) {
        val original = state.value.titles
        val positions = ordered.mapIndexed { index, title -> title.id to index }.toMap()
        val local = original.map { title ->
            positions[title.id]?.let { title.copy(position = it) } ?: title
        }
        mutableState.update { it.copy(titles = local) }
        try {
            withAuthenticatedToken { graph.api.reorderStatus(it, status, ordered.map(SlateTitle::id)) }
            graph.libraryCache.replace(local)
        } catch (error: Exception) {
            mutableState.update { it.copy(titles = original) }
            throw error
        }
    }

    suspend fun listSummaries(): List<SlateListSummary> = withAuthenticatedToken {
        graph.api.lists(it).lists
    }

    suspend fun listDetail(id: String): SlateListDetailPayload = withAuthenticatedToken {
        graph.api.listDetail(it, id)
    }

    suspend fun createList(name: String, description: String): SlateListSummary =
        withAuthenticatedToken { accessToken ->
            val summary = graph.api.createList(accessToken, name, description)
            mutableState.update { current ->
                current.copy(lists = current.lists + SlateList(
                    summary.id,
                    summary.slug,
                    summary.name,
                    summary.description,
                    summary.createdAt,
                    summary.updatedAt,
                ))
            }
            summary
        }

    suspend fun updateList(id: String, name: String, description: String): SlateList =
        withAuthenticatedToken { accessToken ->
            val list = graph.api.updateList(accessToken, id, name, description)
            mutableState.update { current ->
                current.copy(lists = current.lists.map { if (it.id == id) list else it })
            }
            list
        }

    suspend fun deleteList(id: String) {
        withAuthenticatedToken { graph.api.deleteList(it, id) }
        mutableState.update { current -> current.copy(lists = current.lists.filterNot { it.id == id }) }
    }

    suspend fun addTitleToList(listId: String, titleId: String) {
        withAuthenticatedToken { graph.api.addTitleToList(it, listId, titleId) }
    }

    suspend fun removeTitleFromList(listId: String, titleId: String) {
        withAuthenticatedToken { graph.api.removeTitleFromList(it, listId, titleId) }
    }

    suspend fun reorderList(listId: String, ordered: List<SlateTitle>) {
        withAuthenticatedToken { graph.api.reorderList(it, listId, ordered.map(SlateTitle::id)) }
    }

    suspend fun updateProfile(displayName: String, username: String, isPublic: Boolean): SlateProfile =
        withAuthenticatedToken { accessToken ->
            val profile = graph.api.updateProfile(accessToken, displayName, username, isPublic)
            mutableState.update { it.copy(profile = profile) }
            tokens?.let { graph.sessionStore.save(PersistedSession(it, profile)) }
            profile
        }

    suspend fun uploadAvatar(bytes: ByteArray, mime: String): String? = withAuthenticatedToken {
        val url = graph.api.uploadAvatar(it, bytes, mime)
        mutableState.update { current ->
            current.copy(profile = current.profile?.copy(avatarUrl = url), avatarBytes = bytes)
        }
        state.value.profile?.let { profile -> tokens?.let { token ->
            graph.sessionStore.save(PersistedSession(token, profile))
        } }
        url
    }

    private fun refreshAvatar() {
        viewModelScope.launch {
            val bytes = runCatching {
                withAuthenticatedToken { graph.api.avatar(it) }
            }.getOrNull()
            if (bytes != null) mutableState.update { it.copy(avatarBytes = bytes) }
        }
    }

    suspend fun resolveSharedText(text: String): SharedLinkResolution = withAuthenticatedToken {
        graph.api.resolveSharedText(it, text)
    }

    private suspend fun bootstrap() {
        val cached = graph.libraryCache.titles()
        mutableState.update { it.copy(titles = cached) }
        val persisted = graph.sessionStore.load()
        if (persisted == null) {
            mutableState.update { it.copy(authState = AuthState.SignedOut) }
            return
        }

        tokens = persisted.tokens
        mutableState.update {
            it.copy(authState = AuthState.SignedIn, profile = persisted.profile)
        }
        refreshAvatar()

        // Offline launch keeps the local account and library visible. Only a
        // definitive 401 clears the device session.
        try {
            val refreshed = graph.api.refresh(persisted.tokens.refreshToken)
            tokens = refreshed
            graph.sessionStore.save(PersistedSession(refreshed, persisted.profile))
            refreshLibraryInternal()
        } catch (error: ApiException) {
            if (error.status == 401) clearSession()
            else mutableState.update { it.copy(message = "You're offline. Showing saved titles.") }
        } catch (_: Exception) {
            mutableState.update { it.copy(message = "You're offline. Showing saved titles.") }
        }
    }

    private suspend fun refreshLibraryInternal() {
        val current = tokens ?: return
        try {
            val snapshot = graph.api.library(current.accessToken)
            graph.libraryCache.replace(snapshot.titles)
            mutableState.update {
                it.copy(titles = snapshot.titles, lists = snapshot.lists)
            }
        } catch (error: ApiException) {
            if (error.status == 401) {
                try {
                    val refreshed = graph.api.refresh(current.refreshToken)
                    tokens = refreshed
                    state.value.profile?.let {
                        graph.sessionStore.save(PersistedSession(refreshed, it))
                    }
                    val snapshot = graph.api.library(refreshed.accessToken)
                    graph.libraryCache.replace(snapshot.titles)
                    mutableState.update {
                        it.copy(titles = snapshot.titles, lists = snapshot.lists)
                    }
                } catch (refreshError: ApiException) {
                    if (refreshError.status == 401) clearSession()
                    else mutableState.update { it.copy(message = refreshError.message) }
                } catch (refreshError: Exception) {
                    mutableState.update {
                        it.copy(message = refreshError.message ?: "Could not refresh Slate.")
                    }
                }
            } else {
                mutableState.update { it.copy(message = error.message) }
            }
        } catch (error: Exception) {
            mutableState.update { it.copy(message = error.message ?: "Could not refresh Slate.") }
        }
    }

    private suspend fun refreshSessionOnly() {
        val current = tokens ?: throw IllegalStateException("Sign in to continue.")
        val refreshed = graph.api.refresh(current.refreshToken)
        tokens = refreshed
        state.value.profile?.let { graph.sessionStore.save(PersistedSession(refreshed, it)) }
    }

    private suspend fun <T> withAuthenticatedToken(operation: suspend (String) -> T): T {
        val current = tokens ?: throw IllegalStateException("Sign in to continue.")
        return try {
            operation(current.accessToken)
        } catch (error: ApiException) {
            if (error.status != 401) throw error
            refreshSessionOnly()
            operation(tokens?.accessToken ?: throw IllegalStateException("Sign in to continue."))
        }
    }

    private suspend fun mutateTitle(
        appendIfMissing: Boolean = false,
        operation: suspend (String) -> SlateTitle,
    ): SlateTitle {
        val updated = withAuthenticatedToken(operation)
        val exists = state.value.titles.any { it.id == updated.id }
        val updatedTitles = if (!exists && appendIfMissing) state.value.titles + updated else {
            state.value.titles.map { if (it.id == updated.id) updated else it }
        }
        graph.libraryCache.replace(updatedTitles)
        mutableState.update { it.copy(titles = updatedTitles) }
        return updated
    }

    private fun clearSession() {
        val posterColumns = mutableState.value.posterColumns
        tokens = null
        graph.sessionStore.clear()
        mutableState.value = SlateUiState(
            authState = AuthState.SignedOut,
            posterColumns = posterColumns,
        )
        viewModelScope.launch { graph.libraryCache.clear() }
    }

    class Factory(private val graph: AppGraph) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SlateViewModel(graph) as T
        }
    }
}
