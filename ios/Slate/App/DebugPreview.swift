#if DEBUG
import Foundation

/// A signed-in app on made-up data, for checking layouts in the Simulator
/// without an account. Debug builds only, and only when launched with
/// `-slatePreview 1`. Other launch arguments pick the state to show:
/// `-slateTab discover|lists|profile`, `-slateShelf all|watching|watched`,
/// `-slateCount <n>` (library size), `-slateSheet filters`,
/// `-slateFormat movie|tv`, `-slateMoveShelf <index>` (move the shelf selector
/// after a moment), `-slateSlowLiquid <factor>` (slow the selector down) and
/// `-slateFailReorder 1` (make saving a new order fail).
enum SlatePreview {
    private static var defaults: UserDefaults { .standard }

    static let isOn = defaults.bool(forKey: "slatePreview")
    static var tab: String? { isOn ? defaults.string(forKey: "slateTab") : nil }
    static var shelf: String? { isOn ? defaults.string(forKey: "slateShelf") : nil }
    static var sheet: String? { isOn ? defaults.string(forKey: "slateSheet") : nil }
    static var format: String? { isOn ? defaults.string(forKey: "slateFormat") : nil }
    static var moveShelf: Int? {
        isOn && defaults.object(forKey: "slateMoveShelf") != nil ? defaults.integer(forKey: "slateMoveShelf") : nil
    }
    static var failsReorder: Bool { defaults.bool(forKey: "slateFailReorder") }
    static let liquidSlowdown: Double = {
        let value = defaults.double(forKey: "slateSlowLiquid")
        return isOn && value > 1 ? value : 1
    }()

    static let profile = SlateProfile(
        id: "preview",
        username: "preview",
        displayName: "Preview Person",
        avatarUrl: nil,
        isPublic: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z"
    )

    private static let posters = [
        "1pdfLvkbY9ohJlCjQH2CZjjYVvJ", "pPHpeI2X1qEd1CS1SeyrdhZ4qnT", "lqoMzCcZYEFK729d6qzt349fB4o",
        "7O4iVfOMQmdCSxhOg1WnzG1AgYT", "dmo6TYuuJgaYinXBPjrgG9mB5od", "k3waqVXSnvCZWfJYNtdamTgTtTA",
        "c15BtJxCXMrISLVmysdsnZUPQft", "kCGlIMHnOm8JPXq3rXM6c5wMxcT", "zYqVTiHK5ZajYcNzAW7qWte5NWS",
        "8Gxv8gSFCU0XGDykEGv7zR1n2ua", "vYEyxF1UT779RiEalpMjUT6kfdf", "3bhkrj58Vtu7enYsRolD1fZdja1",
        "gbSaK9v1CbcYH1ISgbM7XObD2dW", "sWgBv7LV2PRoQgkxwlibdGXKz1S", "dnpatlJrEPiDSn5fzgzvxtiSnMo",
        "z0XiwdrCQ9yVIr4O0pxzaAYRxdW", "abf8tHznhSvl9BAElD2cQeRr7do", "zjg4jpK1Wp2kiRvtt5ND0kznako",
        "khZqmwHQicTYoS7Flreb9EddFZC", "hlLXt2tOPT6RRnjiUmoxyG1LTFi", "hTP1DtLGFamjfu8WqjnuQdP1n4i",
        "25ih0Xq2zWbxhhKxwhvswKYQyEr", "u68AjlvlutfEIcpmbYpKcdi09ut", "ztkUQFLlC19CCMYHW9o1zWhJRNq",
    ]

    private static let genres = [
        Genre(id: 18, name: "Drama"), Genre(id: 878, name: "Science Fiction"), Genre(id: 35, name: "Comedy"),
        Genre(id: 10759, name: "Action & Adventure"), Genre(id: 53, name: "Thriller"), Genre(id: 16, name: "Animation"),
    ]

    static var titles: [SlateTitle] {
        let wanted = defaults.object(forKey: "slateCount") != nil ? defaults.integer(forKey: "slateCount") : 21
        return (0..<max(0, min(wanted, posters.count))).map { index in
            let status: LibraryStatus = [.want, .watching, .watched][index % 3]
            return SlateTitle(
                id: "preview-\(index)",
                tmdbId: 1000 + index,
                mediaType: index % 2 == 0 ? .movie : .tv,
                title: "Preview title \(index + 1)",
                originalTitle: nil,
                overview: "A made-up title for checking layouts.",
                posterPath: "/\(posters[index]).jpg",
                backdropPath: nil,
                releaseDate: "\(1996 + index * 3 % 30)-05-01",
                runtime: 96 + index,
                genres: [genres[index % 2], genres[(index / 2) % genres.count]],
                status: status,
                rating: status == .watched ? Double(index % 3 + 1) : nil,
                review: nil,
                favorite: false,
                addedAt: "2026-10-\(String(format: "%02d", index + 1))T00:00:00Z",
                watchedAt: nil,
                updatedAt: "2026-10-01T00:00:00Z",
                position: index,
                tmdbRating: 6 + Double(index % 4),
                tmdbVoteCount: 100,
                imdbId: nil,
                imdbRating: 6.1 + Double(index % 5) * 0.6,
                imdbVotes: nil,
                rottenTomatoesScore: nil,
                metacriticScore: nil,
                currentSeason: nil,
                currentEpisode: nil,
                seasons: nil
            )
        }
    }

    static var newEpisodes: [NewEpisode] {
        let today = Date()
        let format = DateFormatter()
        format.dateFormat = "yyyy-MM-dd"
        return titles.filter { $0.status == .watching }.prefix(3).enumerated().map { index, title in
            NewEpisode(
                titleId: title.id,
                title: title.title,
                posterPath: title.posterPath,
                season: 5 - index,
                episode: 3 + index,
                episodeName: "Preview",
                airDate: format.string(from: today.addingTimeInterval(-Double(index * 3) * 86_400))
            )
        }
    }

    static var rails: [DiscoverRail] {
        ["Because of what you watched", "Trending this week", "In cinemas now", "On Netflix"]
            .enumerated().map { rail, name in
                DiscoverRail(
                    id: "rail-\(rail)",
                    title: name,
                    items: (0..<10).map { index in
                        DiscoverRailItem(
                            tmdbId: rail * 100 + index,
                            mediaType: .movie,
                            title: "Rail title \(index + 1)",
                            posterPath: "/\(posters[(rail * 5 + index) % posters.count]).jpg",
                            releaseDate: nil,
                            saved: index == 1
                        )
                    }
                )
            }
    }

    static var curatedList: CuratedList {
        CuratedList(
            slug: "preview",
            name: "7 for 007",
            description: "Seven films to watch before the next Bond is cast, in the order we would watch them.",
            curator: "Slate",
            titles: rails[0].items + rails[1].items.prefix(3)
        )
    }

    static var linkResolution: SharedLinkResolution {
        SharedLinkResolution(
            source: SharedLinkSource(url: "https://example.com", hostname: "example.com", title: "The best films of the year"),
            candidates: (0..<7).map { index in
                SharedLinkCandidate(
                    tmdbId: 500 + index,
                    mediaType: .movie,
                    title: "Found title \(index + 1)",
                    year: "2025",
                    posterPath: "/\(posters[index + 6]).jpg",
                    overview: nil,
                    voteAverage: nil,
                    sourceTitle: "example.com",
                    inLibrary: index == 2
                )
            },
            warning: nil
        )
    }
}
#endif
