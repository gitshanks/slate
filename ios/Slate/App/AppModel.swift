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
    @Published private(set) var avatarData: Data?
    @Published var presentedError: String?
    @Published var inboundSharedText: String?

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
        Task { await refreshAvatar() }

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

    func titleDetail(id: String) async throws -> TitleDetailPayload {
        try await authenticated { try await api.titleDetail(id: id, accessToken: $0) }
    }

    func search(_ query: String) async throws -> CatalogSearchPayload {
        try await authenticated { try await api.search(query: query, accessToken: $0) }
    }

    func discover(mediaType: MediaType, tmdbId: Int) async throws -> DiscoverDetailPayload {
        try await authenticated {
            try await api.discoverDetail(mediaType: mediaType, tmdbId: tmdbId, accessToken: $0)
        }
    }

    func person(id: Int) async throws -> PersonDetailPayload {
        try await authenticated { try await api.person(id: id, accessToken: $0) }
    }

    func addCatalogTitle(
        tmdbId: Int,
        mediaType: MediaType,
        status: LibraryStatus = .want
    ) async throws -> SlateTitle {
        let title: SlateTitle = try await authenticated {
            try await api.addCatalogTitle(
                tmdbId: tmdbId,
                mediaType: mediaType,
                status: status,
                accessToken: $0
            )
        }
        if let index = titles.firstIndex(where: { $0.id == title.id }) {
            titles[index] = title
        } else {
            titles.append(title)
        }
        try? localStore?.replace(with: titles)
        return title
    }

    func setStatus(titleId: String, status: LibraryStatus) async throws -> SlateTitle {
        try await mutateTitle { accessToken in
            try await api.updateTitleStatus(id: titleId, status: status, accessToken: accessToken)
        }
    }

    func setRating(titleId: String, rating: Int?) async throws -> SlateTitle {
        try await mutateTitle { accessToken in
            try await api.updateTitleRating(id: titleId, rating: rating, accessToken: accessToken)
        }
    }

    func setReview(titleId: String, review: String) async throws -> SlateTitle {
        try await mutateTitle { accessToken in
            try await api.updateTitleReview(id: titleId, review: review, accessToken: accessToken)
        }
    }

    func removeTitle(id: String) async throws {
        try await authenticated { try await api.removeTitle(id: id, accessToken: $0) }
        titles.removeAll { $0.id == id }
        try? localStore?.replace(with: titles)
    }

    func addTitle(
        _ titleId: String,
        toList listId: String? = nil,
        newListName: String? = nil
    ) async throws -> TitleListOption {
        let list: TitleListOption = try await authenticated {
            try await api.addTitle(
                id: titleId,
                toList: listId,
                newListName: newListName,
                accessToken: $0
            )
        }
        if !lists.contains(where: { $0.id == list.id }) {
            lists.append(
                SlateList(
                    id: list.id,
                    slug: list.slug,
                    name: list.name,
                    description: list.description,
                    createdAt: list.createdAt,
                    updatedAt: list.updatedAt
                )
            )
        }
        return list
    }

    func reorder(status: LibraryStatus, titles ordered: [SlateTitle]) async throws {
        let ids = ordered.map(\.id)
        let original = titles
        let positions = Dictionary(uniqueKeysWithValues: ids.enumerated().map { ($1, $0) })
        titles = titles.map { title in
            guard title.status == status, let position = positions[title.id] else { return title }
            var updated = title
            updated.position = position
            return updated
        }
        do {
            try await authenticated { try await api.reorderStatus(status, titleIds: ids, accessToken: $0) }
            try? localStore?.replace(with: titles)
        } catch {
            titles = original
            throw error
        }
    }

    func listSummaries() async throws -> [SlateListSummary] {
        try await authenticated { try await api.listSummaries(accessToken: $0).lists }
    }

    func listDetail(id: String) async throws -> SlateListDetailPayload {
        try await authenticated { try await api.listDetail(id: id, accessToken: $0) }
    }

    func createList(name: String, description: String) async throws -> SlateListSummary {
        let summary: SlateListSummary = try await authenticated {
            try await api.createList(name: name, description: description, accessToken: $0)
        }
        lists.append(SlateList(
            id: summary.id,
            slug: summary.slug,
            name: summary.name,
            description: summary.description,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt
        ))
        return summary
    }

    func updateList(id: String, name: String, description: String) async throws -> SlateList {
        let list: SlateList = try await authenticated {
            try await api.updateList(id: id, name: name, description: description, accessToken: $0)
        }
        if let index = lists.firstIndex(where: { $0.id == id }) { lists[index] = list }
        return list
    }

    func deleteList(id: String) async throws {
        try await authenticated { try await api.deleteList(id: id, accessToken: $0) }
        lists.removeAll { $0.id == id }
    }

    func addTitleToList(listId: String, titleId: String) async throws {
        try await authenticated {
            try await api.addTitleToList(listId: listId, titleId: titleId, accessToken: $0)
        }
    }

    func removeTitleFromList(listId: String, titleId: String) async throws {
        try await authenticated {
            try await api.removeTitleFromList(listId: listId, titleId: titleId, accessToken: $0)
        }
    }

    func reorder(listId: String, titles: [SlateTitle]) async throws {
        try await authenticated {
            try await api.reorderList(listId, titleIds: titles.map(\.id), accessToken: $0)
        }
    }

    func updateProfile(displayName: String, username: String, isPublic: Bool) async throws {
        let profile: SlateProfile = try await authenticated {
            try await api.updateProfile(
                displayName: displayName,
                username: username,
                isPublic: isPublic,
                accessToken: $0
            )
        }
        self.profile = profile
        try persist()
    }

    func uploadAvatar(data: Data, mime: String) async throws {
        let url: URL? = try await authenticated {
            try await api.uploadAvatar(data: data, mime: mime, accessToken: $0)
        }
        profile?.avatarUrl = url
        avatarData = data
        profile?.updatedAt = Date().ISO8601Format()
        try persist()
    }

    private func refreshAvatar() async {
        guard let tokens else { return }
        avatarData = try? await api.avatar(accessToken: tokens.accessToken)
    }

    func resolveSharedText(_ text: String) async throws -> SharedLinkResolution {
        try await authenticated { try await api.resolveSharedText(text, accessToken: $0) }
    }

    func handleOpenURL(_ url: URL) {
        guard url.scheme == "slate", url.host == "share" else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        inboundSharedText = components?.queryItems?.first(where: { $0.name == "text" })?.value
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
            Task { await refreshAvatar() }
            await refreshLibrary()
        } catch {
            state = .signedOut
            presentedError = error.localizedDescription
        }
    }

    private func refreshSessionAndLibrary() async throws {
        try await refreshSessionOnly()
        guard let refreshed = tokens else { return }
        let snapshot = try await api.library(accessToken: refreshed.accessToken)
        apply(snapshot)
    }

    private func refreshSessionOnly() async throws {
        guard let current = tokens else { return }
        let refreshed = try await api.refresh(refreshToken: current.refreshToken)
        tokens = refreshed
        try persist()
    }

    private func mutateTitle(
        operation: (String) async throws -> SlateTitle
    ) async throws -> SlateTitle {
        let updated: SlateTitle = try await authenticated(operation)
        if let index = titles.firstIndex(where: { $0.id == updated.id }) {
            titles[index] = updated
        }
        try? localStore?.replace(with: titles)
        return updated
    }

    private func authenticated<Value>(
        _ operation: (String) async throws -> Value
    ) async throws -> Value {
        guard let current = tokens else { throw APIClientError.invalidConfiguration }
        do {
            return try await operation(current.accessToken)
        } catch APIClientError.server(let status, _) where status == 401 {
            try await refreshSessionOnly()
            guard let refreshed = tokens else { throw APIClientError.invalidConfiguration }
            return try await operation(refreshed.accessToken)
        }
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
        avatarData = nil
        titles = []
        lists = []
        try? keychain.clear()
        try? localStore?.clear()
        state = .signedOut
    }
}
