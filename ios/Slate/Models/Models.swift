import Foundation

enum LibraryStatus: String, Codable, CaseIterable, Identifiable {
    case want
    case watching
    case watched
    case dropped

    var id: String { rawValue }

    var label: String {
        switch self {
        case .want: "Watchlist"
        case .watching: "Watching"
        case .watched: "Watched"
        case .dropped: "Dropped"
        }
    }
}

enum MediaType: String, Codable {
    case movie
    case tv
}

struct Genre: Codable, Hashable {
    let id: Int
    let name: String
}

struct SeasonSummary: Codable, Hashable {
    let n: Int
    let c: Int
}

struct SlateProfile: Codable, Identifiable, Hashable {
    let id: String
    var username: String
    var displayName: String
    var avatarUrl: URL?
    var isPublic: Bool
    let createdAt: String
    var updatedAt: String
}

struct SlateTitle: Codable, Identifiable, Hashable {
    let id: String
    let tmdbId: Int
    let mediaType: MediaType
    let title: String
    let originalTitle: String?
    let overview: String?
    let posterPath: String?
    let backdropPath: String?
    let releaseDate: String?
    let runtime: Int?
    let genres: [Genre]?
    var status: LibraryStatus
    var rating: Double?
    var review: String?
    var favorite: Bool
    let addedAt: String
    var watchedAt: String?
    var updatedAt: String
    var position: Int
    let tmdbRating: Double?
    let tmdbVoteCount: Int?
    let imdbId: String?
    let imdbRating: Double?
    let imdbVotes: Int?
    let rottenTomatoesScore: Int?
    let metacriticScore: Int?
    var currentSeason: Int?
    var currentEpisode: Int?
    let seasons: [SeasonSummary]?

    var posterURL: URL? {
        guard let posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w780\(posterPath)")
    }

    var year: String? { releaseDate?.prefix(4).description }
}

struct SlateList: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let description: String?
    let createdAt: String
    let updatedAt: String
}

struct LibrarySnapshot: Codable {
    let titles: [SlateTitle]
    let lists: [SlateList]
    let serverTime: String
}

struct LandingBackdrop: Codable {
    let posterColumns: [[URL]]

    static let fallback = LandingBackdrop(
        posterColumns: [
            ["1pdfLvkbY9ohJlCjQH2CZjjYVvJ", "pPHpeI2X1qEd1CS1SeyrdhZ4qnT", "lqoMzCcZYEFK729d6qzt349fB4o", "7O4iVfOMQmdCSxhOg1WnzG1AgYT", "dmo6TYuuJgaYinXBPjrgG9mB5od"],
            ["k3waqVXSnvCZWfJYNtdamTgTtTA", "c15BtJxCXMrISLVmysdsnZUPQft", "kCGlIMHnOm8JPXq3rXM6c5wMxcT", "zYqVTiHK5ZajYcNzAW7qWte5NWS", "8Gxv8gSFCU0XGDykEGv7zR1n2ua"],
            ["vYEyxF1UT779RiEalpMjUT6kfdf", "3bhkrj58Vtu7enYsRolD1fZdja1", "gbSaK9v1CbcYH1ISgbM7XObD2dW", "sWgBv7LV2PRoQgkxwlibdGXKz1S", "dnpatlJrEPiDSn5fzgzvxtiSnMo"],
            ["z0XiwdrCQ9yVIr4O0pxzaAYRxdW", "abf8tHznhSvl9BAElD2cQeRr7do", "zjg4jpK1Wp2kiRvtt5ND0kznako", "khZqmwHQicTYoS7Flreb9EddFZC", "hlLXt2tOPT6RRnjiUmoxyG1LTFi"],
            ["hTP1DtLGFamjfu8WqjnuQdP1n4i", "25ih0Xq2zWbxhhKxwhvswKYQyEr", "u68AjlvlutfEIcpmbYpKcdi09ut", "ztkUQFLlC19CCMYHW9o1zWhJRNq", "eKfVzzEazSIjJMrw9ADa2x8ksLz"],
            ["7IiTTgloJzvGI1TAYymCfbfl3vT", "27vEYsRKa3eAniwmoccOoluEXQ1", "hjlZSXM86wJrfCv5VKfR5DI2VeU", "7fn624j5lj3xTme2SgiLCeuedmO", "zU0htwkhNvBQdVSIKB9s6hgVeFK"],
            ["qLnfEmPrDjJfPyyddLJPkXmshkp", "7v8iCNzKFpdlrCMcqCoJyn74Nsa", "uDO8zWDhfWwoFdKS4fzkUJt0Rf0", "pEzNVQfdzYDzVK0XqxERIw2x2se", "xlaY2zyzMfkhk0HSC5VUwzoZPU1"],
            ["vQWk5YBFWF4bZaofAbv0tShwBvQ", "qJ2tW6WMUDux911r6m7haRef0WH", "ulzhLuWrPK07P1YkdWQLZnQh1JL", "7QMsOTMUswlwxJP0rTTZfmz2tX2", "AoGsDM02UVt0npBA8OvpDcZbaMi"],
        ].map { column in
            (0..<8).compactMap { index in
                URL(string: "https://image.tmdb.org/t/p/w500/\(column[index % column.count]).jpg")
            }
        }
    )
}

struct TokenPayload: Codable {
    let accessToken: String
    let accessTokenExpiresIn: Int
    let refreshToken: String
    let refreshTokenExpiresAt: String
}

struct SessionPayload: Codable {
    let accessToken: String
    let accessTokenExpiresIn: Int
    let refreshToken: String
    let refreshTokenExpiresAt: String
    let user: SlateProfile

    var tokens: TokenPayload {
        TokenPayload(
            accessToken: accessToken,
            accessTokenExpiresIn: accessTokenExpiresIn,
            refreshToken: refreshToken,
            refreshTokenExpiresAt: refreshTokenExpiresAt
        )
    }
}

struct APIEnvelope<Value: Decodable>: Decodable {
    let data: Value
}

struct APIErrorEnvelope: Decodable {
    struct Detail: Decodable {
        let code: String
        let message: String
    }
    let error: Detail
}
