import Foundation

// MARK: - Ask Slate (`/api/v1/ai/chat`)

struct AIChatMessage: Codable, Hashable {
    enum Role: String, Codable { case user, assistant }
    let role: Role
    let content: String
}

/// A title the AI found, in TMDB's own shape plus where it sits on your slate.
struct AIChatResult: Decodable, Identifiable, Hashable {
    let tmdbId: Int
    let mediaType: MediaType
    let title: String
    let posterPath: String?
    let releaseDate: String?
    let voteAverage: Double?
    let libraryId: String?
    let libraryStatus: LibraryStatus?

    var id: String { "\(mediaType.rawValue)-\(tmdbId)" }
    var year: String? { releaseDate.flatMap { $0.isEmpty ? nil : String($0.prefix(4)) } }
    var posterURL: URL? {
        posterPath.flatMap { URL(string: "https://image.tmdb.org/t/p/w342\($0)") }
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, name
        case mediaType = "media_type"
        case posterPath = "poster_path"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case voteAverage = "vote_average"
        case libraryId = "library_id"
        case libraryStatus = "library_status"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tmdbId = try c.decode(Int.self, forKey: .id)
        mediaType = (try? c.decode(MediaType.self, forKey: .mediaType)) ?? .movie
        title = (try? c.decode(String.self, forKey: .title)) ?? (try? c.decode(String.self, forKey: .name)) ?? "Untitled"
        posterPath = try? c.decode(String.self, forKey: .posterPath)
        releaseDate = (try? c.decode(String.self, forKey: .releaseDate)) ?? (try? c.decode(String.self, forKey: .firstAirDate))
        voteAverage = try? c.decode(Double.self, forKey: .voteAverage)
        libraryId = try? c.decode(String.self, forKey: .libraryId)
        libraryStatus = try? c.decode(LibraryStatus.self, forKey: .libraryStatus)
    }
}

/// One line of the chat stream.
enum AIChatEvent {
    case text(String)
    case searchStart
    case results([AIChatResult])
    case done
    case error(String)

    init?(line: String) {
        guard let data = line.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String else { return nil }
        switch type {
        case "text": self = .text(object["delta"] as? String ?? "")
        case "search_start": self = .searchStart
        case "search_result":
            let raw = (try? JSONSerialization.data(withJSONObject: object["results"] ?? [])) ?? Data("[]".utf8)
            self = .results((try? JSONDecoder().decode([AIChatResult].self, from: raw)) ?? [])
        case "done": self = .done
        case "error": self = .error(object["message"] as? String ?? "Slate couldn't answer that.")
        default: return nil
        }
    }
}

// MARK: - Previews (`/api/public/previews`)

struct PreviewBatch: Decodable {
    let items: [PreviewItem]
    let attemptedKeys: [String]?
}

/// One trailer in the Previews feed.
struct PreviewItem: Decodable, Identifiable, Hashable {
    let tmdbId: Int
    let mediaType: MediaType
    let title: String
    let posterPath: String?
    let backdropPath: String?
    let releaseDate: String?
    let voteAverage: Double?
    let genreIds: [Int]
    let source: String?
    let videoKey: String
    let videoName: String?
    let orientationHint: String?
    let overview: String?

    var id: String { key }
    var key: String { "\(mediaType.rawValue):\(tmdbId)" }
    var year: String? { releaseDate.flatMap { $0.isEmpty ? nil : String($0.prefix(4)) } }
    var backdropURL: URL? { backdropPath.flatMap { URL(string: "https://image.tmdb.org/t/p/w1280\($0)") } }
    var posterURL: URL? { posterPath.flatMap { URL(string: "https://image.tmdb.org/t/p/w500\($0)") } }

    /// Why this trailer is here, as the web labels it (`lib/preview-display.ts`).
    var sourceLabel: String? {
        switch source {
        case "library": "Based on your library"
        case "trending": "Trending this week"
        case "now_playing": "Now playing"
        default: nil
        }
    }

    var genreName: String? { genreIds.first.flatMap { TMDBGenres.name(for: $0) } }

    private enum CodingKeys: String, CodingKey {
        case id, title, name, overview, source
        case mediaType = "media_type"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case voteAverage = "vote_average"
        case genreIds = "genre_ids"
        case videoKey, videoName, orientationHint
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tmdbId = try c.decode(Int.self, forKey: .id)
        mediaType = (try? c.decode(MediaType.self, forKey: .mediaType)) ?? .movie
        title = (try? c.decode(String.self, forKey: .title)) ?? (try? c.decode(String.self, forKey: .name)) ?? "Untitled"
        posterPath = try? c.decode(String.self, forKey: .posterPath)
        backdropPath = try? c.decode(String.self, forKey: .backdropPath)
        releaseDate = (try? c.decode(String.self, forKey: .releaseDate)) ?? (try? c.decode(String.self, forKey: .firstAirDate))
        voteAverage = try? c.decode(Double.self, forKey: .voteAverage)
        genreIds = (try? c.decode([Int].self, forKey: .genreIds)) ?? []
        source = try? c.decode(String.self, forKey: .source)
        videoKey = try c.decode(String.self, forKey: .videoKey)
        videoName = try? c.decode(String.self, forKey: .videoName)
        orientationHint = try? c.decode(String.self, forKey: .orientationHint)
        overview = try? c.decode(String.self, forKey: .overview)
    }
}

/// TMDB's genre names for films and series, for labels where only ids arrive.
enum TMDBGenres {
    private static let names: [Int: String] = [
        28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
        99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
        27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
        10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
        10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
        10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
    ]

    static func name(for id: Int) -> String? { names[id] }
}

struct AccountDeleted: Decodable {
    let deleted: Bool
}

// MARK: - First-run picks (`/api/v1/onboarding`)

struct OnboardingTitle: Codable, Identifiable, Hashable {
    let tmdbId: Int
    let mediaType: MediaType
    let title: String
    let overview: String
    let posterPath: String
    let backdropPath: String
    let releaseDate: String?
    let genres: [String]

    var id: String { "\(mediaType.rawValue):\(tmdbId)" }
    var year: String? { releaseDate.flatMap { $0.isEmpty ? nil : String($0.prefix(4)) } }
    var posterURL: URL? { URL(string: "https://image.tmdb.org/t/p/w500\(posterPath)") }
    var backdropURL: URL? { URL(string: "https://image.tmdb.org/t/p/w1280\(backdropPath)") }
    var pick: OnboardingPick { OnboardingPick(tmdbId: tmdbId, mediaType: mediaType) }
}

struct OnboardingPick: Codable, Hashable {
    let tmdbId: Int
    let mediaType: MediaType
}

struct OnboardingPayload: Decodable, Identifiable {
    var id: String { titles.first?.id ?? "none" }
    let needed: Bool
    let more: Bool
    let titles: [OnboardingTitle]
}

struct OnboardingSuggestions: Decodable {
    let titles: [OnboardingTitle]
}

struct OnboardingSaved: Decodable {
    let savedCount: Int
}

// MARK: - Importing history (`/api/v1/import`)

/// One row of an export, as the server read it. Sent back unchanged.
struct ImportRow: Codable, Hashable {
    let title: String
    let sourceText: String
    var year: Int?
    var date: String?
    var tmdbId: Int?
    var imdbId: String?
    var mediaHint: String?
    var isEpisode: Bool?
}

struct ImportRows: Decodable {
    let rows: [ImportRow]
}

struct ImportedTitle: Decodable, Identifiable, Hashable {
    let tmdbId: Int
    let mediaType: MediaType
    let title: String
    let posterPath: String?
    let year: Int?

    var id: String { "\(mediaType.rawValue):\(tmdbId)" }
    var posterURL: URL? { posterPath.flatMap { URL(string: "https://image.tmdb.org/t/p/w342\($0)") } }

    private enum CodingKeys: String, CodingKey {
        case tmdbId = "tmdb_id", mediaType = "media_type", title, posterPath = "poster_path", year
    }
}

struct ImportBatchResult: Decodable {
    let imported: Int
    let unmatched: [String]
    let titles: [ImportedTitle]
}

// MARK: - Shared lists

struct ListPerson: Codable, Identifiable, Hashable {
    let id: String
    let displayName: String
    let avatarUrl: URL?
}

struct ListInvite: Decodable {
    let url: URL
    let expiresAt: String
}

struct ListLeft: Decodable { let left: Bool }
struct ListMemberRemoved: Decodable { let removed: Bool }
