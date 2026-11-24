import SwiftUI
import UniformTypeIdentifiers

struct ListsScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var summaries: [SlateListSummary] = []
    @State private var loading = true
    @State private var creating = false
    @State private var deleting: SlateListSummary?
    /// A new list opens straight into adding titles, as on the web.
    @State private var justCreated: String?
    @State private var openCreated: SlateListSummary?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .bottom, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        SlateMonoLabel("Collections", size: 12)
                        Text("Lists")
                            .font(.system(size: 36, weight: .semibold))
                            .tracking(-1)
                            .foregroundStyle(SlatePalette.text)
                            .accessibilityAddTraits(.isHeader)
                    }
                    Spacer(minLength: 0)
                    Button { creating = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus").font(.system(size: 13, weight: .semibold))
                            Text("New list").font(.system(size: 13, weight: .medium))
                        }
                        .foregroundStyle(SlatePalette.text)
                        .padding(.leading, 12)
                        .padding(.trailing, 14)
                        .frame(height: 40)
                        .background(SlatePalette.fill, in: .capsule)
                        .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
                        .contentShape(.capsule)
                    }
                    .buttonStyle(SlatePressStyle())
                }
                .padding(.horizontal, SlateMetrics.gutter)
                .padding(.top, 20)
                .padding(.bottom, 32)

                if loading && summaries.isEmpty {
                    Color.clear.frame(height: 1)
                } else if summaries.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "text.badge.plus")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(SlatePalette.mutedText)
                            .frame(width: 56, height: 56)
                            .background(SlatePalette.fill, in: .rect(cornerRadius: 16))
                            .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.border, lineWidth: 1) }
                        SlateEmptyMessage(
                            title: "No lists yet",
                            message: "Group titles into themed collections — Cozy winter, A24 horror, Long flights…"
                        )
                    }
                    .padding(.horizontal, 32)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 72)
                } else {
                    LazyVStack(spacing: 16) {
                        ForEach(summaries) { list in
                            ZStack(alignment: .topTrailing) {
                                NavigationLink {
                                    ListDetailView(listId: list.id, startAdding: list.id == justCreated)
                                } label: {
                                    ListSummaryCard(list: list)
                                }
                                .buttonStyle(.plain)

                                HStack(spacing: 7) {
                                    if let url = URL(string: "https://www.s1ate.space/lists/\(list.slug)") {
                                        ShareLink(item: url, subject: Text(list.name)) {
                                            listCardAction("square.and.arrow.up", label: "Share \(list.name)")
                                        }
                                    }
                                    Button { deleting = list } label: {
                                        listCardAction("trash", label: "Delete \(list.name)")
                                    }
                                    .buttonStyle(SlatePressStyle())
                                }
                                .padding(11)
                            }
                        }
                    }
                    .padding(.horizontal, SlateMetrics.gutter)
                    .padding(.bottom, 24)
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
                    .slateArrive(on: summaries.count)
                }
            }
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $creating) {
            ListEditorSheet(title: "New list", name: "", description: "", saveLabel: "Create and add titles") { name, description in
                do {
                    let created = try await model.createList(name: name, description: description)
                    summaries.insert(created, at: 0)
                    justCreated = created.id
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { openCreated = created }
                    return true
                } catch {
                    model.presentedError = error.localizedDescription
                    return false
                }
            }
        }
        .navigationDestination(item: $openCreated) { list in
            ListDetailView(listId: list.id, startAdding: true)
        }
        .confirmationDialog(
            "Delete \(deleting?.name ?? "this list")?",
            isPresented: Binding(
                get: { deleting != nil },
                set: { if !$0 { deleting = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete list", role: .destructive) {
                guard let list = deleting else { return }
                deleting = nil
                Task {
                    do {
                        try await model.deleteList(id: list.id)
                        summaries.removeAll { $0.id == list.id }
                    } catch { model.presentedError = error.localizedDescription }
                }
            }
            Button("Cancel", role: .cancel) { deleting = nil }
        }
    }

    private func listCardAction(_ icon: String, label: String) -> some View {
        Image(systemName: icon)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white.opacity(0.78))
            .frame(width: 34, height: 34)
            .background(.black.opacity(0.72), in: .circle)
            .overlay { Circle().stroke(.white.opacity(0.1), lineWidth: 0.7) }
            .accessibilityLabel(label)
    }

    private func load() async {
        do { summaries = try await model.listSummaries() }
        catch { model.presentedError = error.localizedDescription }
        loading = false
    }
}

/// A list as the web's Lists page shows it: its first posters fanned on a
/// wide cover, then the name, the count and the description.
private struct ListSummaryCard: View {
    let list: SlateListSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                LinearGradient(
                    colors: [SlatePalette.placeholder.opacity(0.4), SlatePalette.placeholder.opacity(0.1)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                if list.posters.isEmpty {
                    Image(systemName: "film")
                        .font(.system(size: 30))
                        .foregroundStyle(SlatePalette.mutedText.opacity(0.4))
                } else {
                    GeometryReader { proxy in
                        let covers = Array(list.posters.prefix(4))
                        let height = proxy.size.height * 0.78
                        HStack(spacing: 8) {
                            ForEach(Array(covers.enumerated()), id: \.offset) { index, url in
                                CachedAsyncImage(url: url) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: { SlatePalette.placeholder }
                                .frame(width: height * 2 / 3, height: height)
                                .clipShape(.rect(cornerRadius: 6))
                                .overlay { RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.1), lineWidth: 1) }
                                .shadow(color: .black.opacity(0.4), radius: 10, y: 8)
                                .rotationEffect(.degrees((Double(index) - Double(covers.count - 1) / 2) * 5))
                            }
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height)
                    }
                    LinearGradient(colors: [.clear, SlatePalette.surface], startPoint: .center, endPoint: .bottom)
                        .frame(height: 48)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(list.name)
                        .font(.system(size: 18, weight: .semibold))
                        .tracking(-0.3)
                        .foregroundStyle(SlatePalette.text)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Text("\(list.count) \(list.count == 1 ? "title" : "titles")")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(SlatePalette.mutedText)
                        .fixedSize()
                }
                if let description = list.description, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 14))
                        .foregroundStyle(SlatePalette.mutedText)
                        .lineLimit(1)
                }
            }
            .padding(16)
        }
        .background(SlatePalette.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.border, lineWidth: 1) }
    }
}

private struct ListDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let listId: String
    var startAdding = false
    @State private var detail: SlateListDetailPayload?
    @State private var dragging: SlateTitle?
    @State private var editing = false
    @State private var adding = false
    @State private var deleting = false

    var body: some View {
        GeometryReader { proxy in
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 8) {
                    Text(detail.list.name)
                        .font(.system(size: 36, weight: .semibold))
                        .tracking(-1)
                        .foregroundStyle(SlatePalette.text)
                    if let description = detail.list.description, !description.isEmpty {
                        Text(description).font(.system(size: 15)).foregroundStyle(SlatePalette.mutedText)
                    }
                    Button { adding = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus").font(.system(size: 13, weight: .semibold))
                            Text("Add titles").font(.system(size: 14, weight: .medium))
                        }
                        .foregroundStyle(SlatePalette.onAccent)
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(SlatePalette.accent, in: .capsule)
                    }
                    .buttonStyle(SlatePressStyle())
                    .padding(.top, 10)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, SlateMetrics.gutter)
                .padding(.bottom, 20)

                if detail.titles.isEmpty {
                    SlateEmptyMessage(
                        title: "Nothing here yet",
                        message: "Use Add titles to search any film or show. You can also add from any title's page, Discover or search."
                    )
                    .padding(.horizontal, 24)
                    .padding(.top, 60)
                } else {
                    let layout = SlateMetrics.libraryGrid(for: proxy.size.width)
                    LazyVGrid(columns: layout.columns, spacing: layout.rowGap) {
                        ForEach(detail.titles) { title in
                            NavigationLink { TitleDetailView(title: title) } label: {
                                LibraryPosterCard(title: title, compact: layout.compact)
                                    .opacity(dragging?.id == title.id ? 0.3 : 1)
                            }
                            .buttonStyle(SlatePressStyle())
                            .onDrag {
                                dragging = title
                                return NSItemProvider(object: title.id as NSString)
                            } preview: { PosterDragPreview(title: title) }
                            .onDrop(
                                of: [UTType.text],
                                delegate: PosterReorderDelegate(
                                    target: title,
                                    items: Binding(
                                        get: { self.detail?.titles ?? [] },
                                        set: { self.detail?.titles = $0 }
                                    ),
                                    dragging: $dragging,
                                    onCommit: commitOrder
                                )
                            )
                            .contextMenu {
                                Button(role: .destructive) {
                                    Task { await remove(title) }
                                } label: { Label("Remove from list", systemImage: "minus.circle") }
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 40)
                    .animation(.smooth(duration: 0.22), value: detail.titles.map(\.id))
                }
            }
        }
        }
        .background(SlatePalette.background)
        .slateHidesChrome()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { adding = true } label: { Image(systemName: "plus") }
                Menu {
                    Button { editing = true } label: { Label("Edit list", systemImage: "pencil") }
                    if let profile = model.profile, profile.isPublic,
                       let url = URL(string: "https://www.s1ate.space/u/\(profile.username)") {
                        ShareLink(item: url) { Label("Share your slate", systemImage: "square.and.arrow.up") }
                    }
                    Divider()
                    Button(role: .destructive) { deleting = true } label: { Label("Delete list", systemImage: "trash") }
                } label: { Image(systemName: "ellipsis") }
            }
        }
        .task {
            await load()
            if startAdding { adding = true }
        }
        .sheet(isPresented: $adding) {
            AddCandidatesSheet(candidates: detail?.candidates ?? []) { title in
                do {
                    try await model.addTitleToList(listId: listId, titleId: title.id)
                    if self.detail?.titles.contains(where: { $0.id == title.id }) == false {
                        self.detail?.titles.append(title)
                    }
                    self.detail?.candidates.removeAll { $0.id == title.id }
                    return true
                } catch {
                    model.presentedError = error.localizedDescription
                    return false
                }
            }
        }
        .sheet(isPresented: $editing) {
            ListEditorSheet(
                title: "Edit list",
                name: detail?.list.name ?? "",
                description: detail?.list.description ?? ""
            ) { name, description in
                do {
                    let list = try await model.updateList(id: listId, name: name, description: description)
                    if let current = self.detail {
                        self.detail = SlateListDetailPayload(list: list, titles: current.titles, candidates: current.candidates)
                    }
                    return true
                } catch {
                    model.presentedError = error.localizedDescription
                    return false
                }
            }
        }
        .confirmationDialog("Delete this list?", isPresented: $deleting, titleVisibility: .visible) {
            Button("Delete list", role: .destructive) {
                Task {
                    do { try await model.deleteList(id: listId); dismiss() }
                    catch { model.presentedError = error.localizedDescription }
                }
            }
        }
    }

    private func load() async {
        do { detail = try await model.listDetail(id: listId) }
        catch { model.presentedError = error.localizedDescription }
    }

    private func commitOrder(_ values: [SlateTitle]) {
        Task {
            do { try await model.reorder(listId: listId, titles: values) }
            catch { model.presentedError = error.localizedDescription; await load() }
        }
    }

    private func remove(_ title: SlateTitle) async {
        do {
            try await model.removeTitleFromList(listId: listId, titleId: title.id)
            detail?.titles.removeAll { $0.id == title.id }
            detail?.candidates.insert(title, at: 0)
        } catch { model.presentedError = error.localizedDescription }
    }
}

/// Adding to a list (`components/add-to-list-picker.tsx`): search any film or
/// show; with nothing typed, what is recently in your library. A title not on
/// your slate yet goes into Up Next too.
private struct AddCandidatesSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let candidates: [SlateTitle]
    let onAdd: (SlateTitle) async -> Bool
    @State private var query = ""
    @State private var results: [CatalogTitle] = []
    @State private var searching = false
    @State private var busy: String?
    @State private var added: Set<String> = []

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass").foregroundStyle(SlatePalette.mutedText)
                        TextField("", text: $query, prompt: Text("Search any film or show").foregroundStyle(SlatePalette.mutedText))
                            .foregroundStyle(SlatePalette.text)
                            .autocorrectionDisabled()
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(SlatePalette.fill, in: .capsule)
                    .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
                    .padding(.bottom, 8)

                    Text("Titles not in your library go into Up Next too.")
                        .font(.system(size: 13))
                        .foregroundStyle(SlatePalette.mutedText)
                        .padding(.bottom, 10)

                    if trimmed.isEmpty {
                        SlateMonoLabel("Recently in your library").padding(.vertical, 8)
                        ForEach(candidates.prefix(30)) { title in
                            row(title: title.title, detail: title.year ?? (title.mediaType == .movie ? "Film" : "Series"),
                                poster: title.posterURL, key: title.id) { await onAdd(title) }
                        }
                    } else if searching && results.isEmpty {
                        Text("Searching…").font(.system(size: 14)).foregroundStyle(SlatePalette.mutedText).padding(.top, 12)
                    } else {
                        ForEach(results) { title in
                            row(title: title.title, detail: title.year ?? (title.mediaType == .movie ? "Film" : "Series"),
                                poster: title.posterURL, key: title.id) { await addCatalog(title) }
                        }
                    }
                }
                .padding(SlateMetrics.gutter)
            }
            .background(SlatePalette.surface.ignoresSafeArea())
            .navigationTitle("Add titles")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task(id: trimmed) { await search() }
        }
        .presentationDetents([.large])
    }

    private func row(title: String, detail: String, poster: URL?, key: String, add: @escaping () async -> Bool) -> some View {
        Button {
            guard busy == nil, !added.contains(key) else { return }
            busy = key
            Task {
                if await add() { added.insert(key) }
                busy = nil
            }
        } label: {
            HStack(spacing: 12) {
                PosterFrame(url: poster, title: title, corner: 7).frame(width: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(SlatePalette.text).lineLimit(1)
                    Text(detail).font(.system(size: 13)).foregroundStyle(SlatePalette.mutedText)
                }
                Spacer()
                Image(systemName: added.contains(key) ? "checkmark.circle.fill" : busy == key ? "ellipsis.circle" : "plus.circle")
                    .font(.system(size: 22))
                    .foregroundStyle(SlatePalette.accent)
            }
            .padding(.vertical, 6)
            .contentShape(.rect)
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityLabel(added.contains(key) ? "\(title), in this list" : "Add \(title) to this list")
    }

    private func search() async {
        guard !trimmed.isEmpty else { results = []; return }
        searching = true
        defer { searching = false }
        do {
            try await Task.sleep(for: .milliseconds(240))
            results = try await model.search(trimmed).results
        } catch {}
    }

    private func addCatalog(_ title: CatalogTitle) async -> Bool {
        do {
            let saved: SlateTitle
            if let existing = title.saved.flatMap({ ref in model.titles.first { $0.id == ref.id } }) {
                saved = existing
            } else {
                saved = try await model.addCatalogTitle(tmdbId: title.tmdbId, mediaType: title.mediaType, status: .want)
            }
            return await onAdd(saved)
        } catch {
            model.presentedError = error.localizedDescription
            return false
        }
    }
}

/// Naming a list (`components/create-list-form.tsx`): the name, an optional
/// description, Cancel, and the one action.
struct ListEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var saveLabel = "Save"
    let onSave: (String, String) async -> Bool
    @State private var name: String
    @State private var description: String
    @State private var saving = false
    @FocusState private var nameFocused: Bool

    init(title: String, name: String, description: String, saveLabel: String = "Save", onSave: @escaping (String, String) async -> Bool) {
        self.title = title
        self.saveLabel = saveLabel
        self.onSave = onSave
        _name = State(initialValue: name)
        _description = State(initialValue: description)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SlateMonoLabel(title, size: 12)
            TextField("", text: $name, prompt: Text("List name (e.g. Cozy winter)").foregroundStyle(SlatePalette.mutedText))
                .focused($nameFocused)
                .submitLabel(.done)
                .modifier(ListField())
            TextField("", text: $description, prompt: Text("Optional description").foregroundStyle(SlatePalette.mutedText), axis: .vertical)
                .lineLimit(1...4)
                .modifier(ListField())
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Button("Cancel") { dismiss() }
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(SlatePalette.text)
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .buttonStyle(SlatePressStyle())
                    .disabled(saving)
                Button {
                    saving = true
                    Task { if await onSave(name, description) { dismiss() }; saving = false }
                } label: {
                    Text(saving ? "Saving…" : saveLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(SlatePalette.onAccent)
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(SlatePalette.accent.opacity(canSave ? 1 : 0.5), in: .capsule)
                }
                .buttonStyle(SlatePressStyle())
                .disabled(!canSave)
            }
            .padding(.top, 4)
        }
        .padding(20)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(SlatePalette.surface.ignoresSafeArea())
        .presentationDetents([.height(268)])
        .presentationDragIndicator(.visible)
        .onAppear { nameFocused = true }
    }

    private var canSave: Bool {
        !saving && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

private struct ListField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 16))
            .foregroundStyle(SlatePalette.text)
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(SlatePalette.background, in: .rect(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).stroke(SlatePalette.border, lineWidth: 1) }
    }
}
