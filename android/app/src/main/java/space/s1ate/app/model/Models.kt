package space.s1ate.app.model

import kotlinx.serialization.Serializable

@Serializable
enum class LibraryStatus {
    want,
    watching,
    watched,
    dropped;

    val label: String
        get() = when (this) {
            want -> "Watchlist"
            watching -> "Watching"
            watched -> "Watched"
            dropped -> "Dropped"
        }
}

@Serializable
enum class MediaType { movie, tv }

@Serializable
data class Genre(val id: Int, val name: String)

@Serializable
data class SeasonSummary(val n: Int, val c: Int)

@Serializable
data class SlateProfile(
    val id: String,
    val username: String,
    val displayName: String,
    val avatarUrl: String? = null,
    val isPublic: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SlateTitle(
    val id: String,
    val tmdbId: Int,
    val mediaType: MediaType,
    val title: String,
    val originalTitle: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val releaseDate: String? = null,
    val runtime: Int? = null,
    val genres: List<Genre>? = null,
    val status: LibraryStatus,
    val rating: Double? = null,
    val review: String? = null,
    val favorite: Boolean,
    val addedAt: String,
    val watchedAt: String? = null,
    val updatedAt: String,
    val position: Int,
    val tmdbRating: Double? = null,
    val tmdbVoteCount: Int? = null,
    val imdbId: String? = null,
    val imdbRating: Double? = null,
    val imdbVotes: Int? = null,
    val rottenTomatoesScore: Int? = null,
    val metacriticScore: Int? = null,
    val currentSeason: Int? = null,
    val currentEpisode: Int? = null,
    val seasons: List<SeasonSummary>? = null,
) {
    val posterUrl: String?
        get() = posterPath?.let { "https://image.tmdb.org/t/p/w780$it" }

    val backdropUrl: String?
        get() = backdropPath?.let { "https://image.tmdb.org/t/p/w1280$it" }

    val year: String?
        get() = releaseDate?.take(4)
}

@Serializable
data class TitlePerson(
    val id: Int,
    val name: String,
    val subtitle: String? = null,
    val profilePath: String? = null,
) {
    val profileUrl: String?
        get() = profilePath?.let { "https://image.tmdb.org/t/p/w342$it" }
}

@Serializable
data class TitleRecommendation(
    val tmdbId: Int,
    val mediaType: MediaType,
    val title: String,
    val posterPath: String? = null,
    val releaseDate: String? = null,
) {
    val posterUrl: String?
        get() = posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }

    val year: String?
        get() = releaseDate?.take(4)
}

@Serializable
data class TitleWatchProvider(
    val id: Int,
    val name: String,
    val logoPath: String,
) {
    val logoUrl: String?
        get() = logoPath?.let { "https://image.tmdb.org/t/p/w185$it" }
}

@Serializable
data class TitleWatchProviders(
    val link: String,
    val providers: List<TitleWatchProvider> = emptyList(),
)

@Serializable
data class TitleListOption(
    val id: String,
    val slug: String,
    val name: String,
    val description: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val containsTitle: Boolean = false,
)

@Serializable
data class TitleDetailPayload(
    val title: SlateTitle,
    val trailerKey: String? = null,
    val cast: List<TitlePerson> = emptyList(),
    val crew: List<TitlePerson> = emptyList(),
    val recommendations: List<TitleRecommendation> = emptyList(),
    val watchProviders: TitleWatchProviders? = null,
    val lists: List<TitleListOption> = emptyList(),
)

@Serializable
data class SavedTitleReference(val id: String, val status: LibraryStatus)

@Serializable
data class CatalogTitle(
    val tmdbId: Int,
    val mediaType: MediaType,
    val title: String,
    val originalTitle: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val releaseDate: String? = null,
    val tmdbRating: Double? = null,
    val saved: SavedTitleReference? = null,
) {
    val id: String get() = "${mediaType.name}-$tmdbId"
    val posterUrl: String? get() = posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }
    val backdropUrl: String? get() = backdropPath?.let { "https://image.tmdb.org/t/p/w1280$it" }
    val year: String? get() = releaseDate?.take(4)
}

@Serializable
data class CatalogPerson(
    val id: Int,
    val name: String,
    val profilePath: String? = null,
    val knownForDepartment: String? = null,
    val knownFor: List<String> = emptyList(),
) {
    val profileUrl: String? get() = profilePath?.let { "https://image.tmdb.org/t/p/w342$it" }
}

@Serializable
data class CatalogSearchPayload(
    val results: List<CatalogTitle>,
    val people: List<CatalogPerson>,
    val approximate: Boolean,
    val approximateQuery: String? = null,
)

@Serializable
data class DiscoverTitle(
    val tmdbId: Int,
    val mediaType: MediaType,
    val title: String,
    val originalTitle: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val releaseDate: String? = null,
    val runtime: Int? = null,
    val genres: List<Genre> = emptyList(),
    val tmdbRating: Double? = null,
    val imdbId: String? = null,
    val imdbRating: Double? = null,
    val rottenTomatoesScore: Int? = null,
    val metacriticScore: Int? = null,
) {
    val backdropUrl: String? get() = backdropPath?.let { "https://image.tmdb.org/t/p/w1280$it" }
    val year: String? get() = releaseDate?.take(4)
}

@Serializable
data class DiscoverDetailPayload(
    val title: DiscoverTitle,
    val savedTitle: SlateTitle? = null,
    val trailerKey: String? = null,
    val cast: List<TitlePerson> = emptyList(),
    val crew: List<TitlePerson> = emptyList(),
    val recommendations: List<CatalogTitle> = emptyList(),
    val watchProviders: TitleWatchProviders? = null,
)

@Serializable
data class PersonDetailPayload(
    val id: Int,
    val name: String,
    val biography: String? = null,
    val birthday: String? = null,
    val placeOfBirth: String? = null,
    val profilePath: String? = null,
    val knownForDepartment: String,
    val knownFor: List<CatalogTitle> = emptyList(),
) {
    val profileUrl: String? get() = profilePath?.let { "https://image.tmdb.org/t/p/w500$it" }
}

@Serializable
data class SlateList(
    val id: String,
    val slug: String,
    val name: String,
    val description: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SlateListSummary(
    val id: String,
    val slug: String,
    val name: String,
    val description: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val count: Int,
    val posterPaths: List<String> = emptyList(),
) {
    val posters: List<String> get() = posterPaths.map { "https://image.tmdb.org/t/p/w342$it" }
}

@Serializable
data class ListsPayload(val lists: List<SlateListSummary>)

@Serializable
data class SlateListDetailPayload(
    val list: SlateList,
    val titles: List<SlateTitle>,
    val candidates: List<SlateTitle>,
)

@Serializable
data class SharedLinkCandidate(
    val tmdbId: Int,
    val mediaType: MediaType,
    val title: String,
    val year: String? = null,
    val posterPath: String? = null,
    val overview: String? = null,
    val voteAverage: Double? = null,
    val sourceTitle: String,
    val inLibrary: Boolean,
) {
    val id: String get() = "${mediaType.name}-$tmdbId"
    val posterUrl: String? get() = posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }
}

@Serializable
data class SharedLinkSource(
    val url: String? = null,
    val hostname: String? = null,
    val title: String? = null,
)

@Serializable
data class SharedLinkResolution(
    val source: SharedLinkSource,
    val candidates: List<SharedLinkCandidate>,
    val warning: String? = null,
)

@Serializable
data class LibrarySnapshot(
    val titles: List<SlateTitle>,
    val lists: List<SlateList>,
    val serverTime: String,
)

@Serializable
data class LandingBackdrop(val posterColumns: List<List<String>>) {
    companion object {
        val fallback = LandingBackdrop(
            listOf(
                listOf("1pdfLvkbY9ohJlCjQH2CZjjYVvJ", "pPHpeI2X1qEd1CS1SeyrdhZ4qnT", "lqoMzCcZYEFK729d6qzt349fB4o", "7O4iVfOMQmdCSxhOg1WnzG1AgYT", "dmo6TYuuJgaYinXBPjrgG9mB5od"),
                listOf("k3waqVXSnvCZWfJYNtdamTgTtTA", "c15BtJxCXMrISLVmysdsnZUPQft", "kCGlIMHnOm8JPXq3rXM6c5wMxcT", "zYqVTiHK5ZajYcNzAW7qWte5NWS", "8Gxv8gSFCU0XGDykEGv7zR1n2ua"),
                listOf("vYEyxF1UT779RiEalpMjUT6kfdf", "3bhkrj58Vtu7enYsRolD1fZdja1", "gbSaK9v1CbcYH1ISgbM7XObD2dW", "sWgBv7LV2PRoQgkxwlibdGXKz1S", "dnpatlJrEPiDSn5fzgzvxtiSnMo"),
                listOf("z0XiwdrCQ9yVIr4O0pxzaAYRxdW", "abf8tHznhSvl9BAElD2cQeRr7do", "zjg4jpK1Wp2kiRvtt5ND0kznako", "khZqmwHQicTYoS7Flreb9EddFZC", "hlLXt2tOPT6RRnjiUmoxyG1LTFi"),
                listOf("hTP1DtLGFamjfu8WqjnuQdP1n4i", "25ih0Xq2zWbxhhKxwhvswKYQyEr", "u68AjlvlutfEIcpmbYpKcdi09ut", "ztkUQFLlC19CCMYHW9o1zWhJRNq", "eKfVzzEazSIjJMrw9ADa2x8ksLz"),
                listOf("7IiTTgloJzvGI1TAYymCfbfl3vT", "27vEYsRKa3eAniwmoccOoluEXQ1", "hjlZSXM86wJrfCv5VKfR5DI2VeU", "7fn624j5lj3xTme2SgiLCeuedmO", "zU0htwkhNvBQdVSIKB9s6hgVeFK"),
                listOf("qLnfEmPrDjJfPyyddLJPkXmshkp", "7v8iCNzKFpdlrCMcqCoJyn74Nsa", "uDO8zWDhfWwoFdKS4fzkUJt0Rf0", "pEzNVQfdzYDzVK0XqxERIw2x2se", "xlaY2zyzMfkhk0HSC5VUwzoZPU1"),
                listOf("vQWk5YBFWF4bZaofAbv0tShwBvQ", "qJ2tW6WMUDux911r6m7haRef0WH", "ulzhLuWrPK07P1YkdWQLZnQh1JL", "7QMsOTMUswlwxJP0rTTZfmz2tX2", "AoGsDM02UVt0npBA8OvpDcZbaMi"),
            ).map { column ->
                List(8) { index ->
                    "https://image.tmdb.org/t/p/w500/${column[index % column.size]}.jpg"
                }
            },
        )
    }
}

@Serializable
data class TokenPayload(
    val accessToken: String,
    val accessTokenExpiresIn: Int,
    val refreshToken: String,
    val refreshTokenExpiresAt: String,
)

@Serializable
data class SessionPayload(
    val accessToken: String,
    val accessTokenExpiresIn: Int,
    val refreshToken: String,
    val refreshTokenExpiresAt: String,
    val user: SlateProfile,
) {
    val tokens: TokenPayload
        get() = TokenPayload(
            accessToken = accessToken,
            accessTokenExpiresIn = accessTokenExpiresIn,
            refreshToken = refreshToken,
            refreshTokenExpiresAt = refreshTokenExpiresAt,
        )
}

@Serializable
data class PersistedSession(
    val tokens: TokenPayload,
    val profile: SlateProfile,
)
