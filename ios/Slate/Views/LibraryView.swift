import SwiftUI
import UniformTypeIdentifiers

/// The shelves of the Library's selector, in the web's order and wording.
enum Shelf: Int, CaseIterable, Identifiable, Hashable {
    case all
    case upNext
    case watching
    case watched

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .upNext: "Up Next"
        case .watching: "Watching"
        case .watched: "Watched"
        }
    }

    var status: LibraryStatus? {
        switch self {
        case .all: nil
        case .upNext: .want
        case .watching: .watching
        case .watched: .watched
        }
    }
}

/// What the Filters sheet holds. Format, genre, year and reaction are filters;
/// the order is not, so Clear all leaves it (and the shelf) alone.
struct LibraryFilters: Hashable {
    var format = ""
    var genre = ""
    var year = ""
    var reaction = ""
    var sort = ""

    var activeCount: Int {
        [format, genre, year, reaction].filter { !$0.isEmpty }.count
    }

    func cleared() -> LibraryFilters {
        LibraryFilters(sort: sort)
    }
}

private struct FilterOption: Identifiable, Hashable {
    let value: String
    let label: String
    var icon: String?
    var id: String { value }
}

private let formatOptions = [
    FilterOption(value: "", label: "All", icon: "square.stack"),
    FilterOption(value: "movie", label: "Films", icon: "film"),
    FilterOption(value: "tv", label: "Series", icon: "tv"),
]
private let yearOptions = [
    FilterOption(value: "", label: "Any"),
    FilterOption(value: "2020s", label: "2020s"),
    FilterOption(value: "2010s", label: "2010s"),
    FilterOption(value: "2000s", label: "2000s"),
    FilterOption(value: "older", label: "Older"),
]
private let reactionOptions = [
    FilterOption(value: "", label: "All"),
    FilterOption(value: "loved", label: "Loved", icon: "heart"),
    FilterOption(value: "liked", label: "Liked", icon: "hand.thumbsup"),
    FilterOption(value: "disliked", label: "Disliked", icon: "hand.thumbsdown"),
]

private func sortOptions(shelf: Shelf, hasDates: Bool) -> [FilterOption] {
    var options = [
        FilterOption(value: "", label: "Your order"),
        FilterOption(value: "recent", label: shelf == .watched ? "Recently watched" : "Recently added"),
        FilterOption(value: "rating", label: "Highest rated"),
    ]
    if hasDates { options.append(FilterOption(value: "year", label: "Newest release")) }
    return options
}

private func decade(_ year: String) -> Range<Int>? {
    switch year {
    case "2020s": 2020..<2030
    case "2010s": 2010..<2020
    case "2000s": 2000..<2010
    case "older": 0..<2000
    default: nil
    }
}

private extension SlateTitle {
    var releaseYear: Int? { releaseDate.flatMap { Int($0.prefix(4)) } }

    func recentKey(watchedShelf: Bool) -> String {
        if watchedShelf, status == .watched, let watchedAt { return watchedAt }
        return addedAt
    }
}

private func shelfOrder(_ titles: [SlateTitle], watchedShelf: Bool) -> [SlateTitle] {
    titles.sorted {
        if $0.position != $1.position { return $0.position < $1.position }
        return $0.recentKey(watchedShelf: watchedShelf) > $1.recentKey(watchedShelf: watchedShelf)
    }
}

/// All shelves together: one from each in turn, so no shelf buries the others.
private func interleaveShelves(_ all: [SlateTitle]) -> [SlateTitle] {
    let shelves = [LibraryStatus.want, .watching, .watched].map { status in
        shelfOrder(all.filter { $0.status == status }, watchedShelf: false)
    }
    let longest = shelves.map(\.count).max() ?? 0
    var result: [SlateTitle] = []
    result.reserveCapacity(all.count)
    for index in 0..<longest {
        for shelf in shelves where index < shelf.count { result.append(shelf[index]) }
    }
    return result
}

/// The web's `filterAndSort` (lib/filter-utils.ts), on the phone's own models.
func filterAndSort(_ all: [SlateTitle], shelf: Shelf, filters: LibraryFilters) -> [SlateTitle] {
    let scoped: [SlateTitle]
    if let status = shelf.status {
        scoped = shelfOrder(all.filter { $0.status == status }, watchedShelf: shelf == .watched)
    } else {
        scoped = interleaveShelves(all)
    }

    let reaction = shelf == .watched ? filters.reaction : ""
    let wantedRating: Int? = switch reaction {
    case "loved": 3
    case "liked": 2
    case "disliked": 1
    default: nil
    }
    let genreId = Int(filters.genre)
    let years = decade(filters.year)

    let filtered = scoped.filter { title in
        (filters.format.isEmpty || title.mediaType.rawValue == filters.format)
            && (wantedRating == nil || title.rating.map { Int($0) } == wantedRating)
            && (genreId == nil || (title.genres ?? []).contains { $0.id == genreId })
            && (years == nil || title.releaseYear.map { years!.contains($0) } == true)
    }

    // Sorting keeps the shelf's order between equals.
    func stable(_ ahead: (SlateTitle, SlateTitle) -> Bool) -> [SlateTitle] {
        filtered.enumerated().sorted { left, right in
            if ahead(left.element, right.element) { return true }
            if ahead(right.element, left.element) { return false }
            return left.offset < right.offset
        }.map(\.element)
    }
    switch filters.sort {
    case "recent":
        let watched = shelf == .watched || shelf == .all
        return stable { $0.recentKey(watchedShelf: watched) > $1.recentKey(watchedShelf: watched) }
    case "rating":
        return stable {
            ($0.imdbRating ?? $0.tmdbRating ?? -.infinity) > ($1.imdbRating ?? $1.tmdbRating ?? -.infinity)
        }
    case "year":
        return stable { ($0.releaseYear ?? .min) > ($1.releaseYear ?? .min) }
    default:
        return filtered
    }
}

func extractGenres(_ all: [SlateTitle]) -> [Genre] {
    var seen = Set<Int>()
    return all.flatMap { $0.genres ?? [] }
        .filter { seen.insert($0.id).inserted }
        .sorted { $0.name < $1.name }
}

/// The Library: every shelf behind one selector, every filter behind one button.
struct LibraryScreen: View {
    @EnvironmentObject private var model: AppModel
    @Binding var shelf: Shelf
    @Binding var filters: LibraryFilters
    let onAdd: () -> Void
    let onAddFromLink: () -> Void

    #if DEBUG
    @State private var sheetOpen = SlatePreview.sheet == "filters"
    @State private var previewDetail = SlatePreview.sheet == "detail"
    #else
    @State private var sheetOpen = false
    #endif
    @State private var dragging: SlateTitle?
    /// The order on screen while a poster is being moved and until the server
    /// has it.
    @State private var moved: [SlateTitle]?
    /// SwiftUI asks for the drag item once more just after a drop; that
    /// second call must not start a new move.
    @State private var lastDrop = Date.distantPast

    private struct GridKey: Hashable {
        let shelf: Shelf
        let filters: LibraryFilters
    }

    var body: some View {
        let genres = extractGenres(model.titles)
        // A genre that left the library no longer counts or filters.
        let effective: LibraryFilters = {
            var value = filters
            if !genres.contains(where: { String($0.id) == value.genre }) { value.genre = "" }
            if shelf != .watched { value.reaction = "" }
            return value
        }()
        let visible = filterAndSort(model.titles, shelf: shelf, filters: effective)
        let canReorder = shelf.status != nil && effective.sort.isEmpty && effective.activeCount == 0
        let shown = canReorder ? (moved ?? visible) : visible

        GeometryReader { proxy in
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    LiquidSelector(
                        count: Shelf.allCases.count,
                        selectedIndex: shelf.rawValue,
                        onSelect: { shelf = Shelf.allCases[$0] }
                    ) { index in
                        Text(Shelf.allCases[index].label)
                            .font(.system(size: 12, weight: .medium))
                            .lineLimit(1)
                    }
                    // Fills the row on a phone; on a wide window it stops growing.
                    .frame(maxWidth: 420)
                    .frame(height: 40)
                    .layoutPriority(1)

                    FiltersButton(activeCount: effective.activeCount) { sheetOpen = true }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, SlateMetrics.gutter)
                .padding(.top, 4)
                .padding(.bottom, 12)

                if model.titles.isEmpty {
                    EmptyLibrary(onAdd: onAdd, onAddFromLink: onAddFromLink)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            LibraryNudges(
                                titles: model.titles,
                                newEpisodes: model.newEpisodes,
                                hasLists: !model.lists.isEmpty,
                                onAdd: onAdd,
                                onAddFromLink: onAddFromLink
                            )

                            if shown.isEmpty {
                                SlateEmptyMessage(
                                    title: "No titles match",
                                    message: "Try another shelf or clear a filter."
                                )
                                .padding(.top, 72)
                            } else {
                                grid(shown, width: proxy.size.width, reorderable: canReorder)
                            }
                        }
                        .padding(.horizontal, SlateMetrics.gutter)
                        .padding(.bottom, 16)
                        .slateArrive(on: GridKey(shelf: shelf, filters: effective))
                    }
                    .refreshable { await model.refreshLibrary() }
                }
            }
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        #if DEBUG
        .navigationDestination(isPresented: $previewDetail) {
            if let first = model.titles.first { TitleDetailView(title: first) }
        }
        #endif
        .onChange(of: canReorder) { _, allowed in
            if !allowed { moved = nil; dragging = nil }
        }
        .sheet(isPresented: $sheetOpen) {
            FilterPanel(
                shelf: shelf,
                filters: effective,
                genres: genres,
                hasDates: model.titles.contains { $0.releaseDate != nil },
                resultCount: visible.count,
                onChange: { filters = $0 },
                onDone: { sheetOpen = false }
            )
            .presentationDetents([.fraction(0.78), .large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(24)
            .presentationBackground(SlatePalette.surface)
            .preferredColorScheme(.dark)
        }
    }

    private func grid(_ titles: [SlateTitle], width: CGFloat, reorderable: Bool) -> some View {
        LazyVGrid(columns: SlateMetrics.posterColumns(for: width), spacing: SlateMetrics.posterGap) {
            ForEach(titles) { title in
                let link = NavigationLink {
                    TitleDetailView(title: title)
                } label: {
                    PosterTile(title: title)
                        .opacity(dragging?.id == title.id ? 0.3 : 1)
                }
                .buttonStyle(SlatePressStyle())

                if reorderable {
                    link
                        .onDrag {
                            if Date().timeIntervalSince(lastDrop) > 1.5 {
                                if moved == nil { moved = titles }
                                dragging = title
                            }
                            return NSItemProvider(object: title.id as NSString)
                        } preview: {
                            PosterDragPreview(title: title)
                        }
                        .onDrop(
                            of: [UTType.text],
                            delegate: PosterReorderDelegate(
                                target: title,
                                items: Binding(get: { moved ?? titles }, set: { moved = $0 }),
                                dragging: $dragging,
                                onCommit: commitOrder
                            )
                        )
                } else {
                    link
                }
            }
        }
        .animation(.smooth(duration: 0.22), value: titles.map(\.id))
    }

    private func commitOrder(_ values: [SlateTitle]) {
        lastDrop = Date()
        dragging = nil
        guard let status = shelf.status else { moved = nil; return }
        Task {
            do { try await model.reorder(status: status, titles: values) }
            catch { model.presentedError = error.localizedDescription }
            moved = nil
            dragging = nil
        }
    }
}

/// One button for every filter. It turns to the theme colour and counts them
/// once any is set.
private struct FiltersButton: View {
    let activeCount: Int
    let action: () -> Void

    var body: some View {
        let on = activeCount > 0
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 14, weight: .medium))
                if on {
                    Text("\(activeCount)").font(.system(size: 12, weight: .medium))
                }
            }
            .foregroundStyle(on ? SlatePalette.accent : SlatePalette.mutedText)
            .padding(.horizontal, 12)
            .frame(minWidth: 40)
            .frame(height: 40)
            .background(on ? SlatePalette.accent.opacity(0.12) : SlatePalette.fill, in: .capsule)
            .overlay {
                Capsule().stroke(on ? SlatePalette.accent.opacity(0.4) : SlatePalette.border, lineWidth: 1)
            }
            .contentShape(.capsule)
        }
        .buttonStyle(SlatePressStyle())
        .fixedSize()
        .accessibilityLabel(on ? "Filters, \(activeCount) applied" : "Filters")
    }
}

/// What the Filters sheet holds.
private struct FilterPanel: View {
    let shelf: Shelf
    let filters: LibraryFilters
    let genres: [Genre]
    let hasDates: Bool
    let resultCount: Int
    let onChange: (LibraryFilters) -> Void
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Filters")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                if filters.activeCount > 0 {
                    Button("Clear all") { onChange(filters.cleared()) }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(SlatePalette.mutedText)
                        .frame(height: 44)
                        .buttonStyle(SlatePressStyle())
                }
            }
            .frame(height: 44)
            .padding(.top, 14)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    section("Format") {
                        segmented(formatOptions, value: filters.format) { update(\.format, $0) }
                    }
                    if !genres.isEmpty {
                        section("Genre") {
                            FlowLayout(spacing: 6) {
                                GenreChip(label: "All", active: filters.genre.isEmpty) { update(\.genre, "") }
                                ForEach(genres, id: \.id) { genre in
                                    let id = String(genre.id)
                                    GenreChip(label: genre.name, active: filters.genre == id) { update(\.genre, id) }
                                }
                            }
                        }
                    }
                    section("Year") {
                        segmented(yearOptions, value: filters.year) { update(\.year, $0) }
                    }
                    if shelf == .watched {
                        section("Reaction") {
                            segmented(reactionOptions, value: filters.reaction) { update(\.reaction, $0) }
                        }
                    }
                    section("Sort by") {
                        VStack(spacing: 2) {
                            ForEach(sortOptions(shelf: shelf, hasDates: hasDates)) { option in
                                SortRow(label: option.label, active: option.value == filters.sort) {
                                    update(\.sort, option.value)
                                }
                            }
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            .scrollIndicators(.hidden)

            SlatePrimaryButton(
                resultCount == 0 ? "No titles match"
                    : resultCount == 1 ? "Show 1 title"
                    : "Show \(resultCount) titles",
                action: onDone
            )
            .padding(.top, 12)
            .padding(.bottom, 12)
        }
        .padding(.horizontal, SlateMetrics.gutter)
    }

    private func update(_ path: WritableKeyPath<LibraryFilters, String>, _ value: String) {
        var next = filters
        next[keyPath: path] = value
        onChange(next)
    }

    private func section<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(SlatePalette.mutedText)
                .padding(.horizontal, 4)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func segmented(
        _ options: [FilterOption],
        value: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        LiquidSelector(
            count: options.count,
            selectedIndex: options.firstIndex { $0.value == value } ?? 0,
            onSelect: { onSelect(options[$0].value) }
        ) { index in
            let option = options[index]
            HStack(spacing: 6) {
                // Icons give way first when four or more options share a phone's width.
                if let icon = option.icon, options.count <= 3 {
                    Image(systemName: icon).font(.system(size: 13, weight: .medium))
                }
                Text(option.label)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
            }
        }
        .frame(height: 44)
    }
}

private struct GenreChip: View {
    let label: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .lineLimit(1)
                .foregroundStyle(active ? SlatePalette.accent : SlatePalette.mutedText)
                .padding(.horizontal, 14)
                .frame(height: 40)
                .background(active ? SlatePalette.accent.opacity(0.12) : SlatePalette.fill, in: .capsule)
                .overlay {
                    Capsule().stroke(active ? SlatePalette.accent.opacity(0.4) : SlatePalette.border, lineWidth: 1)
                }
                .contentShape(.capsule)
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

private struct SortRow: View {
    let label: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(label)
                    .font(.system(size: 14, weight: active ? .medium : .regular))
                    .foregroundStyle(active ? .white : SlatePalette.mutedText)
                    .lineLimit(1)
                Spacer()
                if active {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(SlatePalette.accent)
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .contentShape(.rect(cornerRadius: 12))
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

private struct EmptyLibrary: View {
    let onAdd: () -> Void
    let onAddFromLink: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            SlateEmptyMessage(
                title: "Your slate is empty",
                message: "Add the first title you do not want to forget, or bring some over from a link."
            )
            SlatePrimaryButton("Add a title", action: onAdd).padding(.top, 20)
            SlateSecondaryButton("Add from a link", action: onAddFromLink).padding(.top, 8)
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: 320)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
