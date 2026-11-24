import SwiftUI

/// Discover (`components/discover-default.tsx`): "Find what's next", then the
/// web's three rails, each poster named, with its type and year.
struct DiscoverHomeScreen: View {
    @EnvironmentObject private var model: AppModel

    /// The rails the web shows, in its order. The service rails of the native
    /// endpoint belong to the TV app.
    private static let webRails = ["recommended", "trending", "nowPlaying"]

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    SlateMonoLabel("Discover", size: 12)
                    Text("Find what’s next")
                        .font(.system(size: 30, weight: .semibold))
                        .tracking(-0.8)
                        .foregroundStyle(SlatePalette.text)
                        .padding(.top, 4)
                        .accessibilityAddTraits(.isHeader)

                    if let rails = model.discoverRails {
                        let shown = rails.filter { Self.webRails.contains($0.id) }
                            .sorted { (Self.webRails.firstIndex(of: $0.id) ?? 9) < (Self.webRails.firstIndex(of: $1.id) ?? 9) }
                        let visible = shown.isEmpty ? rails : shown
                        if visible.isEmpty {
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
                            .padding(.top, 80)
                            .frame(maxWidth: .infinity)
                        } else {
                            LazyVStack(alignment: .leading, spacing: 32) {
                                ForEach(visible) { rail in
                                    DiscoverRailRow(rail: rail, width: proxy.size.width)
                                }
                            }
                            .padding(.top, 32)
                            .slateArrive(on: visible.count)
                        }
                    } else {
                        DiscoverPlaceholder(width: proxy.size.width).padding(.top, 32)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 20)
                .padding(.bottom, 24)
            }
            .refreshable { await model.loadDiscover(force: true) }
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .task { await model.loadDiscover(force: model.discoverRails?.isEmpty == true) }
    }
}

/// Four posters fit the width of a phone, as in the Library.
private func railPosterWidth(_ width: CGFloat) -> CGFloat {
    width < 640 ? (width - 24 - 24) / 4 : 150
}

private struct DiscoverRailRow: View {
    @EnvironmentObject private var model: AppModel
    let rail: DiscoverRail
    let width: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(rail.title)
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.4)
                .foregroundStyle(SlatePalette.text)
                .accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 8) {
                    ForEach(rail.items) { item in
                        NavigationLink {
                            DiscoverTitleView(mediaType: item.mediaType, tmdbId: item.tmdbId)
                        } label: {
                            LabeledPoster(
                                url: item.posterURL,
                                title: item.title,
                                leading: item.mediaType == .movie ? "Film" : "Series",
                                trailing: item.releaseDate.map { String($0.prefix(4)) },
                                saved: item.saved || model.hasSaved(item)
                            )
                            .frame(width: railPosterWidth(width))
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                }
            }
            .padding(.horizontal, -12)
            .contentMargins(.horizontal, 12, for: .scrollContent)
        }
    }
}

/// The shape of Discover while it loads: the rails' own layout, held in place.
private struct DiscoverPlaceholder: View {
    let width: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 16) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(SlatePalette.fill)
                        .frame(width: 200, height: 22)
                    HStack(spacing: 8) {
                        ForEach(0..<6, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: SlateMetrics.posterCorner)
                                .fill(SlatePalette.fill)
                                .frame(width: railPosterWidth(width), height: railPosterWidth(width) * 1.5)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .clipped()
        .accessibilityLabel("Loading Discover")
    }
}

/// A list made by Slate (`components/public-list-view.tsx`), opened from a
/// s1ate.space/l/<slug> link: a still across the top with the name over it,
/// the list's words, then the films ranked, each with a large faint number
/// half behind its poster and the line the list gives it.
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
            Group {
                if failed {
                    SlateEmptyMessage(
                        title: "That list is no longer here",
                        message: "It may have been renamed or taken down."
                    )
                    .padding(.horizontal, 24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let list {
                    content(list)
                } else {
                    Color.clear
                }
            }
            .background(SlatePalette.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: onClose) { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
                if list != nil {
                    ToolbarItem(placement: .primaryAction) { addButton }
                }
            }
        }
        .tint(SlatePalette.text)
        .task(id: slug) {
            do { list = try await model.curatedList(slug: slug) }
            catch { failed = true }
        }
    }

    /// The page's one action: a quiet pill in the top bar.
    private var addButton: some View {
        Button {
            if saved { onOpenLists() } else { add() }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: saved ? "checkmark" : "plus").font(.system(size: 12, weight: .semibold))
                Text(saving ? "Adding…" : saved ? "On your slate" : "Add to your slate")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(SlatePalette.accent)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(SlatePalette.background.opacity(0.55), in: .capsule)
            .overlay { Capsule().stroke(SlatePalette.accent.opacity(0.35), lineWidth: 1) }
        }
        .buttonStyle(SlatePressStyle())
        .disabled(saving)
    }

    private func content(_ list: CuratedList) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    CachedAsyncImage(url: list.heroURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        SlatePalette.placeholder
                    }
                    .frame(height: 340)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    LinearGradient(
                        colors: [SlatePalette.background.opacity(0), SlatePalette.background.opacity(0.35), SlatePalette.background],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    Text(list.name)
                        .font(.system(size: 40, weight: .bold))
                        .tracking(-1.4)
                        .foregroundStyle(SlatePalette.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 4)
                }
                .frame(height: 340)

                if let description = list.description,
                   !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(description)
                        .font(.system(size: 16))
                        .lineSpacing(5)
                        .foregroundStyle(SlatePalette.text.opacity(0.6))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 20)
                        .padding(.top, 10)
                }

                VStack(spacing: 4) {
                    ForEach(Array(list.titles.enumerated()), id: \.element.id) { index, item in
                        NavigationLink {
                            CatalogDestinationByID(mediaType: item.mediaType, tmdbId: item.tmdbId)
                        } label: {
                            RankedRow(rank: index + 1, item: item)
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                if let note = list.note {
                    Text(note)
                        .font(.system(size: 13))
                        .foregroundStyle(SlatePalette.text.opacity(0.6))
                        .padding(.horizontal, 20)
                        .padding(.top, 28)
                }
            }
            .padding(.bottom, 40)
        }
        .ignoresSafeArea(edges: .top)
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

/// One film on a ranked list.
private struct RankedRow: View {
    let rank: Int
    let item: DiscoverRailItem

    var body: some View {
        HStack(spacing: 14) {
            // The rank: very large and faint, right-aligned so the poster
            // covers about half of it.
            Text("\(rank)")
                .font(.system(size: 76, weight: .heavy))
                .tracking(-4.5)
                .monospacedDigit()
                .foregroundStyle(SlatePalette.text.opacity(0.13))
                .fixedSize()
                .frame(width: 14, alignment: .trailing)
                .offset(x: rank >= 10 ? 44 : 30)
                .zIndex(0)
            PosterFrame(url: item.posterURL, title: item.title, corner: 8)
                .frame(width: 50, height: 75)
                .zIndex(1)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.2)
                    .foregroundStyle(SlatePalette.text)
                    .lineLimit(2)
                if let line = item.line {
                    Text(line)
                        .font(.system(size: 13))
                        .foregroundStyle(SlatePalette.text.opacity(0.6))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if let value = item.value {
                Text(value)
                    .font(.system(size: 46, weight: .light))
                    .tracking(-2.3)
                    .monospacedDigit()
                    .foregroundStyle(SlatePalette.accent)
            }
        }
        .frame(height: 92)
        .contentShape(.rect)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(rank). \(item.title)\(item.value.map { ", \($0)" } ?? "")")
    }
}
