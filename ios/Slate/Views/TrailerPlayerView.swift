import SwiftUI
import WebKit

struct TrailerPresentation: Identifiable, Equatable {
    let videoID: String
    let title: String

    var id: String { videoID }
}

struct TrailerPlayerView: View {
    @Environment(\.dismiss) private var dismiss

    let trailer: TrailerPresentation

    @State private var loading = true

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 14) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 38, height: 38)
                            .background(.white.opacity(0.1), in: .circle)
                            .overlay { Circle().stroke(.white.opacity(0.12), lineWidth: 0.7) }
                    }
                    .buttonStyle(SlatePressStyle())
                    .accessibilityLabel("Close trailer")

                    VStack(alignment: .leading, spacing: 3) {
                        Text("TRAILER")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .tracking(1.5)
                            .foregroundStyle(.white.opacity(0.48))
                        Text(trailer.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 18)
                .frame(height: 64)

                Spacer(minLength: 0)

                YouTubeTrailerWebView(videoID: trailer.videoID, loading: $loading)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .background(Color.black)

                Spacer(minLength: 0)
            }

            if loading {
                ProgressView()
                    .tint(.white)
                    .controlSize(.large)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden()
    }
}

private struct YouTubeTrailerWebView: UIViewRepresentable {
    let videoID: String
    @Binding var loading: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(loading: $loading)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.videoID = videoID
        load(videoID: videoID, in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.videoID != videoID else { return }
        context.coordinator.videoID = videoID
        loading = true
        load(videoID: videoID, in: webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.loadHTMLString("", baseURL: nil)
    }

    private func load(videoID: String, in webView: WKWebView) {
        let safeID = videoID.filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        let html = """
        <!doctype html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
            <style>
              html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: #000; overflow: hidden; }
            </style>
          </head>
          <body>
            <iframe
              src="https://www.youtube-nocookie.com/embed/\(safeID)?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1&origin=https%3A%2F%2Fwww.s1ate.space"
              title="Trailer"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowfullscreen>
            </iframe>
          </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: URL(string: "https://www.s1ate.space"))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var videoID: String?
        private var loading: Binding<Bool>

        init(loading: Binding<Bool>) {
            self.loading = loading
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loading.wrappedValue = false
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: any Error
        ) {
            loading.wrappedValue = false
        }
    }
}
