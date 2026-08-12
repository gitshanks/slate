import CryptoKit
import SwiftUI
import UIKit

private struct SendableImage: @unchecked Sendable {
    let value: UIImage
}

private final class PersistentImageCache: @unchecked Sendable {
    static let shared = PersistentImageCache()

    private let memory = NSCache<NSURL, UIImage>()
    private let directory: URL
    private let lock = NSLock()
    private var requests: [URL: Task<SendableImage?, Never>] = [:]

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        directory = caches.appending(path: "slate-title-images-v1", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? (directory as NSURL).setResourceValue(true, forKey: .isExcludedFromBackupKey)

        memory.countLimit = 160
        memory.totalCostLimit = 160 * 1_024 * 1_024

        let cacheDirectory = directory
        Task.detached(priority: .utility) {
            Self.trim(cacheDirectory, to: 384 * 1_024 * 1_024)
        }
    }

    func memoryImage(for url: URL?) -> UIImage? {
        guard let url else { return nil }
        return memory.object(forKey: url as NSURL)
    }

    func image(for url: URL) async -> UIImage? {
        if let image = memoryImage(for: url) { return image }

        let request = lock.withLock { () -> Task<SendableImage?, Never> in
            if let request = requests[url] { return request }

            let fileURL = cachedFileURL(for: url)
            let shouldPersist = url.host() == "image.tmdb.org"
            let request = Task<SendableImage?, Never> {
                if shouldPersist,
                   let data = try? Data(contentsOf: fileURL),
                   let image = UIImage(data: data) {
                    return SendableImage(value: image)
                }

                var urlRequest = URLRequest(url: url)
                urlRequest.cachePolicy = .returnCacheDataElseLoad
                urlRequest.timeoutInterval = 30

                do {
                    let (data, response) = try await URLSession.shared.data(for: urlRequest)
                    guard let response = response as? HTTPURLResponse,
                          (200 ..< 300).contains(response.statusCode),
                          let image = UIImage(data: data) else {
                        return nil
                    }
                    if shouldPersist { try? data.write(to: fileURL, options: .atomic) }
                    return SendableImage(value: image)
                } catch {
                    return nil
                }
            }
            requests[url] = request
            return request
        }

        let result = await request.value?.value
        if let result {
            let cost = max(1, result.cgImage.map { $0.bytesPerRow * $0.height } ?? 1)
            memory.setObject(result, forKey: url as NSURL, cost: cost)
        }
        lock.withLock { requests[url] = nil }
        return result
    }

    private func cachedFileURL(for url: URL) -> URL {
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        return directory.appending(path: name)
    }

    private static func trim(_ directory: URL, to maximumBytes: Int) {
        let keys: Set<URLResourceKey> = [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: Array(keys),
            options: [.skipsHiddenFiles]
        ) else { return }

        let entries = files.compactMap { url -> (URL, Date, Int)? in
            guard let values = try? url.resourceValues(forKeys: keys),
                  values.isRegularFile == true else { return nil }
            return (url, values.contentModificationDate ?? .distantPast, values.fileSize ?? 0)
        }
        var total = entries.reduce(0) { $0 + $1.2 }
        guard total > maximumBytes else { return }

        for entry in entries.sorted(by: { $0.1 < $1.1 }) where total > maximumBytes {
            if (try? FileManager.default.removeItem(at: entry.0)) != nil {
                total -= entry.2
            }
        }
    }
}

enum CachedImagePhase {
    case empty
    case success(Image)
    case failure
}

struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    private let transaction: Transaction
    private let content: (Image) -> Content
    private let placeholder: () -> Placeholder

    @State private var image: UIImage?
    @State private var loadedURL: URL?

    init(
        url: URL?,
        transaction: Transaction = Transaction(),
        @ViewBuilder content: @escaping (Image) -> Content,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.url = url
        self.transaction = transaction
        self.content = content
        self.placeholder = placeholder
        _image = State(initialValue: PersistentImageCache.shared.memoryImage(for: url))
        _loadedURL = State(initialValue: url)
    }

    var body: some View {
        Group {
            if let image {
                content(Image(uiImage: image))
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            if loadedURL != url {
                image = PersistentImageCache.shared.memoryImage(for: url)
                loadedURL = url
            }
            guard image == nil, let url else { return }
            guard let loaded = await PersistentImageCache.shared.image(for: url), !Task.isCancelled else { return }
            withTransaction(transaction) { image = loaded }
        }
    }
}

struct CachedAsyncPhaseImage<Content: View>: View {
    let url: URL?
    private let transaction: Transaction
    private let content: (CachedImagePhase) -> Content

    @State private var phase: CachedImagePhase
    @State private var loadedURL: URL?

    init(
        url: URL?,
        transaction: Transaction = Transaction(),
        @ViewBuilder content: @escaping (CachedImagePhase) -> Content
    ) {
        self.url = url
        self.transaction = transaction
        self.content = content
        if let image = PersistentImageCache.shared.memoryImage(for: url) {
            _phase = State(initialValue: .success(Image(uiImage: image)))
        } else {
            _phase = State(initialValue: .empty)
        }
        _loadedURL = State(initialValue: url)
    }

    var body: some View {
        content(phase)
            .task(id: url) {
                if loadedURL != url {
                    if let image = PersistentImageCache.shared.memoryImage(for: url) {
                        phase = .success(Image(uiImage: image))
                    } else {
                        phase = .empty
                    }
                    loadedURL = url
                }
                guard case .empty = phase, let url else { return }
                guard let loaded = await PersistentImageCache.shared.image(for: url), !Task.isCancelled else {
                    if !Task.isCancelled { phase = .failure }
                    return
                }
                withTransaction(transaction) { phase = .success(Image(uiImage: loaded)) }
            }
    }
}
