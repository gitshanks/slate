import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Where a search result or a link leads from the top of any screen.
enum SlateRoute: Hashable {
    case title(SlateTitle)
    case catalog(CatalogTitle)
    case person(Int)
    case results(String)
}

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel
    @StateObject private var search = SearchSession()
    @State private var selection: SlateTab = .library
    @State private var showProfile = false
    @State private var showImport = false
    @State private var importText: String?
    @State private var path = NavigationPath()
    @State private var previewsSearch = false
    // The Library's shelf, filters and view outlive a visit to another tab.
    @State private var shelf: Shelf = .upNext
    @State private var filters = LibraryFilters()
    @State private var viewMode: LibraryViewMode = .shelf

    private struct ListLink: Identifiable {
        let id: String
    }

    var body: some View {
        let screenKey = showProfile ? "profile" : selection.rawValue
        SlateChrome(
            selection: Binding(
                get: { selection },
                set: { tab in
                    showProfile = false
                    search.dismiss()
                    path = NavigationPath()
                    selection = tab
                }
            ),
            profileIsOpen: showProfile,
            showsTopBar: showProfile || selection != .previews,
            showsSearch: !showProfile,
            viewMode: !showProfile && selection == .library ? $viewMode : nil,
            onLogo: {
                showProfile = false
                search.dismiss()
                path = NavigationPath()
                selection = .library
            },
            onAdd: {
                if selection == .previews && !showProfile {
                    previewsSearch = true
                } else {
                    path = NavigationPath()
                    showProfile = false
                    search.activate()
                }
            },
            onProfile: {
                search.dismiss()
                path = NavigationPath()
                showProfile.toggle()
            },
            onOpenTitle: { path.append(SlateRoute.title($0)) },
            onOpenCatalog: { path.append(SlateRoute.catalog($0)) },
            onOpenPerson: { path.append(SlateRoute.person($0)) }
        ) {
            NavigationStack(path: $path) {
                Group {
                    if showProfile {
                        ProfileView(onOpenShelf: { value in
                            shelf = value
                            showProfile = false
                            selection = .library
                        })
                    } else {
                        rootScreen
                    }
                }
                .navigationDestination(for: SlateRoute.self) { route in
                    switch route {
                    case .title(let title): TitleDetailView(title: title)
                    case .catalog(let title): CatalogDestination(title: title)
                    case .person(let id): PersonView(personId: id)
                    case .results(let query): SearchResultsScreen(query: query)
                    }
                }
            }
            .id(screenKey)
            .slateArrive(on: screenKey)
        }
        .environmentObject(search)
        .onChange(of: search.resultsQuery) { _, value in
            guard let value else { return }
            path.append(SlateRoute.results(value.text))
            search.resultsQuery = nil
        }
        .onChange(of: search.linkText) { _, value in
            guard let value else { return }
            importText = value
            showImport = true
            search.linkText = nil
        }
        .onChange(of: model.inboundSharedText) { _, value in
            guard let value else { return }
            search.dismiss()
            importText = value
            showImport = true
        }
        .sheet(isPresented: $showImport, onDismiss: {
            model.inboundSharedText = nil
            importText = nil
        }) {
            ImportRecommendationsView(
                initialText: importText,
                onClose: { showImport = false }
            )
        }
        .sheet(item: $search.askPrompt) { prompt in
            AskSlateView(firstQuestion: prompt.text)
        }
        .sheet(isPresented: $previewsSearch) {
            PreviewsSearchSheet()
                .environmentObject(search)
        }
        .sheet(
            item: Binding(
                get: { model.pendingListSlug.map(ListLink.init(id:)) },
                set: { if $0 == nil { model.pendingListSlug = nil } }
            )
        ) { link in
            CuratedListScreen(
                slug: link.id,
                onClose: { model.pendingListSlug = nil },
                onOpenLists: {
                    model.pendingListSlug = nil
                    showProfile = false
                    selection = .lists
                }
            )
        }
        .tint(SlatePalette.accent)
        #if DEBUG
        .onAppear {
            switch SlatePreview.tab {
            case "discover": selection = .discover
            case "previews": selection = .previews
            case "lists": selection = .lists
            case "profile": showProfile = true
            default: break
            }
            switch SlatePreview.shelf {
            case "all": shelf = .all
            case "watching": shelf = .watching
            case "watched": shelf = .watched
            default: break
            }
            if SlatePreview.view == "space" { viewMode = .space }
            if let format = SlatePreview.format { filters.format = format }
            if SlatePreview.sheet == "import" { model.inboundSharedText = "https://example.com" }
            if SlatePreview.sheet == "list" { model.pendingListSlug = "preview" }
            if SlatePreview.sheet == "search" {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    search.activate()
                    if let query = SlatePreview.query { search.query = query }
                }
            }
            if SlatePreview.sheet == "results", let query = SlatePreview.query { path.append(SlateRoute.results(query)) }
            if SlatePreview.sheet == "ask" { search.askPrompt = .init(text: SlatePreview.query ?? "cozy autumn mysteries") }
            if let index = SlatePreview.moveShelf, Shelf.allCases.indices.contains(index) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) { shelf = Shelf.allCases[index] }
            }
        }
        #endif
    }

    @ViewBuilder
    private var rootScreen: some View {
        switch selection {
        case .library:
            LibraryScreen(
                shelf: $shelf,
                filters: $filters,
                viewMode: viewMode,
                query: search.trimmed,
                onAdd: { search.activate() },
                onAddFromLink: {
                    importText = nil
                    showImport = true
                },
                onOpenTitle: { path.append(SlateRoute.title($0)) }
            )
        case .discover:
            DiscoverHomeScreen()
        case .previews:
            PreviewsScreen()
        case .lists:
            ListsScreen()
        }
    }
}

/// The add button on Previews, where there is no search field to focus: the
/// same search, in a sheet.
private struct PreviewsSearchSheet: View {
    @EnvironmentObject private var search: SearchSession
    @Environment(\.dismiss) private var dismiss
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 10) {
                SmartSearchBar()
                SearchPanel(
                    onOpenTitle: { path.append(SlateRoute.title($0)) },
                    onOpenCatalog: { path.append(SlateRoute.catalog($0)) },
                    onOpenPerson: { path.append(SlateRoute.person($0)) }
                )
                Spacer(minLength: 0)
            }
            .padding(SlateMetrics.gutter)
            .background(SlatePalette.background.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: SlateRoute.self) { route in
                switch route {
                case .title(let title): TitleDetailView(title: title)
                case .catalog(let title): CatalogDestination(title: title)
                case .person(let id): PersonView(personId: id)
                case .results(let query): SearchResultsScreen(query: query)
                }
            }
        }
        .onAppear { search.activate() }
        .onDisappear { search.dismiss() }
        .onChange(of: search.resultsQuery) { _, value in
            guard let value else { return }
            path.append(SlateRoute.results(value.text))
            search.resultsQuery = nil
        }
        .onChange(of: search.askPrompt?.id) { _, value in if value != nil { dismiss() } }
        .onChange(of: search.linkText) { _, value in if value != nil { dismiss() } }
    }
}

struct PosterDragPreview: View {
    let title: SlateTitle
    var body: some View {
        CachedAsyncImage(url: title.posterURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            SlatePalette.placeholder
        }
        .frame(width: 120, height: 180)
        .clipShape(.rect(cornerRadius: 12))
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
                    CachedAsyncImage(url: profile?.avatarUrl) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Circle().fill(SlatePalette.text.opacity(0.1)).overlay {
                            Text(initials).font(.caption2.bold()).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .frame(width: 30, height: 30)
            .clipShape(.circle)
            .overlay { Circle().stroke(SlatePalette.text.opacity(0.15), lineWidth: 0.7) }
            .frame(width: 44, height: 44)
            .contentShape(.rect)
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityLabel("Profile")
    }

    private var initials: String {
        (profile?.displayName ?? "S").split(separator: " ").prefix(2)
            .compactMap(\.first).map(String.init).joined().uppercased()
    }
}
