import SwiftUI
import UniformTypeIdentifiers

/// Importing watch history (`components/import-experience.tsx`): a Letterboxd,
/// IMDb or Trakt CSV, read on the server, then brought in a batch at a time
/// while the posters arrive as a wall behind the count.
struct ImportHistoryView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let onOpenLibrary: () -> Void

    private enum Phase: Equatable {
        case idle(error: String?)
        case reading
        case ready(file: String, rows: [ImportRow])
        case importing(file: String, rows: [ImportRow])
        case stopped(file: String, rows: [ImportRow], at: Int, error: String)
        case done(file: String, rows: [ImportRow])
    }

    private static let batchSize = 24

    @State private var phase: Phase = .idle(error: nil)
    @State private var picking = false
    @State private var processed = 0
    @State private var matched: [ImportedTitle] = []
    @State private var unmatched: [String] = []
    @State private var matching: [String] = []

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomLeading) {
                SlatePalette.background.ignoresSafeArea()
                wall
                LinearGradient(
                    colors: [SlatePalette.background.opacity(0), SlatePalette.background.opacity(0.85), SlatePalette.background],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 420)
                .frame(maxHeight: .infinity, alignment: .bottom)
                .allowsHitTesting(false)
                .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Spacer(minLength: 220)
                        panel
                        if case .idle = phase { exportHelp }
                        if case .done = phase, !unmatched.isEmpty { unmatchedNote }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
            .navigationTitle("Import your watch history")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                        .disabled(isImporting)
                }
            }
        }
        .tint(SlatePalette.text)
        .interactiveDismissDisabled(isImporting)
        .fileImporter(isPresented: $picking, allowedContentTypes: [.commaSeparatedText, .plainText, .text]) { result in
            if case .success(let url) = result { Task { await read(url) } }
        }
    }

    private var isImporting: Bool {
        if case .importing = phase { return true }
        return false
    }

    // MARK: The wall

    /// Every matched poster, newest first, filling the screen behind the count.
    private var wall: some View {
        GeometryReader { proxy in
            let columns = 5
            let gap: CGFloat = 8
            let width = (proxy.size.width - gap * CGFloat(columns + 1)) / CGFloat(columns)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(width), spacing: gap), count: columns), spacing: gap) {
                ForEach(matched.reversed().prefix(60)) { title in
                    PosterFrame(url: title.posterURL, title: title.title, corner: 8)
                        .transition(.opacity.combined(with: .scale(scale: 0.92)))
                }
            }
            .padding(gap)
            .rotation3DEffect(.degrees(isImporting ? 12 : 8), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .opacity(0.55)
            .animation(.smooth(duration: 0.4), value: matched.count)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    // MARK: The panel

    @ViewBuilder
    private var panel: some View {
        switch phase {
        case .idle(let error):
            VStack(alignment: .leading, spacing: 12) {
                Text("Bring your history.")
                    .font(.system(size: 40, weight: .semibold))
                    .tracking(-1.4)
                    .foregroundStyle(SlatePalette.text)
                Text("Your Letterboxd, IMDb or Trakt export. Every title lands on your slate, posters and all.")
                    .font(.system(size: 16))
                    .foregroundStyle(SlatePalette.mutedText)
                if let error {
                    Text(error).font(.system(size: 14)).foregroundStyle(SlatePalette.danger)
                }
                SlatePrimaryButton("Choose a CSV") { picking = true }
                    .padding(.top, 12)
            }
        case .reading:
            HStack(spacing: 10) {
                ProgressView().tint(SlatePalette.mutedText)
                Text("We’ll read it right here.").foregroundStyle(SlatePalette.mutedText)
            }
        case .ready(let file, let rows):
            VStack(alignment: .leading, spacing: 0) {
                numeral(rows.count)
                (Text("titles in ") + Text(file).foregroundColor(SlatePalette.text))
                    .font(.system(size: 16))
                    .foregroundStyle(SlatePalette.mutedText)
                    .lineLimit(1)
                    .padding(.top, 10)
                HStack(spacing: 8) {
                    SlatePrimaryButton("Bring them in") { Task { await run(file: file, rows: rows, from: 0) } }
                    SlateSecondaryButton("Another file") { picking = true }
                }
                .padding(.top, 22)
            }
        case .importing(_, let rows):
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    numeral(matched.count)
                    Text("of \(rows.count)").font(.system(size: 18)).foregroundStyle(SlatePalette.mutedText).monospacedDigit()
                }
                Text(matching.isEmpty ? "Matching…" : "Matching \(matching.joined(separator: ", "))…")
                    .font(.system(size: 16))
                    .foregroundStyle(SlatePalette.mutedText)
                    .lineLimit(1)
                    .padding(.top, 10)
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(SlatePalette.text.opacity(0.1))
                        Rectangle().fill(SlatePalette.accent)
                            .frame(width: proxy.size.width * CGFloat(processed) / CGFloat(max(rows.count, 1)))
                            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.7), value: processed)
                    }
                }
                .frame(height: 1)
                .padding(.top, 22)
            }
        case .stopped(let file, let rows, let at, let error):
            VStack(alignment: .leading, spacing: 0) {
                numeral(matched.count)
                Text("Stopped at \(at) of \(rows.count). Everything above is saved.")
                    .font(.system(size: 16))
                    .foregroundStyle(SlatePalette.mutedText)
                    .padding(.top, 10)
                Text(error).font(.system(size: 14)).foregroundStyle(SlatePalette.danger).lineLimit(1).padding(.top, 4)
                HStack(spacing: 8) {
                    SlatePrimaryButton("Carry on") { Task { await run(file: file, rows: rows, from: at) } }
                    SlateSecondaryButton("Start over") { reset() }
                }
                .padding(.top, 22)
            }
        case .done:
            VStack(alignment: .leading, spacing: 0) {
                numeral(matched.count)
                Text(matched.count == 1 ? "title is on your slate." : "titles are on your slate.")
                    .font(.system(size: 16))
                    .foregroundStyle(SlatePalette.mutedText)
                    .padding(.top, 10)
                HStack(spacing: 8) {
                    SlatePrimaryButton("Open library") {
                        dismiss()
                        onOpenLibrary()
                    }
                    SlateSecondaryButton("Import another") { reset() }
                }
                .padding(.top, 22)
            }
        }
    }

    private func numeral(_ value: Int) -> some View {
        Text(value.formatted())
            .font(.system(size: 76, weight: .semibold))
            .tracking(-3.5)
            .monospacedDigit()
            .foregroundStyle(SlatePalette.text)
            .contentTransition(.numericText(value: Double(value)))
            .animation(.smooth(duration: 0.3), value: value)
    }

    private var exportHelp: some View {
        VStack(alignment: .leading, spacing: 18) {
            help("Export from Letterboxd", "Settings, Data, Export your data. Unzip it and use watched.csv.")
            help("Export from IMDb", "Your ratings, the ⋯ menu, Export. Use the CSV it sends.")
            help("Export from Trakt", "Settings, Exports. Request a CSV of your watched history.")
        }
        .padding(.top, 40)
    }

    private func help(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(SlatePalette.text)
            Text(body).font(.system(size: 14)).foregroundStyle(SlatePalette.mutedText)
        }
    }

    private var unmatchedNote: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(unmatched.prefix(120), id: \.self) { row in
                    Text(row).font(.system(size: 13)).foregroundStyle(SlatePalette.mutedText)
                }
            }
            .padding(.top, 8)
        } label: {
            Text("\(unmatched.count) \(unmatched.count == 1 ? "row" : "rows") couldn’t be matched")
                .font(.system(size: 14))
                .foregroundStyle(SlatePalette.mutedText)
        }
        .tint(SlatePalette.mutedText)
        .padding(.top, 28)
    }

    // MARK: Work

    private func read(_ url: URL) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            phase = .idle(error: "That file couldn't be opened.")
            return
        }
        guard data.count <= 5 * 1024 * 1024 else {
            phase = .idle(error: "That file is over 5 MB. Split it and import each part.")
            return
        }
        phase = .reading
        do {
            let rows = try await model.parseImport(data)
            phase = rows.isEmpty
                ? .idle(error: "No titles in that file. Use a CSV with a Title or Name column.")
                : .ready(file: url.lastPathComponent, rows: rows)
        } catch {
            phase = .idle(error: error.localizedDescription)
        }
    }

    private func run(file: String, rows: [ImportRow], from start: Int) async {
        phase = .importing(file: file, rows: rows)
        processed = start
        var at = start
        while at < rows.count {
            let slice = Array(rows[at..<min(at + Self.batchSize, rows.count)])
            matching = slice.prefix(3).map(\.title)
            var result = try? await model.importBatch(slice)
            if result == nil { result = try? await model.importBatch(slice) }
            guard let result else {
                phase = .stopped(file: file, rows: rows, at: at, error: "The connection dropped.")
                matching = []
                return
            }
            let known = Set(matched.map(\.id))
            matched.append(contentsOf: result.titles.filter { !known.contains($0.id) })
            unmatched.append(contentsOf: result.unmatched)
            at += slice.count
            processed = at
        }
        matching = []
        phase = .done(file: file, rows: rows)
        await model.refreshLibrary()
    }

    private func reset() {
        phase = .idle(error: nil)
        processed = 0
        matched = []
        unmatched = []
    }
}
