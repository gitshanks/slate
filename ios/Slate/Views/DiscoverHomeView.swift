import SwiftUI

/// Discover: what to watch next, as rails of posters (the web's Discover page).
struct DiscoverHomeScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if let rails = model.discoverRails {
                if rails.isEmpty {
                    VStack(spacing: 16) {
                        SlateEmptyMessage(
                            title: "Discover is not loading",
                            message: "Check your connection and try again."
                        )
                        SlateSecondaryButton("Try again") {
                            Task { await model.loadDiscover(force: true) }
                        }
                        .frame(width: 160)
                    }
                    .padding(.horizontal, 24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 28) {
                            ForEach(rails) { rail in
                                DiscoverRailRow(rail: rail)
                            }
                        }
                        .padding(.top, 4)
                        .padding(.bottom, 16)
                    }
                    .refreshable { await model.loadDiscover(force: true) }
                    .slateArrive(on: rails.count)
                }
            } else {
                DiscoverPlaceholder()
            }
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .task { await model.loadDiscover(force: model.discoverRails?.isEmpty == true) }
    }
}

private struct DiscoverRailRow: View {
    @EnvironmentObject private var model: AppModel
    let rail: DiscoverRail

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(rail.title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, SlateMetrics.gutter)
                .accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: SlateMetrics.posterGap) {
                    ForEach(rail.items) { item in
                        NavigationLink {
                            DiscoverTitleView(mediaType: item.mediaType, tmdbId: item.tmdbId)
                        } label: {
                            RailPoster(item: item, saved: item.saved || model.hasSaved(item))
                                .frame(width: 116)
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                }
                .padding(.horizontal, SlateMetrics.gutter)
            }
        }
    }
}

/// The shape of Discover while it loads: the rails' own layout, held in place.
private struct DiscoverPlaceholder: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 12) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(SlatePalette.fill)
                        .frame(width: 148, height: 18)
                    HStack(spacing: SlateMetrics.posterGap) {
                        ForEach(0..<8, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: SlateMetrics.posterCorner)
                                .fill(SlatePalette.fill)
                                .frame(width: 116, height: 174)
                        }
                    }
                }
                .padding(.leading, SlateMetrics.gutter)
            }
        }
        .padding(.top, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .clipped()
        .accessibilityLabel("Loading Discover")
    }
}

/// A list made by Slate, opened from a s1ate.space/l/<slug> link: its name, why
/// it exists, one action across the full width, and the posters.
struct CuratedListScreen: View {
    @EnvironmentObject private var model: AppModel
    let slug: String
    let onClose: () -> Void
    let onOpenLists: () -> Void

    @State private var list: CuratedList?
    @State private var failed = false
    @State private var saving = false
    @State private var saved = false

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                Group {
                    if failed {
                        SlateEmptyMessage(
                            title: "That list is no longer here",
                            message: "It may have been renamed or taken down."
                        )
                        .padding(.horizontal, 24)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let list {
                        content(list, width: proxy.size.width)
                    } else {
                        Color.clear
                    }
                }
            }
            .background(SlatePalette.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: onClose) { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
        }
        .tint(.white)
        .preferredColorScheme(.dark)
        .task(id: slug) {
            do { list = try await model.curatedList(slug: slug) }
            catch { failed = true }
        }
    }

    private func content(_ list: CuratedList, width: CGFloat) -> some View {
        let everySaved = saved || list.titles.allSatisfy { $0.saved }
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(list.name)
                    .font(.system(size: 34, weight: .semibold))
                    .tracking(-1)
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("A list by \(list.curator)")
                    .font(.system(size: 14))
                    .foregroundStyle(SlatePalette.accent)
                    .padding(.top, 6)
                if let description = list.description,
                   !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(description)
                        .font(.system(size: 16))
                        .lineSpacing(5)
                        .foregroundStyle(.white.opacity(0.66))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 12)
                }
                SlatePrimaryButton(
                    saving ? "Adding" : saved ? "On your slate. Open your lists" : "Add to your slate",
                    enabled: !saving
                ) {
                    if saved { onOpenLists() } else { add() }
                }
                .padding(.top, 24)
                .padding(.bottom, 14)

                LazyVGrid(columns: SlateMetrics.posterColumns(for: width), spacing: SlateMetrics.posterGap) {
                    ForEach(list.titles) { item in
                        NavigationLink {
                            DiscoverTitleView(mediaType: item.mediaType, tmdbId: item.tmdbId)
                        } label: {
                            RailPoster(item: item, saved: everySaved || item.saved)
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                }
            }
            .padding(.horizontal, SlateMetrics.gutter)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .slateArrive(on: list.slug)
    }

    private func add() {
        saving = true
        Task {
            do {
                _ = try await model.addCuratedList(slug: slug)
                saved = true
            } catch {
                model.presentedError = error.localizedDescription
            }
            saving = false
        }
    }
}
