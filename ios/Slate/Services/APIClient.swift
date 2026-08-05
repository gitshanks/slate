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
        baseURL = URL(string: value ?? "") ?? URL(string: "https://s1ate.space/api/v1")!
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
        accessToken: String? = nil
    ) async throws -> Output {
        try await sendData(path: path, method: method, accessToken: accessToken, body: nil)
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
            accessToken: accessToken,
            body: try encoder.encode(body)
        )
    }

    private func sendData<Output: Decodable>(
        path: String,
        method: String,
        accessToken: String?,
        body: Data?
    ) async throws -> Output {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
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
