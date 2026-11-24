import SwiftUI
import WebKit

/// Previews (`/previews` on the web): one trailer per screen, swiped up and
/// down. Each says why it is here, then the name, year, type, genre and score,
/// and its actions: Up Next, add to a list, details, pause and sound.
struct PreviewsScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var items: [PreviewItem] = []
    @State private var current: String?
    @State private var batch = 0
    @State private var loadingMore = false
    @State private var failed = false
    @State private var playing = true
    @State private var muted = true
    @State private var detail: PreviewItem?
    @State private var seed = UUID().uuidString.replacingOccurrences(of: "-", with: "")

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                SlatePalette.background.ignoresSafeArea()
                if items.isEmpty {
                    if failed {
                        SlateEmptyMessage(title: "Previews didn't load", message: "Check your connection, then try again.")
                            .overlay(alignment: .bottom) {
                                SlateSecondaryButton("Try again") { Task { await load() } }
                                    .frame(width: 160)
                                    .offset(y: 70)
                            }
                    } else {
                        ProgressView().tint(SlatePalette.mutedText)
                    }
                } else {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 0) {
                            ForEach(items) { item in
                                PreviewSlide(
                                    item: item,
                                    active: current == item.id,
                                    playing: playing,
                                    muted: muted,
                                    onTogglePlay: { playing.toggle() },
                                    onToggleSound: { muted.toggle() },
                                    onDetails: { detail = item }
                                )
                                .frame(width: proxy.size.width, height: proxy.size.height)
                                .id(item.id)
                                .onAppear { if item.id == items.last?.id { Task { await load() } } }
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)
                    .scrollPosition(id: $current)
                    .scrollIndicators(.hidden)
                    .ignoresSafeArea(edges: .top)
                }
            }
        }
        .task { if items.isEmpty { await load() } }
        .sheet(item: $detail) { item in
            NavigationStack {
                CatalogDestinationByID(mediaType: item.mediaType, tmdbId: item.tmdbId)
            }
        }
    }

    private func load() async {
        guard !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        do {
            let saved = model.titles.map { "\($0.mediaType.rawValue):\($0.tmdbId)" }
            let shown = items.map(\.key)
            let next = try await model.previews(seed: seed, batch: batch, exclude: shown + saved)
            let fresh = next.items.filter { item in !items.contains { $0.key == item.key } }
            items.append(contentsOf: fresh)
            batch += 1
            if current == nil { current = items.first?.id }
            failed = false
        } catch {
            failed = items.isEmpty
        }
    }
}

/// One trailer and its caption.
private struct PreviewSlide: View {
    @EnvironmentObject private var model: AppModel
    let item: PreviewItem
    let active: Bool
    let playing: Bool
    let muted: Bool
    let onTogglePlay: () -> Void
    let onToggleSound: () -> Void
    let onDetails: () -> Void
    @State private var adding = false
    @State private var listPicker: SlateTitle?

    private var saved: SlateTitle? {
        model.titles.first { $0.tmdbId == item.tmdbId && $0.mediaType == item.mediaType }
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 60)
            ZStack {
                CachedAsyncImage(url: item.backdropURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    SlatePalette.placeholder
                }
                if active {
                    PreviewPlayer(videoKey: item.videoKey, playing: playing, muted: muted)
                        .transition(.opacity)
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 22))
            .overlay { RoundedRectangle(cornerRadius: 22).stroke(SlatePalette.text.opacity(0.08), lineWidth: 1) }
            .padding(.horizontal, 8)
            .animation(.easeOut(duration: 0.3), value: active)

            Spacer(minLength: 24)

            VStack(alignment: .leading, spacing: 0) {
                if let label = item.sourceLabel {
                    SlateMonoLabel(label, color: SlatePalette.accent, size: 10)
                }
                Text(item.title)
                    .font(.system(size: 30, weight: .semibold))
                    .tracking(-1)
                    .foregroundStyle(SlatePalette.text)
                    .lineLimit(2)
                    .padding(.top, 8)
                HStack(spacing: 8) {
                    if let year = item.year { SlateMonoLabel(year, size: 10); SlateMonoLabel("·", size: 10) }
                    SlateMonoLabel(item.mediaType == .movie ? "Film" : "Series", size: 10)
                    if let genre = item.genreName { SlateMonoLabel("·", size: 10); SlateMonoLabel(genre, size: 10) }
                    if let score = item.voteAverage, score > 0 {
                        SlateMonoLabel("·", size: 10)
                        SlateMonoLabel(String(format: "%.1f", score), size: 10)
                    }
                }
                .padding(.top, 6)

                HStack(spacing: 8) {
                    saveControl
                    circleButton("text.badge.plus", label: "Add \(item.title) to a list") {
                        Task { await openListPicker() }
                    }
                    circleButton("info.circle", label: "View details for \(item.title)", action: onDetails)
                    Spacer(minLength: 0)
                    circleButton(playing ? "pause.fill" : "play.fill", label: playing ? "Pause previews" : "Play previews", quiet: true, action: onTogglePlay)
                    circleButton(muted ? "speaker.slash" : "speaker.wave.2", label: muted ? "Unmute previews" : "Mute previews", quiet: true, action: onToggleSound)
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, SlateMetrics.dockHeight + 18)
        }
        .background {
            // The web's ambient glow: the backdrop, blurred far behind the slide.
            CachedAsyncImage(url: item.backdropURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color.clear
            }
            .blur(radius: 60)
            .opacity(0.32)
            .ignoresSafeArea()
            .allowsHitTesting(false)
        }
        .clipped()
        .sheet(item: $listPicker) { title in
            AddToListSheet(title: title)
        }
    }

    @ViewBuilder
    private var saveControl: some View {
        if let saved {
            Menu {
                ForEach([LibraryStatus.want, .watching, .watched]) { status in
                    Button(status.label) { Task { _ = try? await model.setStatus(titleId: saved.id, status: status) } }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark").font(.system(size: 13, weight: .bold))
                    Text(saved.status.label).font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(SlatePalette.onAccent)
                .padding(.horizontal, 18)
                .frame(height: 44)
                .background(SlatePalette.accent, in: .capsule)
            }
        } else {
            Button {
                Task { await save(.want) }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: adding ? "ellipsis" : "plus").font(.system(size: 14, weight: .bold))
                    Text("Up Next").font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(SlatePalette.onAccent)
                .padding(.horizontal, 18)
                .frame(height: 44)
                .background(SlatePalette.accent, in: .capsule)
            }
            .buttonStyle(SlatePressStyle())
            .disabled(adding)
            .accessibilityLabel("Save \(item.title) to Up Next")
        }
    }

    private func circleButton(_ icon: String, label: String, quiet: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(quiet ? SlatePalette.mutedText : SlatePalette.text)
                .frame(width: 44, height: 44)
                .background(SlatePalette.surface.opacity(0.9), in: .circle)
                .overlay { Circle().stroke(SlatePalette.border, lineWidth: 1) }
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityLabel(label)
    }

    @discardableResult
    private func save(_ status: LibraryStatus) async -> SlateTitle? {
        if let saved { return saved }
        adding = true
        defer { adding = false }
        do {
            return try await model.addCatalogTitle(tmdbId: item.tmdbId, mediaType: item.mediaType, status: status)
        } catch {
            model.presentedError = error.localizedDescription
            return nil
        }
    }

    /// A list holds saved titles, so adding to one saves the title first.
    private func openListPicker() async {
        if let title = await save(.want) { listPicker = title }
    }
}

/// The YouTube player for the trailer on screen, driven through the IFrame API
/// so pause and sound follow the buttons under it.
private struct PreviewPlayer: UIViewRepresentable {
    let videoKey: String
    let playing: Bool
    let muted: Bool

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        let id = videoKey.filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        let html = """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>html,body,#p{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}</style>
        </head><body><div id="p"></div>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
        var player, ready = false, want = { play: \(playing), mute: \(muted) };
        function apply() { if (!ready) return;
          want.mute ? player.mute() : player.unMute();
          want.play ? player.playVideo() : player.pauseVideo(); }
        function onYouTubeIframeAPIReady() {
          player = new YT.Player('p', { videoId: '\(id)', host: 'https://www.youtube-nocookie.com',
            playerVars: { autoplay: 1, mute: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1, loop: 1, playlist: '\(id)' },
            events: { onReady: function () { ready = true; apply(); } } });
        }
        function slate(play, mute) { want = { play: play, mute: mute }; apply(); }
        </script></body></html>
        """
        webView.loadHTMLString(html, baseURL: URL(string: "https://www.s1ate.space"))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.evaluateJavaScript("slate(\(playing), \(muted))")
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: ()) {
        webView.stopLoading()
        webView.loadHTMLString("", baseURL: nil)
    }
}

/// A catalogue title known only by its TMDB id: your own page once saved.
struct CatalogDestinationByID: View {
    @EnvironmentObject private var model: AppModel
    let mediaType: MediaType
    let tmdbId: Int

    var body: some View {
        if let saved = model.titles.first(where: { $0.tmdbId == tmdbId && $0.mediaType == mediaType }) {
            TitleDetailView(title: saved)
        } else {
            DiscoverTitleView(mediaType: mediaType, tmdbId: tmdbId)
        }
    }
}
