import SwiftUI

/// One search shared by the top of every screen (`SmartSearchBar` and the
/// command palette on the web): it narrows your slate, finds films, series and
/// people, pulls titles out of a pasted link, and hands a question to Slate.
@MainActor
final class SearchSession: ObservableObject {
    @Published var query = ""
    @Published var isActive = false
    @Published private(set) var payload: CatalogSearchPayload?
    @Published private(set) var loading = false
    /// Bumped to ask the field for the keyboard (the dock's add button).
    @Published private(set) var focusRequest = 0
    @Published var resultsQuery: ResultsQuery?
    @Published var askPrompt: AskPrompt?
    @Published var linkText: String?

    struct ResultsQuery: Identifiable, Hashable { let id = UUID(); let text: String }
    struct AskPrompt: Identifiable { let id = UUID(); let text: String }

    var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// A pasted address: something to pull titles out of, not to search for.
    var looksLikeLink: Bool {
        let value = trimmed.lowercased()
        guard !value.contains(" ") else { return false }
        return value.hasPrefix("http://") || value.hasPrefix("https://") || value.hasPrefix("www.")
            || value.range(of: #"^[a-z0-9-]+(\.[a-z0-9-]+)+/"#, options: .regularExpression) != nil
    }

    func activate() {
        isActive = true
        focusRequest += 1
    }

    func dismiss() {
        isActive = false
        query = ""
        payload = nil
    }

    func showAllResults() {
        guard !trimmed.isEmpty else { return }
        resultsQuery = ResultsQuery(text: trimmed)
        isActive = false
    }

    func ask(_ text: String? = nil) {
        askPrompt = AskPrompt(text: text ?? trimmed)
        isActive = false
    }

    func findInLink() {
        linkText = trimmed
        dismiss()
    }

    func search(with model: AppModel) async {
        let value = trimmed
        guard !value.isEmpty, !looksLikeLink else {
            payload = nil
            loading = false
            return
        }
        loading = true
        do {
            try await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled else { return }
            let result = try await model.search(value)
            guard value == trimmed else { return }
            payload = result
        } catch is CancellationError {
            return
        } catch {
            payload = nil
        }
        loading = false
    }
}

/// The search field at the top of Library, Discover and Lists. Focused, it
/// gains a mint ring and its two actions: ask Slate, and search everything.
struct SmartSearchBar: View {
    @EnvironmentObject private var session: SearchSession
    @EnvironmentObject private var model: AppModel
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(SlatePalette.mutedText)
            TextField(
                "",
                text: $session.query,
                prompt: Text(session.isActive ? "Search titles, people, or ask" : "Search")
                    .foregroundStyle(SlatePalette.mutedText)
            )
            .font(.system(size: 17))
            .foregroundStyle(SlatePalette.text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.search)
            .focused($focused)
            .onSubmit {
                if session.looksLikeLink { session.findInLink() } else { session.showAllResults() }
            }
            .accessibilityLabel("Search your slate, discover titles, or ask Slate")

            if !session.query.isEmpty {
                Button { session.query = "" } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(SlatePalette.mutedText)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
            if session.isActive {
                Button { session.ask() } label: {
                    Image(systemName: "sparkles")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(SlatePalette.mutedText)
                        .frame(width: 36, height: 36)
                        .background(SlatePalette.fill, in: .circle)
                }
                .buttonStyle(SlatePressStyle())
                .disabled(session.trimmed.isEmpty)
                .accessibilityLabel("Ask Slate")
                Button { session.showAllResults() } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(SlatePalette.onAccent)
                        .frame(width: 36, height: 36)
                        .background(SlatePalette.accent, in: .circle)
                }
                .buttonStyle(SlatePressStyle())
                .accessibilityLabel("Search all results")
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, session.isActive ? 4 : 14)
        .frame(height: 44)
        .background(SlatePalette.fill, in: .capsule)
        .overlay {
            Capsule().stroke(
                session.isActive ? SlatePalette.accent.opacity(0.55) : SlatePalette.border,
                lineWidth: session.isActive ? 1.5 : 1
            )
        }
        .contentShape(.capsule)
        .onTapGesture { session.activate() }
        .animation(.smooth(duration: 0.2), value: session.isActive)
        .onChange(of: focused) { _, value in
            if value { session.isActive = true }
        }
        .onChange(of: session.isActive) { _, value in
            if !value { focused = false }
        }
        .onChange(of: session.focusRequest) { _, _ in focused = true }
        .task(id: session.query) { await session.search(with: model) }
    }
}

/// What opens under the field while it is in use: the actions for what was
/// typed, matches on your slate, the person it names, then films and series,
/// each with its own add button.
struct SearchPanel: View {
    @EnvironmentObject private var session: SearchSession
    @EnvironmentObject private var model: AppModel
    let onOpenTitle: (SlateTitle) -> Void
    let onOpenCatalog: (CatalogTitle) -> Void
    let onOpenPerson: (Int) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                if session.trimmed.isEmpty {
                    Text("Find a title, search by cast, describe what you want to watch, or paste a link to pull titles from it.")
                        .font(.system(size: 14))
                        .lineSpacing(3)
                        .foregroundStyle(SlatePalette.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(14)
                } else {
                    if session.looksLikeLink {
                        actionRow("Find movies & shows in this link", icon: "link", accent: true) { session.findInLink() }
                    }
                    actionRow("Search all results for “\(session.trimmed)”", icon: "magnifyingglass") {
                        session.showAllResults()
                    }
                    actionRow("Ask about “\(session.trimmed)”", icon: "sparkles", accent: true) { session.ask() }

                    if !librarymatches.isEmpty {
                        sectionLabel("Your slate")
                        ForEach(librarymatches) { title in
                            Button { onOpenTitle(title) } label: { LibraryResultRow(title: title) }
                                .buttonStyle(SlatePressStyle())
                        }
                    }
                    if let payload = session.payload {
                        if let person = namedPerson(in: payload) {
                            sectionLabel("With \(person.name)")
                            Button { onOpenPerson(person.id) } label: { PersonResultRow(person: person) }
                                .buttonStyle(SlatePressStyle())
                        }
                        if !payload.results.isEmpty {
                            sectionLabel("Movies & shows")
                            ForEach(payload.results.prefix(12)) { title in
                                CatalogResultRow(title: title) { onOpenCatalog(title) }
                            }
                        }
                    } else if session.loading && !session.looksLikeLink {
                        ProgressView()
                            .tint(SlatePalette.mutedText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    }
                }
            }
            .padding(10)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollBounceBehavior(.basedOnSize)
        .background(SlatePalette.surface, in: .rect(cornerRadius: 24))
        .overlay { RoundedRectangle(cornerRadius: 24).stroke(SlatePalette.border, lineWidth: 1) }
        .shadow(color: .black.opacity(0.35), radius: 30, y: 18)
    }

    private var librarymatches: [SlateTitle] {
        let needle = session.trimmed.lowercased()
        guard needle.count >= 2, !session.looksLikeLink else { return [] }
        return model.titles.filter {
            "\($0.title) \($0.originalTitle ?? "")".lowercased().contains(needle)
        }
        .prefix(4)
        .map { $0 }
    }

    /// The person the query names, when it names one (the web's "With …").
    private func namedPerson(in payload: CatalogSearchPayload) -> CatalogPerson? {
        guard let first = payload.people.first else { return nil }
        let needle = session.trimmed.lowercased()
        let name = first.name.lowercased()
        return name.contains(needle) || needle.contains(name) ? first : nil
    }

    private func actionRow(_ label: String, icon: String, accent: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(accent ? SlatePalette.accent : SlatePalette.mutedText)
                    .frame(width: 40, height: 40)
                    .background(accent ? SlatePalette.accent.opacity(0.14) : SlatePalette.fill, in: .rect(cornerRadius: 11))
                Text(label)
                    .font(.system(size: 15))
                    .foregroundStyle(SlatePalette.text)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
            }
            .padding(10)
            .contentShape(.rect)
        }
        .buttonStyle(SlatePressStyle())
    }

    private func sectionLabel(_ text: String) -> some View {
        SlateMonoLabel(text)
            .padding(.horizontal, 12)
            .padding(.top, 14)
            .padding(.bottom, 6)
    }
}

/// The web's small capitals in a monospaced face: shelf and type labels,
/// section names in search.
struct SlateMonoLabel: View {
    let text: String
    var color: Color = SlatePalette.mutedText
    var size: CGFloat = 11

    init(_ text: String, color: Color = SlatePalette.mutedText, size: CGFloat = 11) {
        self.text = text
        self.color = color
        self.size = size
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: size, weight: .regular, design: .monospaced))
            .tracking(size * 0.12)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

private struct LibraryResultRow: View {
    let title: SlateTitle

    var body: some View {
        HStack(spacing: 12) {
            PosterFrame(url: title.posterURL, title: title.title, corner: 7)
                .frame(width: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(title.title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(SlatePalette.text)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    SlateMonoLabel(title.status.label, color: SlatePalette.accent)
                    if let year = title.year { SlateMonoLabel("· \(year)") }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .contentShape(.rect)
    }
}

private struct PersonResultRow: View {
    let person: CatalogPerson

    var body: some View {
        HStack(spacing: 14) {
            CachedAsyncImage(url: person.profileURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                SlatePalette.placeholder
            }
            .frame(width: 44, height: 44)
            .clipShape(.circle)
            VStack(alignment: .leading, spacing: 3) {
                Text(person.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(SlatePalette.text)
                Text(person.knownForDepartment ?? "Person")
                    .font(.system(size: 13))
                    .foregroundStyle(SlatePalette.mutedText)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(SlatePalette.border, lineWidth: 1) }
        .padding(.horizontal, 12)
        .contentShape(.rect)
    }
}

/// A film or series in the panel: poster, name, type, year and score, and the
/// split add button (Up Next, or choose the shelf).
struct CatalogResultRow: View {
    @EnvironmentObject private var model: AppModel
    let title: CatalogTitle
    let onOpen: () -> Void
    @State private var savedStatus: LibraryStatus?
    @State private var adding = false

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onOpen) {
                HStack(spacing: 12) {
                    PosterFrame(url: title.posterURL, title: title.title, corner: 7)
                        .frame(width: 44)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(title.title)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(SlatePalette.text)
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Image(systemName: title.mediaType == .movie ? "film" : "tv")
                                .font(.system(size: 11))
                                .foregroundStyle(SlatePalette.mutedText)
                            SlateMonoLabel(title.mediaType == .movie ? "Movie" : "TV")
                            if let year = title.year { SlateMonoLabel("· \(year)") }
                            if let score = title.tmdbRating, score > 0 {
                                SlateMonoLabel("\(Int((score * 10).rounded()))%")
                            }
                        }
                        .fixedSize()
                    }
                    .layoutPriority(1)
                    Spacer(minLength: 0)
                }
                .contentShape(.rect)
            }
            .buttonStyle(SlatePressStyle())

            addControl
        }
        .padding(8)
    }

    @ViewBuilder
    private var addControl: some View {
        if let status = savedStatus ?? currentStatus {
            HStack(spacing: 5) {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
                Text(status.label).font(.system(size: 13, weight: .medium))
            }
            .foregroundStyle(SlatePalette.accent)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(SlatePalette.accent.opacity(0.12), in: .capsule)
        } else {
            HStack(spacing: 0) {
                Button { add(.want) } label: {
                    HStack(spacing: 5) {
                        Image(systemName: adding ? "ellipsis" : "plus").font(.system(size: 12, weight: .semibold))
                        Text("Up Next").font(.system(size: 13, weight: .medium)).fixedSize()
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 8)
                    .frame(height: 34)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add \(title.title) to Up Next")
                Rectangle().fill(SlatePalette.accent.opacity(0.3)).frame(width: 1, height: 34)
                Menu {
                    Button("Watching") { add(.watching) }
                    Button("Watched") { add(.watched) }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .frame(width: 30, height: 34)
                        .contentShape(.rect)
                }
                .accessibilityLabel("Choose where to add \(title.title)")
            }
            .foregroundStyle(SlatePalette.accent)
            .background(SlatePalette.accent.opacity(0.1), in: .capsule)
            .overlay { Capsule().stroke(SlatePalette.accent.opacity(0.3), lineWidth: 1) }
            .disabled(adding)
        }
    }

    private var currentStatus: LibraryStatus? {
        guard let saved = title.saved else { return nil }
        return model.titles.first(where: { $0.id == saved.id })?.status ?? saved.status
    }

    private func add(_ status: LibraryStatus) {
        adding = true
        Task {
            do {
                _ = try await model.addCatalogTitle(tmdbId: title.tmdbId, mediaType: title.mediaType, status: status)
                savedStatus = status
            } catch {
                model.presentedError = error.localizedDescription
            }
            adding = false
        }
    }
}

/// Every result for a search (`/search` on the web): All, Films or Series,
/// the titles as posters, then people.
struct SearchResultsScreen: View {
    @EnvironmentObject private var model: AppModel
    let query: String
    @State private var payload: CatalogSearchPayload?
    @State private var failed = false
    @State private var format = 0

    private var titles: [CatalogTitle] {
        let all = payload?.results ?? []
        switch format {
        case 1: return all.filter { $0.mediaType == .movie }
        case 2: return all.filter { $0.mediaType == .tv }
        default: return all
        }
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    SlateMonoLabel("Search results")
                    Text(query)
                        .font(.system(size: 30, weight: .bold))
                        .tracking(-0.8)
                        .foregroundStyle(SlatePalette.text)
                        .padding(.top, 8)
                    LiquidSelector(count: 3, selectedIndex: format, onSelect: { format = $0 }) { index in
                        Text(["All", "Films", "Series"][index]).font(.system(size: 14, weight: .medium))
                    }
                    .frame(height: 40)
                    .frame(maxWidth: 300)
                    .padding(.top, 18)

                    if let payload {
                        if payload.approximate, let approximate = payload.approximateQuery {
                            Text("Showing close matches for “\(approximate)”")
                                .font(.system(size: 13))
                                .foregroundStyle(SlatePalette.mutedText)
                                .padding(.top, 14)
                        }
                        if titles.isEmpty && payload.people.isEmpty {
                            SlateEmptyMessage(title: "No results", message: "Try another spelling, or ask Slate instead.")
                                .padding(.top, 60)
                        }
                        if !titles.isEmpty {
                            Text("Movies & TV")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(SlatePalette.text)
                                .padding(.top, 26)
                                .padding(.bottom, 12)
                            LazyVGrid(columns: SlateMetrics.posterColumns(for: proxy.size.width), spacing: 18) {
                                ForEach(titles) { title in
                                    NavigationLink {
                                        CatalogDestination(title: title)
                                    } label: {
                                        LabeledPoster(
                                            url: title.posterURL,
                                            title: title.title,
                                            leading: nil,
                                            trailing: title.year,
                                            saved: title.saved != nil
                                        )
                                    }
                                    .buttonStyle(SlatePressStyle())
                                }
                            }
                        }
                        if !payload.people.isEmpty && format == 0 {
                            Text("People")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(SlatePalette.text)
                                .padding(.top, 30)
                                .padding(.bottom, 4)
                            ForEach(payload.people) { person in
                                NavigationLink { PersonView(personId: person.id) } label: {
                                    PersonResultRow(person: person).padding(.horizontal, -12)
                                }
                                .buttonStyle(SlatePressStyle())
                                .padding(.vertical, 4)
                            }
                        }
                    } else if failed {
                        SlateEmptyMessage(title: "Search didn't load", message: "Check your connection and try again.")
                            .padding(.top, 60)
                    } else {
                        ProgressView().tint(SlatePalette.mutedText).frame(maxWidth: .infinity).padding(.top, 80)
                    }
                }
                .padding(.horizontal, SlateMetrics.gutter)
                .padding(.top, 12)
                .padding(.bottom, 120)
            }
        }
        .background(SlatePalette.background)
        .slateArrive(on: format)
        .task {
            do { payload = try await model.search(query) } catch { failed = true }
        }
    }
}

/// A catalogue title opens as your own title page once it is on your slate.
struct CatalogDestination: View {
    @EnvironmentObject private var model: AppModel
    let title: CatalogTitle

    var body: some View {
        if let saved = title.saved, let libraryTitle = model.titles.first(where: { $0.id == saved.id }) {
            TitleDetailView(title: libraryTitle)
        } else {
            DiscoverTitleView(mediaType: title.mediaType, tmdbId: title.tmdbId)
        }
    }
}

/// A poster with its name under it and a line of small capitals (the shelf or
/// the type on the left, the year on the right), as every web grid shows them.
struct LabeledPoster: View {
    let url: URL?
    let title: String
    let leading: String?
    var leadingColor: Color = SlatePalette.mutedText
    let trailing: String?
    var saved = false
    var badge: AnyView?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PosterFrame(url: url, title: title) {
                ZStack {
                    if saved {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(SlatePalette.onAccent)
                            .frame(width: 20, height: 20)
                            .background(SlatePalette.accent, in: .circle)
                            .padding(6)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    }
                    badge
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: SlateMetrics.posterCorner)
                    .stroke(SlatePalette.text.opacity(0.08), lineWidth: 1)
            }
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(SlatePalette.text)
                .lineLimit(1)
                .padding(.horizontal, 2)
            HStack(spacing: 4) {
                if let leading { SlateMonoLabel(leading, color: leadingColor, size: 9.5) }
                Spacer(minLength: 0)
                if let trailing { SlateMonoLabel(trailing, color: SlatePalette.mutedText.opacity(0.8), size: 9.5) }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .combine)
    }
}
