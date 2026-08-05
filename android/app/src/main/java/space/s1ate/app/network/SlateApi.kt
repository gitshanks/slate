package space.s1ate.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import space.s1ate.app.BuildConfig
import space.s1ate.app.model.LibrarySnapshot
import space.s1ate.app.model.LandingBackdrop
import space.s1ate.app.model.CatalogSearchPayload
import space.s1ate.app.model.DiscoverDetailPayload
import space.s1ate.app.model.LibraryStatus
import space.s1ate.app.model.ListsPayload
import space.s1ate.app.model.MediaType
import space.s1ate.app.model.PersonDetailPayload
import space.s1ate.app.model.SessionPayload
import space.s1ate.app.model.SharedLinkResolution
import space.s1ate.app.model.SlateList
import space.s1ate.app.model.SlateListDetailPayload
import space.s1ate.app.model.SlateListSummary
import space.s1ate.app.model.SlateProfile
import space.s1ate.app.model.SlateTitle
import space.s1ate.app.model.TitleDetailPayload
import space.s1ate.app.model.TitleListOption
import space.s1ate.app.model.TokenPayload
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

class ApiException(val status: Int, override val message: String) : Exception(message)

class SlateApi {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    @Serializable
    private data class Envelope<T>(val data: T)

    @Serializable
    private data class ErrorEnvelope(val error: ErrorDetail) {
        @Serializable
        data class ErrorDetail(val code: String, val message: String)
    }

    @Serializable
    private data class GoogleSignInBody(
        val idToken: String,
        val platform: String = "android",
        val deviceName: String,
    )

    @Serializable
    private data class RefreshBody(val refreshToken: String)

    @Serializable
    private data class SignedOut(val signedOut: Boolean)

    @Serializable
    private data class Deleted(val deleted: Boolean)

    @Serializable
    private data class Reordered(val reordered: Boolean)

    @Serializable
    private data class Added(val added: Boolean)

    @Serializable
    private data class Removed(val removed: Boolean)

    @Serializable
    private data class AvatarResult(val avatarUrl: String? = null)

    suspend fun signInWithGoogle(idToken: String, deviceName: String): SessionPayload =
        request(
            path = "auth/google",
            method = "POST",
            body = json.encodeToString(GoogleSignInBody(idToken, deviceName = deviceName)),
        )

    suspend fun refresh(refreshToken: String): TokenPayload = request(
        path = "auth/refresh",
        method = "POST",
        body = json.encodeToString(RefreshBody(refreshToken)),
    )

    suspend fun library(accessToken: String): LibrarySnapshot = request(
        path = "library",
        accessToken = accessToken,
    )

    suspend fun landing(): LandingBackdrop = request(path = "landing")

    suspend fun profile(accessToken: String): SlateProfile = request("me", accessToken = accessToken)

    suspend fun updateProfile(
        accessToken: String,
        displayName: String,
        username: String,
        isPublic: Boolean,
    ): SlateProfile = request(
        path = "me",
        method = "PATCH",
        accessToken = accessToken,
        body = buildJsonObject {
            put("displayName", displayName)
            put("username", username)
            put("isPublic", isPublic)
        }.toString(),
    )

    suspend fun uploadAvatar(accessToken: String, bytes: ByteArray, mime: String): String? {
        return requestBytes<AvatarResult>("me/avatar", "POST", accessToken, bytes, mime).avatarUrl
    }

    suspend fun avatar(accessToken: String): ByteArray? = withContext(Dispatchers.IO) {
        val connection = (URL(BuildConfig.SLATE_API_BASE_URL + "me/avatar")
            .openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 20_000
            useCaches = false
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            val status = connection.responseCode
            if (status == 404) return@withContext null
            if (status !in 200..299) throw ApiException(status, "Profile photo could not be loaded.")
            connection.inputStream.use { it.readBytes() }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun search(accessToken: String, query: String): CatalogSearchPayload = request(
        path = "search?q=${URLEncoder.encode(query, Charsets.UTF_8.name())}",
        accessToken = accessToken,
    )

    suspend fun discoverDetail(
        accessToken: String,
        mediaType: MediaType,
        tmdbId: Int,
    ): DiscoverDetailPayload = request(
        path = "discover/${mediaType.name}/$tmdbId",
        accessToken = accessToken,
    )

    suspend fun person(accessToken: String, id: Int): PersonDetailPayload = request(
        path = "people/$id",
        accessToken = accessToken,
    )

    suspend fun addCatalogTitle(
        accessToken: String,
        tmdbId: Int,
        mediaType: MediaType,
        status: LibraryStatus,
    ): SlateTitle = request(
        path = "titles",
        method = "POST",
        accessToken = accessToken,
        body = buildJsonObject {
            put("tmdbId", tmdbId)
            put("mediaType", mediaType.name)
            put("status", status.name)
        }.toString(),
    )

    suspend fun titleDetail(accessToken: String, id: String): TitleDetailPayload = request(
        path = "titles/$id",
        accessToken = accessToken,
    )

    suspend fun updateTitleStatus(
        accessToken: String,
        id: String,
        status: String,
    ): SlateTitle = request(
        path = "titles/$id",
        method = "PATCH",
        accessToken = accessToken,
        body = buildJsonObject { put("status", status) }.toString(),
    )

    suspend fun updateTitleRating(
        accessToken: String,
        id: String,
        rating: Int?,
    ): SlateTitle = request(
        path = "titles/$id",
        method = "PATCH",
        accessToken = accessToken,
        body = buildJsonObject {
            if (rating == null) put("rating", JsonNull) else put("rating", rating)
        }.toString(),
    )

    suspend fun updateTitleReview(
        accessToken: String,
        id: String,
        review: String,
    ): SlateTitle = request(
        path = "titles/$id",
        method = "PATCH",
        accessToken = accessToken,
        body = buildJsonObject { put("review", review) }.toString(),
    )

    suspend fun removeTitle(accessToken: String, id: String) {
        request<Deleted>(path = "titles/$id", method = "DELETE", accessToken = accessToken)
    }

    suspend fun addTitleToList(
        accessToken: String,
        id: String,
        listId: String? = null,
        name: String? = null,
    ): TitleListOption = request(
        path = "titles/$id/lists",
        method = "POST",
        accessToken = accessToken,
        body = buildJsonObject {
            listId?.let { put("listId", it) }
            name?.let { put("name", it) }
        }.toString(),
    )

    suspend fun reorderStatus(
        accessToken: String,
        status: LibraryStatus,
        ids: List<String>,
    ) {
        val body = buildJsonObject {
            put("kind", "status")
            put("status", status.name)
            put("titleIds", JsonArray(ids.map { JsonPrimitive(it) }))
        }.toString()
        request<Reordered>("reorder", "PATCH", accessToken, body)
    }

    suspend fun reorderList(accessToken: String, listId: String, ids: List<String>) {
        val body = buildJsonObject {
            put("kind", "list")
            put("listId", listId)
            put("titleIds", JsonArray(ids.map { JsonPrimitive(it) }))
        }.toString()
        request<Reordered>("reorder", "PATCH", accessToken, body)
    }

    suspend fun lists(accessToken: String): ListsPayload = request("lists", accessToken = accessToken)

    suspend fun listDetail(accessToken: String, id: String): SlateListDetailPayload = request(
        "lists/$id",
        accessToken = accessToken,
    )

    suspend fun createList(
        accessToken: String,
        name: String,
        description: String,
    ): SlateListSummary = request(
        "lists",
        "POST",
        accessToken,
        buildJsonObject { put("name", name); put("description", description) }.toString(),
    )

    suspend fun updateList(
        accessToken: String,
        id: String,
        name: String,
        description: String,
    ): SlateList = request(
        "lists/$id",
        "PATCH",
        accessToken,
        buildJsonObject { put("name", name); put("description", description) }.toString(),
    )

    suspend fun deleteList(accessToken: String, id: String) {
        request<Deleted>("lists/$id", "DELETE", accessToken)
    }

    suspend fun addTitleToList(accessToken: String, listId: String, titleId: String) {
        request<Added>("lists/$listId/titles/$titleId", "POST", accessToken)
    }

    suspend fun removeTitleFromList(accessToken: String, listId: String, titleId: String) {
        request<Removed>("lists/$listId/titles/$titleId", "DELETE", accessToken)
    }

    suspend fun resolveSharedText(accessToken: String, text: String): SharedLinkResolution = request(
        "share/resolve",
        "POST",
        accessToken,
        buildJsonObject { put("text", text) }.toString(),
    )

    suspend fun logout(accessToken: String) {
        request<SignedOut>(
            path = "auth/logout",
            method = "POST",
            accessToken = accessToken,
        )
    }

    private suspend inline fun <reified T> request(
        path: String,
        method: String = "GET",
        accessToken: String? = null,
        body: String? = null,
    ): T = withContext(Dispatchers.IO) {
        val connection = (URL(BuildConfig.SLATE_API_BASE_URL + path)
            .openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 20_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (body != null) {
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val bytes = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use { it.readBytes() }
                ?: ByteArray(0)
            val response = bytes.toString(Charsets.UTF_8)
            if (status !in 200..299) {
                val detail = runCatching { json.decodeFromString<ErrorEnvelope>(response) }.getOrNull()
                throw ApiException(
                    status,
                    detail?.error?.message ?: "Slate could not complete that request.",
                )
            }
            json.decodeFromString<Envelope<T>>(response).data
        } finally {
            connection.disconnect()
        }
    }

    private suspend inline fun <reified T> requestBytes(
        path: String,
        method: String,
        accessToken: String,
        body: ByteArray,
        contentType: String,
    ): T = withContext(Dispatchers.IO) {
        val connection = (URL(BuildConfig.SLATE_API_BASE_URL + path)
            .openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 20_000
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Content-Type", contentType)
            setFixedLengthStreamingMode(body.size)
        }
        try {
            connection.outputStream.use { it.write(body) }
            val status = connection.responseCode
            val bytes = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use { it.readBytes() } ?: ByteArray(0)
            val response = bytes.toString(Charsets.UTF_8)
            if (status !in 200..299) {
                val detail = runCatching { json.decodeFromString<ErrorEnvelope>(response) }.getOrNull()
                throw ApiException(status, detail?.error?.message ?: "Slate could not complete that request.")
            }
            json.decodeFromString<Envelope<T>>(response).data
        } finally {
            connection.disconnect()
        }
    }
}
