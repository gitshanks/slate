import GoogleSignIn
import SwiftUI

struct SignInView: View {
    private enum AuthMode {
        case create
        case signIn
    }

    @EnvironmentObject private var model: AppModel
    @State private var authMode: AuthMode?

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ZStack {
                    LandingPosterWall(columns: model.posterColumns)
                    LandingScrim()

                    SlateWordmark()
                        .padding(.top, proxy.safeAreaInsets.top + 10)
                        .frame(maxHeight: .infinity, alignment: .top)

                    hero

                    HStack {
                        Text("FREE · PRIVATE BY DEFAULT")
                        Spacer()
                        Link(destination: URL(string: "https://github.com/gitshanks/slate")!) {
                            HStack(spacing: 4) {
                                Text("GITHUB")
                                Image(systemName: "arrow.up.right")
                            }
                        }
                    }
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .tracking(0.45)
                    .foregroundStyle(.white.opacity(0.58))
                    .padding(.horizontal, 18)
                    .padding(.bottom, max(proxy.safeAreaInsets.bottom, 18))
                    .frame(maxHeight: .infinity, alignment: .bottom)
                }
                .blur(radius: authMode == nil ? 0 : 5)

                if let authMode {
                    AuthOverlay(
                        creating: authMode == .create,
                        busy: model.state == .signingIn,
                        onDismiss: { self.authMode = nil },
                        onSwitch: {
                            withAnimation(.smooth(duration: 0.22)) {
                                self.authMode = authMode == .create ? .signIn : .create
                            }
                        },
                        onGoogle: signInWithGoogle
                    )
                    .transition(.opacity)
                }
            }
            .ignoresSafeArea()
        }
        .animation(.smooth(duration: 0.28), value: authMode != nil)
    }

    private var hero: some View {
        VStack(spacing: 30) {
            VStack(spacing: 0) {
                Text("Never lose a good")
                Text("recommendation again.")
            }
            .font(.system(size: 35, weight: .bold))
            .tracking(-2.15)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.92), radius: 24, y: 6)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { landingButtons }
                VStack(spacing: 8) { landingButtons }
            }
        }
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var landingButtons: some View {
        LandingButton(title: "Create your slate", prominent: true) {
            authMode = .create
        }
        LandingButton(title: "Sign in", prominent: false) {
            authMode = .signIn
        }
    }

    private func signInWithGoogle() {
        guard
            let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
            !clientID.isEmpty,
            let presenter = UIApplication.shared.slateTopViewController
        else {
            model.presentedError = "Add the Google iOS client ID to the Slate target first."
            return
        }

        let configuredServerClientID =
            Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String
        let serverClientID = configuredServerClientID?.isEmpty == false
            ? configuredServerClientID
            : nil

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: clientID,
            serverClientID: serverClientID
        )
        Task {
            do {
                let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
                guard let idToken = result.user.idToken?.tokenString else {
                    throw APIClientError.invalidResponse
                }
                await model.finishGoogleSignIn(idToken: idToken)
            } catch {
                model.presentedError = error.localizedDescription
            }
        }
    }
}

private struct LandingButton: View {
    let title: String
    let prominent: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(prominent ? Color(white: 0.08) : .white.opacity(0.9))
                .padding(.horizontal, 22)
                .frame(height: 50)
                .background {
                    if prominent {
                        Capsule().fill(.white.opacity(0.9))
                    } else {
                        Capsule().fill(.ultraThinMaterial)
                    }
                }
                .overlay {
                    Capsule().stroke(.white.opacity(prominent ? 0.68 : 0.2), lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.3), radius: 21, y: 12)
        }
        .buttonStyle(LandingPressStyle())
    }
}

private struct LandingPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.smooth(duration: 0.16), value: configuration.isPressed)
    }
}

private struct AuthOverlay: View {
    let creating: Bool
    let busy: Bool
    let onDismiss: () -> Void
    let onSwitch: () -> Void
    let onGoogle: () -> Void

    var body: some View {
        ZStack {
            Rectangle()
                .fill(Color.black.opacity(0.34))
                .contentShape(.rect)
                .onTapGesture(perform: onDismiss)

            RadialGradient(
                colors: [.black.opacity(0.5), .black.opacity(0.13), .clear],
                center: .center,
                startRadius: 12,
                endRadius: 380
            )
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                Text(creating ? "Create your slate" : "Sign in to slate")
                    .font(.system(size: 39, weight: .bold))
                    .tracking(-2.2)
                    .multilineTextAlignment(.center)

                Button(action: onGoogle) {
                    HStack(spacing: 11) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 20, weight: .semibold))
                        Text(creating ? "Sign up with Google" : "Sign in with Google")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundStyle(Color(white: 0.08))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(.white, in: .rect(cornerRadius: 16))
                }
                .buttonStyle(LandingPressStyle())
                .disabled(busy)
                .overlay {
                    if busy {
                        RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.9))
                        ProgressView().tint(.black)
                    }
                }
                .padding(.top, 34)

                HStack(spacing: 4) {
                    Text(creating ? "Already have a slate?" : "New to slate?")
                        .foregroundStyle(.white.opacity(0.62))
                    Button(creating ? "Sign in" : "Create one", action: onSwitch)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                }
                .font(.system(size: 13))
                .padding(.top, 22)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: 440)
        }
    }
}

private struct LandingPosterWall: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let columns: [[URL]]

    private let durations = [360.0, 432.0, 396.0, 456.0, 420.0, 372.0, 444.0, 408.0]
    private let phases = [17.0, 31.0, 43.0, 12.0, 38.0, 24.0, 51.0, 8.0]

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { timeline in
                let posterWidth = proxy.size.width * 0.29
                let gap: CGFloat = 8
                let totalWidth = posterWidth * CGFloat(columns.count) + gap * CGFloat(max(0, columns.count - 1))

                HStack(spacing: gap) {
                    ForEach(Array(columns.enumerated()), id: \.offset) { index, urls in
                        LandingPosterColumn(
                            urls: urls,
                            width: posterWidth,
                            viewportHeight: proxy.size.height * 1.28,
                            date: timeline.date,
                            duration: durations[index % durations.count],
                            phase: phases[index % phases.count],
                            startsUp: index.isMultiple(of: 2),
                            frozen: reduceMotion
                        )
                    }
                }
                .frame(width: totalWidth)
                .rotationEffect(.degrees(-5))
                .scaleEffect(1.08)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
            }
        }
        .background(Color(white: 0.02))
        .clipped()
    }
}

private struct LandingPosterColumn: View {
    let urls: [URL]
    let width: CGFloat
    let viewportHeight: CGFloat
    let date: Date
    let duration: Double
    let phase: Double
    let startsUp: Bool
    let frozen: Bool

    var body: some View {
        let gap: CGFloat = 8
        let posterHeight = width * 1.5
        let sequenceHeight = CGFloat(urls.count) * (posterHeight + gap)
        let elapsed = frozen ? phase : date.timeIntervalSinceReferenceDate + phase
        let leg = floor(elapsed / duration)
        let raw = (elapsed.truncatingRemainder(dividingBy: duration)) / duration
        let alternating = Int(leg).isMultiple(of: 2) ? raw : 1 - raw
        let progress = startsUp ? alternating : 1 - alternating

        VStack(spacing: 0) {
            posterSequence(height: posterHeight, gap: gap)
            posterSequence(height: posterHeight, gap: gap)
        }
        .offset(y: -sequenceHeight * CGFloat(progress))
        .frame(width: width, height: viewportHeight, alignment: .top)
        .clipped()
    }

    private func posterSequence(height: CGFloat, gap: CGFloat) -> some View {
        VStack(spacing: gap) {
            ForEach(Array(urls.enumerated()), id: \.offset) { _, url in
                CachedAsyncPhaseImage(url: url, transaction: Transaction(animation: nil)) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Color(white: 0.09)
                    }
                }
                .frame(width: width, height: height)
                .clipShape(.rect(cornerRadius: 5))
                .overlay {
                    RoundedRectangle(cornerRadius: 5)
                        .stroke(.white.opacity(0.08), lineWidth: 0.6)
                }
                .shadow(color: .black.opacity(0.42), radius: 16, y: 10)
            }
        }
        .padding(.bottom, gap)
    }
}

private struct LandingScrim: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.black.opacity(0.62), .clear, .clear, .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            )
            RadialGradient(
                colors: [.black.opacity(0.98), .black.opacity(0.9), .black.opacity(0.5), .clear],
                center: UnitPoint(x: 0.5, y: 0.54),
                startRadius: 0,
                endRadius: 260
            )
            .scaleEffect(x: 1.28, y: 1.72)
        }
        .allowsHitTesting(false)
    }
}

private struct SlateWordmark: View {
    var body: some View {
        HStack(spacing: 7) {
            VStack(spacing: 3) {
                Capsule().frame(width: 15, height: 4)
                HStack(spacing: 3) {
                    Capsule().frame(width: 6, height: 4)
                    Capsule().frame(width: 6, height: 4)
                }
            }
            Text("slate")
                .font(.system(size: 27, weight: .bold))
                .tracking(-1.2)
        }
        .foregroundStyle(.white)
        .shadow(color: .black.opacity(0.82), radius: 18, y: 4)
    }
}

private extension UIApplication {
    var slateTopViewController: UIViewController? {
        let root = connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        return topViewController(from: root)
    }

    func topViewController(from controller: UIViewController?) -> UIViewController? {
        if let navigation = controller as? UINavigationController {
            return topViewController(from: navigation.visibleViewController)
        }
        if let tab = controller as? UITabBarController {
            return topViewController(from: tab.selectedViewController)
        }
        if let presented = controller?.presentedViewController {
            return topViewController(from: presented)
        }
        return controller
    }
}
