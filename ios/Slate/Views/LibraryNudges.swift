import SwiftUI

// The prompts above the shelf, as on the web (lib/library-nudges.ts):
// - a show you are watching has a new episode out;
// - under five titles: the fastest ways to a library worth having;
// - ten titles and no list yet: a first list made from what is saved.

private let smallLibraryTitles = 5
private let listSuggestionTitles = 10
private let hiddenPromptsKey = "slate-library-prompts.hidden"

struct ListSuggestion: Equatable {
    let name: String
    let titleIds: [String]
    let posters: [URL]
}

/// The genre with the most titles still to watch, so the list is something to
/// pick from.
func suggestList(_ titles: [SlateTitle]) -> ListSuggestion? {
    guard titles.count >= listSuggestionTitles else { return nil }
    let unwatched = titles.filter { $0.status == .want || $0.status == .watching }
    let pool = unwatched.count >= 4 ? unwatched : titles
    var order: [String] = []
    var byGenre: [String: [SlateTitle]] = [:]
    for title in pool {
        for genre in title.genres ?? [] where !genre.name.trimmingCharacters(in: .whitespaces).isEmpty {
            if byGenre[genre.name] == nil { order.append(genre.name) }
            byGenre[genre.name, default: []].append(title)
        }
    }
    // The first genre met wins a tie.
    var best: String?
    for name in order where (byGenre[name]?.count ?? 0) > (best.flatMap { byGenre[$0]?.count } ?? 0) {
        best = name
    }
    guard let best, let group = byGenre[best], group.count >= 4 else { return nil }
    let picked = Array(group.prefix(12))
    return ListSuggestion(
        name: "\(best.replacingOccurrences(of: " & ", with: " and ")) night",
        titleIds: picked.map(\.id),
        posters: picked.compactMap(\.posterPath).prefix(4).compactMap {
            URL(string: "https://image.tmdb.org/t/p/w185\($0)")
        }
    )
}

/// "out today", "out yesterday", a weekday within the week, else "out 3 Nov".
func airedLabel(_ airDate: String, today: Date = .now) -> String {
    let parser = DateFormatter()
    parser.calendar = Calendar(identifier: .gregorian)
    parser.locale = Locale(identifier: "en_US_POSIX")
    parser.dateFormat = "yyyy-MM-dd"
    guard let aired = parser.date(from: String(airDate.prefix(10))) else { return "" }
    let calendar = Calendar.current
    let days = calendar.dateComponents(
        [.day],
        from: calendar.startOfDay(for: aired),
        to: calendar.startOfDay(for: today)
    ).day ?? 0
    if days <= 0 { return "out today" }
    if days == 1 { return "out yesterday" }
    let formatter = DateFormatter()
    formatter.dateFormat = days < 7 ? "EEE" : "d MMM"
    return "out \(formatter.string(from: aired))"
}

struct LibraryNudges: View {
    @EnvironmentObject private var model: AppModel
    let titles: [SlateTitle]
    let newEpisodes: [NewEpisode]
    let hasLists: Bool
    let onAdd: () -> Void
    let onAddFromLink: () -> Void

    @State private var hidden = Set(UserDefaults.standard.stringArray(forKey: hiddenPromptsKey) ?? [])
    @State private var creating = false
    @State private var createError = false

    var body: some View {
        let remaining = smallLibraryTitles - titles.count
        let showSmall = !titles.isEmpty && remaining > 0 && !hidden.contains("small")
        let suggestion = hasLists || hidden.contains("list") ? nil : suggestList(titles)
        let episodes = newEpisodes.filter { item in titles.contains { $0.id == item.titleId } }

        if !episodes.isEmpty || showSmall || suggestion != nil {
            VStack(alignment: .leading, spacing: 12) {
                if !episodes.isEmpty {
                    newEpisodesRow(episodes)
                }

                if showSmall {
                    NudgeCard(
                        heading: "\(remaining) more and Slate gets to know your taste",
                        message: "Recommendations learn from what you save. Search for a few, or pull them in from a link.",
                        onDismiss: { hide("small") }
                    ) {
                        LibrarySlots(posterPaths: titles.prefix(smallLibraryTitles).map(\.posterPath), count: titles.count)
                    } actions: {
                        SlatePrimaryButton("Find titles", action: onAdd)
                        SlateSecondaryButton("Add from a link", action: onAddFromLink)
                    }
                }

                if let suggestion {
                    NudgeCard(
                        heading: "Make \(suggestion.name) your first list",
                        message: createError
                            ? "That list could not be made. Try once more."
                            : "\(suggestion.titleIds.count) titles you saved, ready to share with whoever you watch with.",
                        messageIsError: createError,
                        onDismiss: { if !creating { hide("list") } }
                    ) {
                        HStack(spacing: 6) {
                            ForEach(suggestion.posters, id: \.self) { NudgeThumb(url: $0) }
                            let more = suggestion.titleIds.count - suggestion.posters.count
                            if more > 0 {
                                Text("+\(more)")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(SlatePalette.mutedText)
                                    .frame(width: 48, height: 72)
                                    .background(.white.opacity(0.06), in: .rect(cornerRadius: 8))
                            }
                        }
                    } actions: {
                        SlatePrimaryButton(creating ? "Making it…" : "Make this list", enabled: !creating) {
                            make(suggestion)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 20)
        }
    }

    private func newEpisodesRow(_ episodes: [NewEpisode]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("New episodes")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
            // The row runs to both screen edges; its first poster lines up with the grid.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(episodes) { item in
                        let aired = airedLabel(item.airDate)
                        NavigationLink {
                            if let title = titles.first(where: { $0.id == item.titleId }) {
                                TitleDetailView(title: title)
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 0) {
                                PosterFrame(url: item.posterURL, title: item.title)
                                Text(item.title)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .padding(.top, 6)
                                (Text("S\(item.season) E\(item.episode)")
                                    .fontWeight(.semibold)
                                    .foregroundColor(SlatePalette.accent)
                                    + Text(" \(aired)").foregroundColor(SlatePalette.mutedText))
                                    .font(.system(size: 11))
                                    .lineLimit(1)
                            }
                            .frame(width: 112, alignment: .leading)
                        }
                        .buttonStyle(SlatePressStyle())
                        .accessibilityLabel("\(item.title), season \(item.season) episode \(item.episode), \(aired)")
                    }
                }
                .padding(.horizontal, SlateMetrics.gutter)
            }
            .padding(.horizontal, -SlateMetrics.gutter)
        }
    }

    private func hide(_ kind: String) {
        withAnimation(.easeOut(duration: 0.2)) { _ = hidden.insert(kind) }
        UserDefaults.standard.set(Array(hidden), forKey: hiddenPromptsKey)
    }

    private func make(_ suggestion: ListSuggestion) {
        creating = true
        createError = false
        Task {
            do {
                try await model.createListFromTitles(name: suggestion.name, titleIds: suggestion.titleIds)
                hide("list")
            } catch {
                createError = true
            }
            creating = false
        }
    }
}

/// The frame every Library prompt shares (DESIGN.md, Interaction): the close
/// button pinned to the top-right corner with the text kept clear of it, and
/// the actions in one row of equal widths, a single action taking the row.
private struct NudgeCard<Top: View, Actions: View>: View {
    let heading: String
    let message: String
    var messageIsError = false
    let onDismiss: () -> Void
    @ViewBuilder let top: () -> Top
    @ViewBuilder let actions: () -> Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                top()
                Text(heading)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
                    .accessibilityAddTraits(.isHeader)
                Text(message)
                    .font(.system(size: 14))
                    .lineSpacing(3)
                    .foregroundStyle(messageIsError ? SlatePalette.danger : SlatePalette.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }
            .padding(.trailing, 36)

            HStack(spacing: 8) { actions() }
                .padding(.top, 16)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SlatePalette.surface.opacity(0.6), in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.border, lineWidth: 1) }
        .overlay(alignment: .topTrailing) {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(SlatePalette.mutedText)
                    .frame(width: 44, height: 44)
                    .contentShape(.rect)
            }
            .buttonStyle(SlatePressStyle())
            .padding(6)
            .accessibilityLabel("Hide this")
        }
        .frame(maxWidth: 520, alignment: .leading)
        .slateArrive(on: 0)
    }
}

private struct NudgeThumb: View {
    let url: URL?

    var body: some View {
        PosterFrame(url: url, title: "", corner: 8)
            .frame(width: 48, height: 72)
    }
}

/// The five slots of a library worth having: what is saved, then the places
/// still to fill.
private struct LibrarySlots: View {
    let posterPaths: [String?]
    let count: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<smallLibraryTitles, id: \.self) { index in
                if index < count {
                    NudgeThumb(url: path(at: index).flatMap { URL(string: "https://image.tmdb.org/t/p/w185\($0)") })
                } else {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(.white.opacity(0.16), lineWidth: 1)
                        .frame(width: 48, height: 72)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of \(smallLibraryTitles) titles saved")
    }

    private func path(at index: Int) -> String? {
        index < posterPaths.count ? posterPaths[index] : nil
    }
}
