import SwiftUI
import UniformTypeIdentifiers

struct ListsScreen: View {
    @EnvironmentObject private var model: AppModel
    @Binding var showProfile: Bool
    @State private var summaries: [SlateListSummary] = []
    @State private var loading = true
    @State private var creating = false

    var body: some View {
        NavigationStack {
            Group {
                if loading && summaries.isEmpty {
                    ProgressView().tint(.white)
                } else if summaries.isEmpty {
                    ContentUnavailableView(
                        "No lists yet",
                        systemImage: "square.stack.3d.up",
                        description: Text("Group titles for a mood, trip, or movie night.")
                    )
                } else {
                    ScrollView {
                        LazyVGrid(
                            columns: [GridItem(.flexible()), GridItem(.flexible())],
                            spacing: 14
                        ) {
                            ForEach(summaries) { list in
                                NavigationLink {
                                    ListDetailView(listId: list.id)
                                } label: {
                                    ListSummaryCard(list: list)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(18)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Lists")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ProfileAvatarButton(profile: model.profile, data: model.avatarData) { showProfile = true }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { creating = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Create list")
                }
            }
            .task { await load() }
            .sheet(isPresented: $creating) {
                ListEditorSheet(title: "New list", name: "", description: "") { name, description in
                    do {
                        let created = try await model.createList(name: name, description: description)
                        summaries.insert(created, at: 0)
                        return true
                    } catch {
                        model.presentedError = error.localizedDescription
                        return false
                    }
                }
            }
        }
    }

    private func load() async {
        do { summaries = try await model.listSummaries() }
        catch { model.presentedError = error.localizedDescription }
        loading = false
    }
}

private struct ListSummaryCard: View {
    let list: SlateListSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.045))
                if list.posters.isEmpty {
                    Image(systemName: "film.stack").font(.title).foregroundStyle(.tertiary)
                } else {
                    HStack(spacing: -22) {
                        ForEach(Array(list.posters.prefix(3).enumerated()), id: \.offset) { index, url in
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: { Color(white: 0.1) }
                            .frame(width: 72, height: 108)
                            .clipShape(.rect(cornerRadius: 8))
                            .rotationEffect(.degrees(Double(index - 1) * 5))
                            .shadow(color: .black.opacity(0.45), radius: 10, y: 6)
                        }
                    }
                }
            }
            .aspectRatio(16 / 11, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.09), lineWidth: 0.7) }

            HStack(alignment: .firstTextBaseline) {
                Text(list.name).font(.headline).lineLimit(1)
                Spacer()
                Text("\(list.count)").font(.caption.monospaced()).foregroundStyle(.secondary)
            }
            if let description = list.description, !description.isEmpty {
                Text(description).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(12)
        .background(.white.opacity(0.035), in: .rect(cornerRadius: 20))
    }
}

private struct ListDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let listId: String
    @State private var detail: SlateListDetailPayload?
    @State private var dragging: SlateTitle?
    @State private var editing = false
    @State private var adding = false
    @State private var deleting = false

    private let columns = [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 8) {
                    Text("LIST").font(.caption.monospaced().weight(.semibold)).tracking(1.3).foregroundStyle(.secondary)
                    Text(detail.list.name).font(.system(size: 38, weight: .bold)).tracking(-1.4)
                    if let description = detail.list.description, !description.isEmpty {
                        Text(description).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 18)
                .padding(.bottom, 22)

                if detail.titles.isEmpty {
                    ContentUnavailableView("Empty list", systemImage: "film", description: Text("Add a title from your library."))
                        .padding(.top, 70)
                } else {
                    LazyVGrid(columns: columns, spacing: 24) {
                        ForEach(detail.titles) { title in
                            NavigationLink { TitleDetailView(title: title) } label: {
                                PosterCard(title: title)
                                    .opacity(dragging?.id == title.id ? 0.3 : 1)
                            }
                            .buttonStyle(.plain)
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
                    .padding(.horizontal, 18)
                    .padding(.bottom, 40)
                    .animation(.smooth(duration: 0.22), value: detail.titles.map(\.id))
                }
            } else {
                ProgressView().tint(.white).padding(.top, 160)
            }
        }
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
        .task { await load() }
        .sheet(isPresented: $adding) {
            AddCandidatesSheet(candidates: detail?.candidates ?? []) { title in
                do {
                    try await model.addTitleToList(listId: listId, titleId: title.id)
                    self.detail?.titles.append(title)
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

private struct AddCandidatesSheet: View {
    @Environment(\.dismiss) private var dismiss
    let candidates: [SlateTitle]
    let onAdd: (SlateTitle) async -> Bool
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List(candidates.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) }) { title in
                Button {
                    Task { if await onAdd(title) { dismiss() } }
                } label: {
                    HStack(spacing: 13) {
                        AsyncImage(url: title.posterURL) { image in image.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.15) }
                            .frame(width: 44, height: 66).clipShape(.rect(cornerRadius: 7))
                        VStack(alignment: .leading) {
                            Text(title.title).foregroundStyle(.primary)
                            Text(title.year ?? title.mediaType.rawValue.capitalized).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "plus.circle.fill").foregroundStyle(.purple)
                    }
                }
            }
            .searchable(text: $query, prompt: "Filter your library")
            .navigationTitle("Add a title")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

struct ListEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let onSave: (String, String) async -> Bool
    @State private var name: String
    @State private var description: String
    @State private var saving = false

    init(title: String, name: String, description: String, onSave: @escaping (String, String) async -> Bool) {
        self.title = title
        self.onSave = onSave
        _name = State(initialValue: name)
        _description = State(initialValue: description)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Description (optional)", text: $description, axis: .vertical).lineLimit(3...6)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saving = true
                        Task { if await onSave(name, description) { dismiss() }; saving = false }
                    }
                    .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
