import Foundation

@MainActor
final class AppModel: ObservableObject {
    enum State: Equatable {
        case launching
        case signedOut
        case signingIn
        case signedIn
    }

    private struct PersistedSession: Codable {
        var tokens: TokenPayload
        var profile: SlateProfile
    }

    @Published private(set) var state: State = .launching
    @Published private(set) var profile: SlateProfile?
    @Published private(set) var titles: [SlateTitle] = []
    @Published private(set) var lists: [SlateList] = []
    @Published private(set) var posterColumns = LandingBackdrop.fallback.posterColumns
    @Published var presentedError: String?

    private let api = APIClient()
    private let keychain = KeychainStore()
    private let localStore = try? LocalLibraryStore()
    private var tokens: TokenPayload?
    private var didBootstrap = false

    func bootstrap() async {
        guard !didBootstrap else { return }
        didBootstrap = true
        Task { await refreshLandingBackdrop() }
        titles = (try? localStore?.titles()) ?? []

        guard
            let data = try? keychain.load(),
            let persisted = try? JSONDecoder().decode(PersistedSession.self, from: data)
        else {
            state = .signedOut
            return
        }

        tokens = persisted.tokens
        profile = persisted.profile
        state = .signedIn

        // A failed network request must never turn an installed app launch into
        // a surprise sign-in screen. Cached data remains available offline.
        do {
            try await refreshSessionAndLibrary()
        } catch APIClientError.server(let status, _) where status == 401 {
            clearLocalSession()
        } catch {
            presentedError = "You're offline. Showing your saved library."
        }
    }

    private func refreshLandingBackdrop() async {
        guard let backdrop = try? await api.landing(), !backdrop.posterColumns.isEmpty else {
            return
        }
        posterColumns = backdrop.posterColumns
    }

    func finishGoogleSignIn(idToken: String) async {
        await completeSignIn {
            try await api.signInWithGoogle(idToken: idToken, nonce: nil)
        }
    }

    func finishAppleSignIn(idToken: String, rawNonce: String, fullName: String?) async {
        await completeSignIn {
            try await api.signInWithApple(
                idToken: idToken,
                rawNonce: rawNonce,
                fullName: fullName
            )
        }
    }

    func refreshLibrary() async {
        guard let tokens else { return }
        do {
            let snapshot = try await api.library(accessToken: tokens.accessToken)
            apply(snapshot)
        } catch APIClientError.server(let status, _) where status == 401 {
            do {
                try await refreshSessionAndLibrary()
            } catch APIClientError.server(let refreshStatus, _) where refreshStatus == 401 {
                clearLocalSession()
            } catch {
                presentedError = error.localizedDescription
            }
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func signOut() async {
        let accessToken = tokens?.accessToken
        clearLocalSession()
        if let accessToken { try? await api.logout(accessToken: accessToken) }
    }

    func titles(in status: LibraryStatus) -> [SlateTitle] {
        titles
            .filter { $0.status == status }
            .sorted {
                if $0.position == $1.position { return $0.addedAt > $1.addedAt }
                return $0.position < $1.position
            }
    }

    private func completeSignIn(
        operation: () async throws -> SessionPayload
    ) async {
        state = .signingIn
        presentedError = nil
        do {
            let session = try await operation()
            tokens = session.tokens
            profile = session.user
            try persist()
            state = .signedIn
            await refreshLibrary()
        } catch {
            state = .signedOut
            presentedError = error.localizedDescription
        }
    }

    private func refreshSessionAndLibrary() async throws {
        guard let current = tokens else { return }
        let refreshed = try await api.refresh(refreshToken: current.refreshToken)
        tokens = refreshed
        try persist()
        let snapshot = try await api.library(accessToken: refreshed.accessToken)
        apply(snapshot)
    }

    private func apply(_ snapshot: LibrarySnapshot) {
        titles = snapshot.titles
        lists = snapshot.lists
        try? localStore?.replace(with: snapshot.titles)
    }

    private func persist() throws {
        guard let tokens, let profile else { return }
        let value = PersistedSession(tokens: tokens, profile: profile)
        try keychain.save(JSONEncoder().encode(value))
    }

    private func clearLocalSession() {
        tokens = nil
        profile = nil
        titles = []
        lists = []
        try? keychain.clear()
        try? localStore?.clear()
        state = .signedOut
    }
}
