import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showSearch = false
    @State private var showProfile = false

    var body: some View {
        TabView {
            LibraryScreen(status: .want, showSearch: $showSearch, showProfile: $showProfile)
                .tabItem { Label("Watchlist", systemImage: "clock") }
            LibraryScreen(status: .watching, showSearch: $showSearch, showProfile: $showProfile)
                .tabItem { Label("Watching", systemImage: "eye") }
            LibraryScreen(status: .watched, showSearch: $showSearch, showProfile: $showProfile)
                .tabItem { Label("Watched", systemImage: "checkmark") }
            ListsScreen(showProfile: $showProfile)
                .tabItem { Label("Lists", systemImage: "square.3.layers.3d") }
            ImportRecommendationsView(initialText: nil, showProfile: $showProfile)
                .tabItem { Label("Import", systemImage: "square.and.arrow.down") }
        }
        .tint(Color(red: 0.58, green: 0.43, blue: 0.96))
        .sheet(isPresented: $showSearch) { SearchView() }
        .sheet(isPresented: $showProfile) { ProfileView() }
        .sheet(
            isPresented: Binding(
                get: { model.inboundSharedText != nil },
                set: { if !$0 { model.inboundSharedText = nil } }
            )
        ) {
            ImportRecommendationsView(
                initialText: model.inboundSharedText,
                showProfile: .constant(false)
            )
        }
    }
}

private struct LibraryScreen: View {
    @EnvironmentObject private var model: AppModel
    let status: LibraryStatus
    @Binding var showSearch: Bool
    @Binding var showProfile: Bool
    @State private var ordered: [SlateTitle] = []
    @State private var dragging: SlateTitle?
    @State private var mediaFilter = "all"
    @State private var genreFilter = "all"
    @State private var yearFilter = "all"
    @State private var sentimentFilter = "all"
    @State private var sort = "order"

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LibraryFilters(
                    titles: ordered,
                    status: status,
                    media: $mediaFilter,
                    genre: $genreFilter,
                    year: $yearFilter,
                    sentiment: $sentimentFilter,
                    sort: $sort
                )
                .padding(.bottom, 24)

                if visibleTitles.isEmpty {
                    ContentUnavailableView(
                        ordered.isEmpty && status == .want ? "Your watchlist is empty" : "No matching titles",
                        systemImage: status == .watched ? "checkmark.circle" : "film",
                        description: Text(ordered.isEmpty ? "Search and save a title to see it here." : "Try clearing a filter.")
                    )
                    .padding(.top, 80)
                } else {
                    LazyVGrid(columns: columns, spacing: 24) {
                        ForEach(visibleTitles) { title in
                            if sort == "order" {
                                NavigationLink {
                                    TitleDetailView(title: title)
                                } label: {
                                    PosterCard(title: title)
                                        .opacity(dragging?.id == title.id ? 0.3 : 1)
                                        .scaleEffect(dragging?.id == title.id ? 0.97 : 1)
                                }
                                .buttonStyle(.plain)
                                .onDrag {
                                    dragging = title
                                    return NSItemProvider(object: title.id as NSString)
                                } preview: {
                                    PosterDragPreview(title: title)
                                }
                                .onDrop(
                                    of: [UTType.text],
                                    delegate: PosterReorderDelegate(
                                        target: title,
                                        items: $ordered,
                                        dragging: $dragging,
                                        onCommit: commitOrder
                                    )
                                )
                            } else {
                                NavigationLink { TitleDetailView(title: title) } label: { PosterCard(title: title) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 24)
                    .animation(.smooth(duration: 0.22), value: ordered.map(\.id))
                }
            }
            .refreshable { await model.refreshLibrary() }
            .navigationTitle(status.label)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ProfileAvatarButton(profile: model.profile, data: model.avatarData) { showProfile = true }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSearch = true } label: { Image(systemName: "magnifyingglass") }
                        .accessibilityLabel("Search")
                }
            }
            .onAppear { sync() }
            .onChange(of: model.titles) { _, _ in if dragging == nil { sync() } }
        }
    }

    private func sync() {
        ordered = model.titles(in: status)
    }

    private var visibleTitles: [SlateTitle] {
        let filtered = ordered.filter { title in
            (mediaFilter == "all" || title.mediaType.rawValue == mediaFilter) &&
            (genreFilter == "all" || title.genres?.contains(where: { $0.name == genreFilter }) == true) &&
            (yearFilter == "all" || title.year == yearFilter) &&
            (sentimentFilter == "all" || String(Int(title.rating ?? 0)) == sentimentFilter)
        }
        switch sort {
        case "new": return filtered.sorted { $0.addedAt > $1.addedAt }
        case "imdb": return filtered.sorted { ($0.imdbRating ?? -1) > ($1.imdbRating ?? -1) }
        case "year": return filtered.sorted { ($0.releaseDate ?? "") > ($1.releaseDate ?? "") }
        default: return filtered
        }
    }

    private func commitOrder(_ values: [SlateTitle]) {
        Task {
            do { try await model.reorder(status: status, titles: values) }
            catch { model.presentedError = error.localizedDescription; sync() }
        }
    }
}

private struct LibraryFilters: View {
    let titles: [SlateTitle]
    let status: LibraryStatus
    @Binding var media: String
    @Binding var genre: String
    @Binding var year: String
    @Binding var sentiment: String
    @Binding var sort: String
    @Namespace private var mediaSelection

    private var genres: [String] { Array(Set(titles.flatMap { ($0.genres ?? []).map(\.name) })).sorted() }
    private var years: [String] { Array(Set(titles.compactMap(\.year))).sorted(by: >) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 0) {
                mediaOption("All", value: "all")
                mediaOption("Films", value: "movie")
                mediaOption("Series", value: "tv")
            }
            .padding(4)
            .background(.white.opacity(0.055), in: .rect(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(.white.opacity(0.08), lineWidth: 0.7)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    Menu {
                        Button("All genres") { genre = "all" }
                        ForEach(genres, id: \.self) { value in Button(value) { genre = value } }
                    } label: { FilterChip(genre == "all" ? "Genre" : genre, active: genre != "all") }

                    Menu {
                        Button("Any year") { year = "all" }
                        ForEach(years, id: \.self) { value in Button(value) { year = value } }
                    } label: { FilterChip(year == "all" ? "Any year" : year, active: year != "all") }

                    if status == .watched {
                        Menu {
                            Button("Any sentiment") { sentiment = "all" }
                            Button("Love") { sentiment = "3" }
                            Button("Like") { sentiment = "2" }
                            Button("Dislike") { sentiment = "1" }
                        } label: {
                            FilterChip(sentiment == "all" ? "Sentiment" : sentiment == "3" ? "Love" : sentiment == "2" ? "Like" : "Dislike", active: sentiment != "all")
                        }
                    }

                    Menu {
                        Button("Your order") { sort = "order" }
                        Button("Recently added") { sort = "new" }
                        Button("IMDb rating") { sort = "imdb" }
                        Button("Release year") { sort = "year" }
                    } label: {
                        FilterChip(sort == "order" ? "Your order" : sort == "new" ? "Recently added" : sort == "imdb" ? "IMDb rating" : "Release year", active: sort != "order")
                    }
                }
            }
        }
        .padding(.horizontal, 18)
    }

    private func mediaOption(_ label: String, value: String) -> some View {
        Button {
            withAnimation(.smooth(duration: 0.22)) { media = value }
        } label: {
            Text(label)
                .font(.body.weight(.semibold))
                .foregroundStyle(media == value ? Color.black : .secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background {
                    if media == value {
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color(red: 0.58, green: 0.43, blue: 0.96))
                            .matchedGeometryEffect(id: "media-selection", in: mediaSelection)
                    }
                }
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(media == value ? .isSelected : [])
    }
}

private struct FilterChip: View {
    let label: String
    let active: Bool
    init(_ label: String, active: Bool) { self.label = label; self.active = active }
    var body: some View {
        HStack(spacing: 7) {
            Text(label).lineLimit(1)
            Image(systemName: "chevron.down").font(.caption2.bold())
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(active ? Color.black : .secondary)
        .padding(.horizontal, 14).frame(height: 38)
        .background(active ? Color(red: 0.66, green: 0.52, blue: 1) : .white.opacity(0.055), in: .capsule)
        .overlay { Capsule().stroke(.white.opacity(active ? 0 : 0.1), lineWidth: 0.7) }
    }
}

struct PosterCard: View {
    let title: SlateTitle

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ZStack {
                AsyncImage(url: title.posterURL, transaction: .init(animation: .smooth)) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill()
                    case .failure: posterPlaceholder
                    default: posterPlaceholder.overlay { ProgressView().tint(.white.opacity(0.65)) }
                    }
                }
                .aspectRatio(2 / 3, contentMode: .fit)
                .clipShape(.rect(cornerRadius: 15))
                .overlay { RoundedRectangle(cornerRadius: 15).stroke(.white.opacity(0.11), lineWidth: 0.7) }

                VStack {
                    HStack {
                        if title.imdbRating != nil || title.rottenTomatoesScore != nil || title.metacriticScore != nil {
                            HStack(spacing: 5) {
                                if let imdb = title.imdbRating {
                                    Text("IMDb").fontWeight(.bold)
                                    Text(String(format: "%.1f", imdb))
                                }
                                if let rt = title.rottenTomatoesScore { Text("· \(rt)%") }
                                else if let mc = title.metacriticScore { Text("· \(mc)") }
                            }
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8).frame(height: 24)
                            .background(.black.opacity(0.62), in: .capsule)
                        }
                        Spacer()
                    }
                    Spacer()
                    HStack {
                        Spacer()
                        if let rating = title.rating {
                            Image(systemName: rating == 3 ? "heart.fill" : rating == 2 ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                                .font(.caption.bold())
                                .foregroundStyle(rating == 3 ? .pink : rating == 2 ? .green : .orange)
                                .padding(8).background(.black.opacity(0.58), in: .circle)
                        }
                    }
                }
                .padding(9)
            }

            Text(title.title)
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            HStack(spacing: 6) {
                if let year = title.year { Text(year) }
                if let genre = title.genres?.first?.name {
                    if title.year != nil { Text("·") }
                    Text(genre).lineLimit(1)
                }
            }
            .font(.subheadline.monospaced()).foregroundStyle(.secondary)
        }
        .contentShape(.rect)
    }

    private var posterPlaceholder: some View {
        Rectangle().fill(Color.white.opacity(0.06)).overlay {
            Image(systemName: "film").font(.title2).foregroundStyle(.tertiary)
        }
    }
}

struct PosterDragPreview: View {
    let title: SlateTitle
    var body: some View {
        AsyncImage(url: title.posterURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Color(white: 0.1)
        }
        .frame(width: 150, height: 225)
        .clipShape(.rect(cornerRadius: 16))
        .shadow(color: .black.opacity(0.5), radius: 24, y: 12)
    }
}

struct PosterReorderDelegate: DropDelegate {
    let target: SlateTitle
    @Binding var items: [SlateTitle]
    @Binding var dragging: SlateTitle?
    let onCommit: ([SlateTitle]) -> Void

    func dropEntered(info: DropInfo) {
        guard let dragging, dragging.id != target.id,
              let from = items.firstIndex(where: { $0.id == dragging.id }),
              let to = items.firstIndex(where: { $0.id == target.id }) else { return }
        withAnimation(.smooth(duration: 0.18)) {
            items.move(fromOffsets: IndexSet(integer: from), toOffset: to > from ? to + 1 : to)
        }
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        dragging = nil
        onCommit(items)
        return true
    }

    func dropExited(info: DropInfo) {}
}

struct ProfileAvatarButton: View {
    let profile: SlateProfile?
    let data: Data?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if let data, let image = UIImage(data: data) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    AsyncImage(url: profile?.avatarUrl) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Circle().fill(.white.opacity(0.1)).overlay {
                            Text(initials).font(.caption2.bold()).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .frame(width: 30, height: 30)
            .clipShape(.circle)
            .overlay { Circle().stroke(.white.opacity(0.15), lineWidth: 0.7) }
        }
        .accessibilityLabel("Profile")
    }

    private var initials: String {
        (profile?.displayName ?? "S").split(separator: " ").prefix(2)
            .compactMap(\.first).map(String.init).joined().uppercased()
    }
}
