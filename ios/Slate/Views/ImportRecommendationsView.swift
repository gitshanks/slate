import SwiftUI

struct ImportRecommendationsView: View {
    @EnvironmentObject private var model: AppModel
    let initialText: String?
    @Binding var showProfile: Bool
    @State private var text: String
    @State private var resolution: SharedLinkResolution?
    @State private var resolving = false
    @State private var added = Set<String>()

    init(initialText: String?, showProfile: Binding<Bool>) {
        self.initialText = initialText
        _showProfile = showProfile
        _text = State(initialValue: initialText ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SlateSectionHeader(eyebrow: "Import", title: "Bring it into slate")
                Text("Move recommendations from links or another service into your slate.")
                    .font(.subheadline).foregroundStyle(.secondary).lineSpacing(4)
                    .padding(.top, 10)

                Text("FROM ANYWHERE ON THE WEB")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)
                    .padding(.top, 34)
                Text("Add from a link")
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.7)
                    .padding(.top, 7)
                Text("Paste an Instagram, TikTok, YouTube, IMDb, Letterboxd, or article link. Slate finds the films and shows mentioned inside it.")
                    .font(.subheadline).foregroundStyle(.secondary).lineSpacing(4)
                    .padding(.top, 8)

                VStack(spacing: 12) {
                    TextEditor(text: $text)
                        .frame(minHeight: 104)
                        .scrollContentBackground(.hidden)
                        .padding(12)
                        .background(.black.opacity(0.24), in: .rect(cornerRadius: 13))
                        .overlay { RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.1), lineWidth: 0.7) }
                        .overlay(alignment: .topLeading) {
                            if text.isEmpty {
                                Text("Paste a link or recommendation text")
                                    .foregroundStyle(.tertiary).padding(.top, 17).padding(.leading, 17)
                                    .allowsHitTesting(false)
                            }
                        }

                    Button {
                        Task { await resolve() }
                    } label: {
                        HStack {
                            if resolving { ProgressView().tint(.black) }
                            else { Image(systemName: "sparkles") }
                            Text(resolving ? "Finding titles…" : "Find titles")
                        }
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity).frame(height: 52)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.black)
                    .background(Color(red: 0.66, green: 0.52, blue: 1), in: .rect(cornerRadius: 16))
                    .disabled(resolving || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                }
                .padding(14)
                .background(SlatePalette.surface, in: .rect(cornerRadius: 18))
                .overlay { RoundedRectangle(cornerRadius: 18).stroke(SlatePalette.hairline, lineWidth: 0.7) }
                .padding(.top, 20)

                if let warning = resolution?.warning {
                    Text(warning).font(.caption).foregroundStyle(.orange.opacity(0.85)).padding(.top, 15)
                }
                if let resolution {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("FOUND \(resolution.candidates.count) \(resolution.candidates.count == 1 ? "TITLE" : "TITLES")")
                                .font(.caption.monospaced().weight(.semibold)).tracking(1.1).foregroundStyle(.secondary)
                            if let host = resolution.source.hostname { Text(host).font(.caption).foregroundStyle(.tertiary) }
                        }
                        Spacer()
                        Button("Add all") { Task { await addAll(resolution.candidates) } }
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.top, 34)

                    LazyVStack(spacing: 12) {
                        ForEach(resolution.candidates) { candidate in
                            ImportCandidateRow(
                                candidate: candidate,
                                added: candidate.inLibrary || added.contains(candidate.id),
                                onAdd: { Task { await add(candidate) } }
                            )
                        }
                    }
                    .padding(.top, 14)
                }
            }
            .padding(18)
            .padding(.bottom, 38)
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .task {
            if initialText?.isEmpty == false && resolution == nil { await resolve() }
        }
    }

    private func resolve() async {
        resolving = true
        do { resolution = try await model.resolveSharedText(text) }
        catch { model.presentedError = error.localizedDescription }
        resolving = false
    }

    private func add(_ candidate: SharedLinkCandidate) async {
        guard !candidate.inLibrary && !added.contains(candidate.id) else { return }
        do {
            _ = try await model.addCatalogTitle(tmdbId: candidate.tmdbId, mediaType: candidate.mediaType)
            withAnimation(.smooth) { _ = added.insert(candidate.id) }
        } catch { model.presentedError = error.localizedDescription }
    }

    private func addAll(_ candidates: [SharedLinkCandidate]) async {
        for candidate in candidates where !candidate.inLibrary && !added.contains(candidate.id) {
            await add(candidate)
        }
    }
}

private struct ImportCandidateRow: View {
    let candidate: SharedLinkCandidate
    let added: Bool
    let onAdd: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            AsyncImage(url: candidate.posterURL) { image in image.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.06) }
                .frame(width: 62, height: 93).clipShape(.rect(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 5) {
                Text(candidate.title).font(.headline).lineLimit(2)
                HStack(spacing: 6) {
                    Text(candidate.year ?? candidate.mediaType.rawValue.capitalized)
                    if let score = candidate.voteAverage, score > 0 { Text("·"); Text(String(format: "%.1f", score)) }
                }.font(.caption.monospaced()).foregroundStyle(.secondary)
                Text(candidate.sourceTitle).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
            }
            Spacer()
            Button(action: onAdd) {
                Image(systemName: added ? "checkmark" : "plus")
                    .font(.subheadline.bold())
                    .foregroundStyle(added ? .black : .white)
                    .frame(width: 38, height: 38)
                    .background(added ? .white.opacity(0.86) : Color.purple.opacity(0.3), in: .circle)
            }
            .disabled(added)
        }
        .padding(12)
        .background(.white.opacity(0.04), in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08), lineWidth: 0.7) }
    }
}
