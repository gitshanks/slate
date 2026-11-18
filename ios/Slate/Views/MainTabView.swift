import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selection: SlateTab = .library
    @State private var showSearch = false
    @State private var showProfile = false
    @State private var showImport = false
    // The Library's shelf and filters outlive a visit to another tab.
    @State private var shelf: Shelf = .upNext
    @State private var filters = LibraryFilters()

    private struct ListLink: Identifiable {
        let id: String
    }

    var body: some View {
        let screenKey = showProfile ? "profile" : selection.rawValue
        ZStack {
            // The top bar and the dock belong to the tab screens, so a pushed
            // screen (a title, a person, a list) covers them like any other.
            NavigationStack {
                Group {
                    if showProfile {
                        ProfileView()
                    } else {
                        rootScreen
                    }
                }
                .slateArrive(on: screenKey)
                .safeAreaInset(edge: .top, spacing: 0) {
                    SlateTopBar(
                        profile: model.profile,
                        avatarData: model.avatarData,
                        profileIsOpen: showProfile,
                        onLogo: {
                            showProfile = false
                            selection = .library
                        },
                        onProfile: { showProfile.toggle() }
                    )
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    SlateDock(
                        selection: Binding(
                            get: { selection },
                            set: { tab in
                                showProfile = false
                                showSearch = false
                                selection = tab
                            }
                        ),
                        onAdd: { withAnimation(.smooth(duration: 0.24)) { showSearch = true } }
                    )
                }
                .background(SlatePalette.background.ignoresSafeArea())
                .toolbar(.hidden, for: .navigationBar)
            }
            .background(SlatePalette.background.ignoresSafeArea())

            if showSearch {
                SearchView(
                    onClose: { withAnimation(.smooth(duration: 0.22)) { showSearch = false } },
                    onAddFromLink: {
                        showSearch = false
                        showImport = true
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.985, anchor: .top)))
                .zIndex(10)
            }
        }
        .onChange(of: model.inboundSharedText) { _, value in
            guard value != nil else { return }
            showSearch = false
            showImport = true
        }
        .sheet(isPresented: $showImport, onDismiss: { model.inboundSharedText = nil }) {
            ImportRecommendationsView(
                initialText: model.inboundSharedText,
                onClose: { showImport = false }
            )
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
        .preferredColorScheme(.dark)
        #if DEBUG
        .onAppear {
            switch SlatePreview.tab {
            case "discover": selection = .discover
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
            if let format = SlatePreview.format { filters.format = format }
            if SlatePreview.sheet == "import" { model.inboundSharedText = "https://example.com" }
            if SlatePreview.sheet == "list" { model.pendingListSlug = "preview" }
            if SlatePreview.sheet == "search" { showSearch = true }
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
                onAdd: { withAnimation(.smooth(duration: 0.24)) { showSearch = true } },
                onAddFromLink: { showImport = true }
            )
        case .discover:
            DiscoverHomeScreen()
        case .lists:
            ListsScreen()
        }
    }
}

struct PosterDragPreview: View {
    let title: SlateTitle
    var body: some View {
        CachedAsyncImage(url: title.posterURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Color(white: 0.1)
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
                        Circle().fill(.white.opacity(0.1)).overlay {
                            Text(initials).font(.caption2.bold()).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .frame(width: 30, height: 30)
            .clipShape(.circle)
            .overlay { Circle().stroke(.white.opacity(0.15), lineWidth: 0.7) }
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
