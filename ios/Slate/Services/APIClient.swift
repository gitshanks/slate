import Foundation
import UIKit

enum APIClientError: LocalizedError {
    case invalidConfiguration
    case invalidResponse
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: "Slate is missing its server configuration."
        case .invalidResponse: "Slate received an unreadable response."
        case .server(_, let message): message
        }
    }
}

actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(session: URLSession = .shared) {
        let value = Bundle.main.object(forInfoDictionaryKey: "SlateAPIBaseURL") as? String
        baseURL = URL(string: value ?? "") ?? URL(string: "https://www.s1ate.space/api/v1")!
        self.session = session
    }

    func signInWithGoogle(idToken: String, nonce: String?) async throws -> SessionPayload {
        struct Body: Encodable {
            let idToken: String
            let platform = "ios"
            let nonce: String?
            let deviceName: String
        }
        return try await send(
            path: "auth/google",
            method: "POST",
            body: Body(
                idToken: idToken,
                nonce: nonce,
                deviceName: await UIDevice.current.name
            )
        )
    }

    func signInWithApple(
        idToken: String,
        rawNonce: String,
        fullName: String?
    ) async throws -> SessionPayload {
        struct Body: Encodable {
            let idToken: String
            let platform = "ios"
            let nonce: String
            let fullName: String?
            let deviceName: String
        }
        return try await send(
            path: "auth/apple",
            method: "POST",
            body: Body(
                idToken: idToken,
                nonce: rawNonce,
                fullName: fullName,
                deviceName: await UIDevice.current.name
            )
        )
    }

    func refresh(refreshToken: String) async throws -> TokenPayload {
        struct Body: Encodable { let refreshToken: String }
        return try await send(
            path: "auth/refresh",
            method: "POST",
            body: Body(refreshToken: refreshToken)
        )
    }

    func library(accessToken: String) async throws -> LibrarySnapshot {
        try await send(path: "library", accessToken: accessToken)
    }

    func landing() async throws -> LandingBackdrop {
        try await send(path: "landing")
    }

    func profile(accessToken: String) async throws -> SlateProfile {
        try await send(path: "me", accessToken: accessToken)
    }

    func updateProfile(
        displayName: String,
        username: String,
        isPublic: Bool,
        accessToken: String
    ) async throws -> SlateProfile {
        struct Body: Encodable {
            let displayName: String
            let username: String
            let isPublic: Bool
        }
        return try await send(
            path: "me",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(displayName: displayName, username: username, isPublic: isPublic)
        )
    }

    func uploadAvatar(data: Data, mime: String, accessToken: String) async throws -> URL? {
        struct AvatarResult: Decodable { let avatarUrl: URL? }
        let result: AvatarResult = try await sendRaw(
            path: "me/avatar",
            method: "POST",
            accessToken: accessToken,
            contentType: mime,
            body: data
        )
        return result.avatarUrl
    }

    func avatar(accessToken: String) async throws -> Data? {
        var request = URLRequest(url: baseURL.appending(path: "me/avatar"))
        request.timeoutInterval = 20
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        if http.statusCode == 404 { return nil }
        guard (200..<300).contains(http.statusCode) else {
            let message = try? decoder.decode(APIErrorEnvelope.self, from: data).error.message
            throw APIClientError.server(
                status: http.statusCode,
                message: message ?? "Profile photo could not be loaded."
            )
        }
        return data
    }

    func search(query: String, accessToken: String) async throws -> CatalogSearchPayload {
        try await send(
            path: "search",
            queryItems: [URLQueryItem(name: "q", value: query)],
            accessToken: accessToken
        )
    }

    func discoverDetail(
        mediaType: MediaType,
        tmdbId: Int,
        accessToken: String
    ) async throws -> DiscoverDetailPayload {
        try await send(
            path: "discover/\(mediaType.rawValue)/\(tmdbId)",
            accessToken: accessToken
        )
    }

    func person(id: Int, accessToken: String) async throws -> PersonDetailPayload {
        try await send(path: "people/\(id)", accessToken: accessToken)
    }

    func addCatalogTitle(
        tmdbId: Int,
        mediaType: MediaType,
        status: LibraryStatus,
        accessToken: String
    ) async throws -> SlateTitle {
        struct Body: Encodable {
            let tmdbId: Int
            let mediaType: MediaType
            let status: LibraryStatus
        }
        return try await send(
            path: "titles",
            method: "POST",
            accessToken: accessToken,
            body: Body(tmdbId: tmdbId, mediaType: mediaType, status: status)
        )
    }

    func titleDetail(id: String, accessToken: String) async throws -> TitleDetailPayload {
        try await send(path: "titles/\(id)", accessToken: accessToken)
    }

    func updateTitleStatus(
        id: String,
        status: LibraryStatus,
        accessToken: String
    ) async throws -> SlateTitle {
        struct Body: Encodable { let status: LibraryStatus }
        return try await send(
            path: "titles/\(id)",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(status: status)
        )
    }

    func updateTitleRating(
        id: String,
        rating: Int?,
        accessToken: String
    ) async throws -> SlateTitle {
        struct Body: Encodable {
            let rating: Int?
            func encode(to encoder: Encoder) throws {
                var container = encoder.container(keyedBy: CodingKeys.self)
                if let rating { try container.encode(rating, forKey: .rating) }
                else { try container.encodeNil(forKey: .rating) }
            }
            private enum CodingKeys: String, CodingKey { case rating }
        }
        return try await send(
            path: "titles/\(id)",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(rating: rating)
        )
    }

    func updateTitleReview(
        id: String,
        review: String,
        accessToken: String
    ) async throws -> SlateTitle {
        struct Body: Encodable { let review: String }
        return try await send(
            path: "titles/\(id)",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(review: review)
        )
    }

    func removeTitle(id: String, accessToken: String) async throws {
        struct Deleted: Decodable { let deleted: Bool }
        let _: Deleted = try await send(
            path: "titles/\(id)",
            method: "DELETE",
            accessToken: accessToken
        )
    }

    func addTitle(
        id: String,
        toList listId: String?,
        newListName: String?,
        accessToken: String
    ) async throws -> TitleListOption {
        struct Body: Encodable {
            let listId: String?
            let name: String?
        }
        return try await send(
            path: "titles/\(id)/lists",
            method: "POST",
            accessToken: accessToken,
            body: Body(listId: listId, name: newListName)
        )
    }

    func reorderStatus(
        _ status: LibraryStatus,
        titleIds: [String],
        accessToken: String
    ) async throws {
        struct Body: Encodable {
            let kind = "status"
            let status: LibraryStatus
            let titleIds: [String]
        }
        struct Result: Decodable { let reordered: Bool }
        let _: Result = try await send(
            path: "reorder",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(status: status, titleIds: titleIds)
        )
    }

    func reorderList(
        _ listId: String,
        titleIds: [String],
        accessToken: String
    ) async throws {
        struct Body: Encodable {
            let kind = "list"
            let listId: String
            let titleIds: [String]
        }
        struct Result: Decodable { let reordered: Bool }
        let _: Result = try await send(
            path: "reorder",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(listId: listId, titleIds: titleIds)
        )
    }

    func listSummaries(accessToken: String) async throws -> ListsPayload {
        try await send(path: "lists", accessToken: accessToken)
    }

    func listDetail(id: String, accessToken: String) async throws -> SlateListDetailPayload {
        try await send(path: "lists/\(id)", accessToken: accessToken)
    }

    func createList(
        name: String,
        description: String,
        accessToken: String
    ) async throws -> SlateListSummary {
        struct Body: Encodable { let name: String; let description: String }
        return try await send(
            path: "lists",
            method: "POST",
            accessToken: accessToken,
            body: Body(name: name, description: description)
        )
    }

    func updateList(
        id: String,
        name: String,
        description: String,
        accessToken: String
    ) async throws -> SlateList {
        struct Body: Encodable { let name: String; let description: String }
        return try await send(
            path: "lists/\(id)",
            method: "PATCH",
            accessToken: accessToken,
            body: Body(name: name, description: description)
        )
    }

    func deleteList(id: String, accessToken: String) async throws {
        struct Result: Decodable { let deleted: Bool }
        let _: Result = try await send(
            path: "lists/\(id)",
            method: "DELETE",
            accessToken: accessToken
        )
    }

    func addTitleToList(listId: String, titleId: String, accessToken: String) async throws {
        struct Result: Decodable { let added: Bool }
        let _: Result = try await send(
            path: "lists/\(listId)/titles/\(titleId)",
            method: "POST",
            accessToken: accessToken
        )
    }

    func removeTitleFromList(listId: String, titleId: String, accessToken: String) async throws {
        struct Result: Decodable { let removed: Bool }
        let _: Result = try await send(
            path: "lists/\(listId)/titles/\(titleId)",
            method: "DELETE",
            accessToken: accessToken
        )
    }

    func resolveSharedText(_ text: String, accessToken: String) async throws -> SharedLinkResolution {
        struct Body: Encodable { let text: String }
        return try await send(
            path: "share/resolve",
            method: "POST",
            accessToken: accessToken,
            body: Body(text: text)
        )
    }

    func logout(accessToken: String) async throws {
        struct SignedOut: Decodable { let signedOut: Bool }
        let _: SignedOut = try await send(
            path: "auth/logout",
            method: "POST",
            accessToken: accessToken
        )
    }

    private func send<Output: Decodable>(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = [],
        accessToken: String? = nil
    ) async throws -> Output {
        try await sendData(
            path: path,
            method: method,
            queryItems: queryItems,
            accessToken: accessToken,
            body: nil
        )
    }

    private func send<Body: Encodable, Output: Decodable>(
        path: String,
        method: String,
        accessToken: String? = nil,
        body: Body
    ) async throws -> Output {
        try await sendData(
            path: path,
            method: method,
            queryItems: [],
            accessToken: accessToken,
            body: try encoder.encode(body)
        )
    }

    private func sendRaw<Output: Decodable>(
        path: String,
        method: String,
        accessToken: String,
        contentType: String,
        body: Data
    ) async throws -> Output {
        try await sendData(
            path: path,
            method: method,
            queryItems: [],
            accessToken: accessToken,
            body: body,
            contentType: contentType
        )
    }

    private func sendData<Output: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        accessToken: String?,
        body: Data?,
        contentType: String = "application/json"
    ) async throws -> Output {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        if !queryItems.isEmpty { components?.queryItems = queryItems }
        guard let url = components?.url else { throw APIClientError.invalidConfiguration }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = try? decoder.decode(APIErrorEnvelope.self, from: data).error.message
            throw APIClientError.server(
                status: http.statusCode,
                message: message ?? "Slate could not complete that request."
            )
        }
        do {
            return try decoder.decode(APIEnvelope<Output>.self, from: data).data
        } catch {
            throw APIClientError.invalidResponse
        }
    }
}
