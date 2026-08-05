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
import space.s1ate.app.model.PersistedSession
import space.s1ate.app.model.SlateList
import space.s1ate.app.model.SlateProfile
import space.s1ate.app.model.SlateTitle
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
