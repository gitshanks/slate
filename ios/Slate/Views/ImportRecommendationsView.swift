import SwiftUI

/// Add from a link: paste a post, video, article or list and Slate finds the
/// films and series in it. Opened from search and from the share extension.
struct ImportRecommendationsView: View {
    @EnvironmentObject private var model: AppModel
    let initialText: String?
    let onClose: () -> Void

    @State private var text: String
    @State private var resolution: SharedLinkResolution?
    @State private var resolving = false
    @State private var added = Set<String>()
    @State private var adding = Set<String>()
    @State private var failure: String?
    @FocusState private var fieldFocused: Bool

    init(initialText: String?, onClose: @escaping () -> Void) {
        self.initialText = initialText
        self.onClose = onClose
        _text = State(initialValue: initialText ?? "")
    }

    private var hasText: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        let candidates = resolution?.candidates ?? []
        let pending = candidates.filter { !isSaved($0) }

        NavigationStack {
            GeometryReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        if !candidates.isEmpty {
                            LazyVGrid(
                                columns: SlateMetrics.posterColumns(for: proxy.size.width),
                                spacing: SlateMetrics.posterGap
                            ) {
                                ForEach(candidates) { candidate in
                                    poster(candidate)
                                }
                            }
                            .slateArrive(on: candidates.map(\.id))
                        }
                    }
                    .padding(.horizontal, SlateMetrics.gutter)
                    .padding(.top, 20)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !candidates.isEmpty {
                    SlatePrimaryButton(
                        pending.isEmpty ? "All on your slate. Done"
                            : pending.count == 1 ? "Add 1 title"
                            : "Add all \(pending.count) titles"
                    ) {
                        if pending.isEmpty { onClose() } else { Task { for item in pending { await add(item) } } }
                    }
                    .padding(.horizontal, SlateMetrics.gutter)
                    .padding(.top, 8)
                    .padding(.bottom, 12)
                    .background(SlatePalette.background)
                }
            }
            .background(SlatePalette.background)
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.white)
        .preferredColorScheme(.dark)
        .task {
            if initialText?.isEmpty == false, resolution == nil { await resolve() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlateScreenTitle(title: "Add from a link") {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(SlatePressStyle())
                .padding(.trailing, -12)
                .accessibilityLabel("Close")
            }
            Text("Paste a post, video, article or list. Slate finds the films and series mentioned in it.")
                .font(.system(size: 14))
                .lineSpacing(3)
                .foregroundStyle(SlatePalette.mutedText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)

            HStack(spacing: 8) {
                TextField(
                    "",
                    text: $text,
                    prompt: Text("Paste a link").foregroundColor(SlatePalette.mutedText)
                )
                .font(.system(size: 15))
                .foregroundStyle(.white)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($fieldFocused)
                .onSubmit { Task { await resolve() } }

                Button {
                    Task { await resolve() }
                } label: {
                    Group {
                        if resolving {
                            ProgressView().tint(SlatePalette.onAccent)
                        } else {
                            Text("Find").font(.system(size: 14, weight: .semibold))
                        }
                    }
                    .foregroundStyle(SlatePalette.onAccent)
                    .padding(.horizontal, 16)
                    .frame(minWidth: 72)
                    .frame(height: 44)
                    .background(SlatePalette.accent.opacity(hasText ? 1 : 0.35), in: .capsule)
                    .contentShape(.capsule)
                }
                .buttonStyle(SlatePressStyle())
                .disabled(!hasText || resolving)
            }
            .padding(.leading, 18)
            .padding(.trailing, 4)
            .frame(height: 52)
            .background(SlatePalette.fill, in: .capsule)
            .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
            .padding(.top, 16)

            if let failure {
                Text(failure)
                    .font(.system(size: 13))
                    .foregroundStyle(SlatePalette.danger)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
            }

            if let resolution {
                let source = resolution.source.title ?? resolution.source.hostname
                let count = resolution.candidates.count
                Text(
                    count == 0 ? "Nothing found in that link."
                        : source.map { "\(count) found in \($0)" } ?? "\(count) found"
                )
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .padding(.top, 24)
                if let warning = resolution.warning {
                    Text(warning)
                        .font(.system(size: 13))
                        .lineSpacing(2)
                        .foregroundStyle(SlatePalette.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
            }
        }
        .padding(.bottom, 10)
    }

    /// Each poster carries its own state: a plus until it is saved, then a tick.
    @ViewBuilder
    private func poster(_ candidate: SharedLinkCandidate) -> some View {
        let saved = isSaved(candidate)
        let frame = PosterFrame(url: candidate.posterURL, title: candidate.title) {
            Image(systemName: saved ? "checkmark" : "plus")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(saved ? SlatePalette.onAccent : .white)
                .frame(width: 24, height: 24)
                .background(saved ? SlatePalette.accent : .black.opacity(0.62), in: .circle)
                .padding(6)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        .opacity(adding.contains(candidate.id) ? 0.6 : 1)

        if saved {
            NavigationLink {
                DiscoverTitleView(mediaType: candidate.mediaType, tmdbId: candidate.tmdbId)
            } label: { frame }
                .buttonStyle(SlatePressStyle())
                .accessibilityLabel("\(candidate.title), on your slate")
        } else {
            Button { Task { await add(candidate) } } label: { frame }
                .buttonStyle(SlatePressStyle())
                .accessibilityLabel("Add \(candidate.title)")
        }
    }

    private func isSaved(_ candidate: SharedLinkCandidate) -> Bool {
        candidate.inLibrary || added.contains(candidate.id)
    }

    private func resolve() async {
        guard hasText, !resolving else { return }
        fieldFocused = false
        resolving = true
        failure = nil
        do { resolution = try await model.resolveSharedText(text) }
        catch { failure = error.localizedDescription }
        resolving = false
    }

    private func add(_ candidate: SharedLinkCandidate) async {
        guard !isSaved(candidate), !adding.contains(candidate.id) else { return }
        adding.insert(candidate.id)
        do {
            _ = try await model.addCatalogTitle(tmdbId: candidate.tmdbId, mediaType: candidate.mediaType)
            withAnimation(.smooth) { _ = added.insert(candidate.id) }
        } catch {
            failure = error.localizedDescription
        }
        adding.remove(candidate.id)
    }
}
