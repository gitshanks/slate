package space.s1ate.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import space.s1ate.app.BuildConfig
import space.s1ate.app.model.LibrarySnapshot
import space.s1ate.app.model.LandingBackdrop
import space.s1ate.app.model.SessionPayload
import space.s1ate.app.model.TokenPayload
import java.net.HttpURLConnection
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
}
