import SwiftUI

struct TitleDetailView: View {
    private enum PresentedSheet: String, Identifiable {
        case note
        case providers
        case lists
        var id: String { rawValue }
    }

    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    let title: SlateTitle

    @State private var detail: TitleDetailPayload?
    @State private var loading = true
    @State private var presentedSheet: PresentedSheet?
    @State private var showRemoveConfirmation = false
    @State private var errorMessage: String?

    private var currentTitle: SlateTitle { detail?.title ?? title }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            backdrop

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Color.clear.frame(height: 300)
                    metadata
                    Text(currentTitle.title)
                        .font(.system(size: 38, weight: .bold))
                        .tracking(-1.7)
                        .padding(.top, 8)

                    actions
                        .padding(.top, 22)

                    if let overview = currentTitle.overview, !overview.isEmpty {
                        Text(overview)
                            .font(.system(size: 16))
                            .foregroundStyle(.white.opacity(0.82))
                            .lineSpacing(5)
                            .padding(.top, 24)
                    }

                    if let review = currentTitle.review, !review.isEmpty {
                        noteCard(review)
                            .padding(.top, 30)
                    }

                    if loading {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 70)
                    } else if let detail {
                        peopleSection(title: "Cast", people: detail.cast)
                        peopleSection(title: "Crew", people: detail.crew)
                        recommendationsSection(detail.recommendations)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 56)
            }
        }
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task(id: title.id) { await load() }
        .sheet(item: $presentedSheet) { sheet in
            switch sheet {
            case .note:
                NoteEditorSheet(
                    title: currentTitle.title,
                    initialValue: currentTitle.review ?? "",
                    onSave: saveReview
                )
                .presentationDetents([.medium, .large])
                .presentationBackground(.ultraThinMaterial)
            case .providers:
                ProviderPickerSheet(
                    titleName: currentTitle.title,
                    providers: detail?.watchProviders
                )
                .presentationDetents([.medium, .large])
                .presentationBackground(.ultraThinMaterial)
            case .lists:
                ListPickerSheet(
                    lists: detail?.lists ?? [],
                    onAdd: addToList,
                    onCreate: createList
                )
                .presentationDetents([.medium, .large])
                .presentationBackground(.ultraThinMaterial)
            }
        }
        .confirmationDialog(
            "Remove \(currentTitle.title) from your library?",
            isPresented: $showRemoveConfirmation,
            titleVisibility: .visible
        ) {
            Button("Remove from library", role: .destructive) {
                Task { await removeTitle() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert(
            "Slate couldn't finish that",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Please try again.")
        }
    }

    private var backdrop: some View {
        ZStack {
            AsyncImage(url: currentTitle.backdropURL) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Rectangle().fill(Color(white: 0.08))
                }
            }
            .frame(height: 540)
            .clipped()

            LinearGradient(
                colors: [.black.opacity(0.18), .black.opacity(0.55), .black],
                startPoint: .top,
                endPoint: .bottom
            )
            LinearGradient(
                colors: [.black.opacity(0.72), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
        .frame(height: 540)
        .ignoresSafeArea(edges: .top)
    }

    private var metadata: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if let runtime = currentTitle.runtime {
                    metadataText(runtimeLabel(runtime))
                    separator
                }
                if let year = currentTitle.year {
                    metadataText(year)
                }
                if let imdb = currentTitle.imdbRating {
                    separator
                    ratingChip(label: "IMDb", value: String(format: "%.1f", imdb))
                }
                if let score = currentTitle.rottenTomatoesScore {
                    separator
                    ratingChip(label: "RT", value: "\(score)%")
                } else if let score = currentTitle.metacriticScore {
                    separator
                    ratingChip(label: "MC", value: "\(score)")
                }
                ForEach((currentTitle.genres ?? []).prefix(3), id: \.id) { genre in
                    separator
                    metadataText(genre.name.uppercased())
                }
            }
        }
    }

    private var actions: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                Menu {
                    statusButton(.want, label: "Want", icon: "clock")
                    statusButton(.watching, label: "Watching", icon: "eye")
                    statusButton(.watched, label: "Watched", icon: "checkmark")
                } label: {
                    actionPill(
                        currentTitle.status.label,
                        icon: statusIcon(currentTitle.status),
                        highlighted: true
                    )
                }

                Menu {
                    ratingButton(3, label: "Love", icon: "heart.fill")
                    ratingButton(2, label: "Like", icon: "hand.thumbsup.fill")
                    ratingButton(1, label: "Dislike", icon: "hand.thumbsdown.fill")
                    if currentTitle.rating != nil {
                        Divider()
                        ratingButton(nil, label: "Clear", icon: "minus")
                    }
                } label: {
                    actionPill(ratingLabel, icon: ratingIcon)
                }

                Menu {
                    if let trailerKey = detail?.trailerKey {
                        Button {
                            if let url = URL(string: "https://www.youtube.com/watch?v=\(trailerKey)") {
                                openURL(url)
                            }
                        } label: { Label("Watch trailer", systemImage: "play.fill") }
                    }
                    if detail?.watchProviders != nil {
                        Button { presentedSheet = .providers } label: {
                            Label("Where to watch", systemImage: "tv")
                        }
                    }
                    Button { presentedSheet = .lists } label: {
                        Label("Add to list", systemImage: "text.badge.plus")
                    }
                    Button { presentedSheet = .note } label: {
                        Label(currentTitle.review == nil ? "Add note" : "Edit note", systemImage: "note.text")
                    }
                    Divider()
                    Button(role: .destructive) { showRemoveConfirmation = true } label: {
                        Label("Remove from library", systemImage: "trash")
                    }
                } label: {
                    actionPill("More", icon: "ellipsis")
                }
            }
        }
    }

    private func noteCard(_ review: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOUR NOTE")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .tracking(0.9)
                .foregroundStyle(.white.opacity(0.48))
            Text(review)
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.84))
                .lineSpacing(4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.white.opacity(0.055), in: .rect(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.1), lineWidth: 0.7)
        }
    }

    @ViewBuilder
    private func peopleSection(title: String, people: [TitlePerson]) -> some View {
        if !people.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text(title).font(.system(size: 22, weight: .bold)).tracking(-0.5)
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                    spacing: 22
                ) {
                    ForEach(people) { person in
                        NavigationLink {
                            PersonView(personId: person.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                AsyncImage(url: person.profileURL) { phase in
                                    if case .success(let image) = phase {
                                        image.resizable().scaledToFill()
                                    } else {
                                        ZStack {
                                            Color.white.opacity(0.06)
                                            Text(initials(person.name))
                                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                                .foregroundStyle(.white.opacity(0.48))
                                        }
                                    }
                                }
                                .aspectRatio(1, contentMode: .fit)
                                .clipShape(.rect(cornerRadius: 13))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.09), lineWidth: 0.7)
                                }
                                Text(person.name)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                if let subtitle = person.subtitle {
                                    Text(subtitle)
                                        .font(.system(size: 10))
                                        .foregroundStyle(.white.opacity(0.5))
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.top, 44)
        }
    }

    @ViewBuilder
    private func recommendationsSection(_ recommendations: [TitleRecommendation]) -> some View {
        if !recommendations.isEmpty {
            VStack(alignment: .leading, spacing: 17) {
                Text("If you liked \(currentTitle.title)…")
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.6)
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 11), count: 3),
                    spacing: 22
                ) {
                    ForEach(recommendations) { recommendation in
                        NavigationLink {
                            DiscoverTitleView(
                                mediaType: recommendation.mediaType,
                                tmdbId: recommendation.tmdbId
                            )
                        } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                AsyncImage(url: recommendation.posterURL) { phase in
                                    if case .success(let image) = phase {
                                        image.resizable().scaledToFill()
                                    } else {
                                        Color.white.opacity(0.06)
                                    }
                                }
                                .aspectRatio(2 / 3, contentMode: .fit)
                                .clipShape(.rect(cornerRadius: 13))
                                Text(recommendation.title)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                if let year = recommendation.year {
                                    Text(year)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(.white.opacity(0.48))
                                }
                            }
                        }
                    }
                }
            }
            .padding(.top, 48)
        }
    }

    private var ratingLabel: String {
        switch currentTitle.rating {
        case 3: "Love"
        case 2: "Like"
        case 1: "Dislike"
        default: "Rate"
        }
    }

    private var ratingIcon: String {
        switch currentTitle.rating {
        case 3: "heart.fill"
        case 2: "hand.thumbsup.fill"
        case 1: "hand.thumbsdown.fill"
        default: "minus"
        }
    }

    private func statusIcon(_ status: LibraryStatus) -> String {
        switch status {
        case .want: "clock"
        case .watching: "eye"
        case .watched: "checkmark"
        case .dropped: "xmark"
        }
    }

    private func statusButton(_ status: LibraryStatus, label: String, icon: String) -> some View {
        Button {
            Task { await updateStatus(status) }
        } label: {
            Label(label, systemImage: icon)
        }
    }

    private func ratingButton(_ rating: Int?, label: String, icon: String) -> some View {
        Button {
            Task { await updateRating(rating) }
        } label: {
            Label(label, systemImage: icon)
        }
    }

    private func actionPill(_ label: String, icon: String, highlighted: Bool = false) -> some View {
        Label(label, systemImage: icon)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(highlighted ? Color(red: 0.72, green: 0.61, blue: 1) : .white.opacity(0.82))
            .padding(.horizontal, 14)
            .frame(height: 40)
            .background(
                highlighted
                    ? Color(red: 0.45, green: 0.3, blue: 0.85).opacity(0.22)
                    : .white.opacity(0.07),
                in: .capsule
            )
            .overlay {
                Capsule().stroke(
                    highlighted
                        ? Color(red: 0.64, green: 0.49, blue: 1).opacity(0.35)
                        : .white.opacity(0.12),
                    lineWidth: 0.7
                )
            }
    }

    private var separator: some View {
        Text("·").foregroundStyle(.white.opacity(0.32))
    }

    private func metadataText(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .foregroundStyle(.white.opacity(0.66))
    }

    private func ratingChip(label: String, value: String) -> some View {
        HStack(spacing: 4) {
            Text(label).fontWeight(.bold)
            Text(value)
        }
        .font(.system(size: 10, design: .monospaced))
        .foregroundStyle(.white.opacity(0.8))
        .padding(.horizontal, 7)
        .frame(height: 22)
        .background(.black.opacity(0.48), in: .capsule)
        .overlay { Capsule().stroke(.white.opacity(0.1), lineWidth: 0.6) }
    }

    private func runtimeLabel(_ minutes: Int) -> String {
        minutes >= 60 ? "\(minutes / 60)H \(minutes % 60)M" : "\(minutes)M"
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    private func load() async {
        do {
            detail = try await model.titleDetail(id: title.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private func updateStatus(_ status: LibraryStatus) async {
        do {
            let updated = try await model.setStatus(titleId: currentTitle.id, status: status)
            detail?.title = updated
        } catch { errorMessage = error.localizedDescription }
    }

    private func updateRating(_ rating: Int?) async {
        do {
            let updated = try await model.setRating(titleId: currentTitle.id, rating: rating)
            detail?.title = updated
        } catch { errorMessage = error.localizedDescription }
    }

    private func saveReview(_ review: String) async -> Bool {
        do {
            let updated = try await model.setReview(titleId: currentTitle.id, review: review)
            detail?.title = updated
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func addToList(_ list: TitleListOption) async -> Bool {
        do {
            let updated = try await model.addTitle(currentTitle.id, toList: list.id)
            if let index = detail?.lists.firstIndex(where: { $0.id == updated.id }) {
                detail?.lists[index] = updated
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func createList(_ name: String) async -> Bool {
        do {
            let created = try await model.addTitle(currentTitle.id, newListName: name)
            detail?.lists.append(created)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func removeTitle() async {
        do {
            try await model.removeTitle(id: currentTitle.id)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct NoteEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let initialValue: String
    let onSave: (String) async -> Bool
    @State private var value: String
    @State private var saving = false

    init(title: String, initialValue: String, onSave: @escaping (String) async -> Bool) {
        self.title = title
        self.initialValue = initialValue
        self.onSave = onSave
        _value = State(initialValue: initialValue)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("Jot down your thoughts. Stays just for you.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextEditor(text: $value)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(.white.opacity(0.06), in: .rect(cornerRadius: 14))
                    .overlay { RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.1)) }
            }
            .padding(18)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saving = true
                        Task {
                            if await onSave(value) { dismiss() }
                            saving = false
                        }
                    }
                    .disabled(saving)
                }
            }
        }
    }
}

private struct ProviderPickerSheet: View {
    @Environment(\.openURL) private var openURL
    let titleName: String
    let providers: TitleWatchProviders?

    var body: some View {
        NavigationStack {
            List(providers?.providers ?? []) { provider in
                Button {
                    if let url = providerURL(provider, titleName: titleName) { openURL(url) }
                } label: {
                    HStack(spacing: 14) {
                        AsyncImage(url: provider.logoURL) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else { Color.white.opacity(0.08) }
                        }
                        .frame(width: 42, height: 42)
                        .clipShape(.rect(cornerRadius: 10))
                        Text(provider.name).foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "arrow.up.right").foregroundStyle(.secondary)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Where to watch")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func providerURL(_ provider: TitleWatchProvider, titleName: String) -> URL? {
        let query = titleName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? titleName
        let value: String
        switch provider.id {
        case 8, 1796: value = "https://www.netflix.com/search?q=\(query)"
        case 15: value = "https://www.hulu.com/search?q=\(query)"
        case 337: value = "https://www.disneyplus.com/search?q=\(query)"
        case 384, 1899: value = "https://play.max.com/search?q=\(query)"
        case 531: value = "https://www.paramountplus.com/search/?q=\(query)"
        case 2, 350: value = "https://tv.apple.com/search?term=\(query)"
        default: return providers?.link
        }
        return URL(string: value)
    }
}

private struct ListPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let lists: [TitleListOption]
    let onAdd: (TitleListOption) async -> Bool
    let onCreate: (String) async -> Bool
    @State private var newListName = ""
    @State private var busy = false

    var body: some View {
        NavigationStack {
            List {
                Section("Your lists") {
                    ForEach(lists) { list in
                        Button {
                            guard !list.containsTitle else { return }
                            busy = true
                            Task {
                                if await onAdd(list) { dismiss() }
                                busy = false
                            }
                        } label: {
                            HStack {
                                Text(list.name).foregroundStyle(.primary)
                                Spacer()
                                if list.containsTitle {
                                    Image(systemName: "checkmark").foregroundStyle(.purple)
                                }
                            }
                        }
                        .disabled(busy || list.containsTitle)
                    }
                }
                Section("New list") {
                    TextField("List name", text: $newListName)
                    Button("Create and add") {
                        let name = newListName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !name.isEmpty else { return }
                        busy = true
                        Task {
                            if await onCreate(name) { dismiss() }
                            busy = false
                        }
                    }
                    .disabled(busy || newListName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Add to list")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
