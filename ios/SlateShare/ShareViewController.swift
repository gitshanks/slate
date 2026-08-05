import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private var didBegin = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.028, green: 0.026, blue: 0.031, alpha: 1)

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = .white
        spinner.startAnimating()
        spinner.translatesAutoresizingMaskIntoConstraints = false

        let label = UILabel()
        label.text = "Opening slate…"
        label.textColor = .white
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [spinner, label])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didBegin else { return }
        didBegin = true
        collectSharedText()
    }

    private func collectSharedText() {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        guard !providers.isEmpty else { finish(with: nil); return }

        let group = DispatchGroup()
        let fragments = FragmentStore()

        for provider in providers {
            let type: String?
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                type = UTType.url.identifier
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                type = UTType.plainText.identifier
            } else {
                type = nil
            }
            guard let type else { continue }
            group.enter()
            provider.loadItem(forTypeIdentifier: type) { item, _ in
                let value: String?
                if let url = item as? URL { value = url.absoluteString }
                else if let text = item as? String { value = text }
                else { value = nil }
                if let value, !value.isEmpty {
                    fragments.append(value)
                }
                group.leave()
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.finish(with: fragments.joined())
        }
    }

    private func finish(with text: String?) {
        guard let text, !text.isEmpty,
              var components = URLComponents(string: "slate://share") else {
            extensionContext?.cancelRequest(withError: ShareError.noContent)
            return
        }
        components.queryItems = [URLQueryItem(name: "text", value: text)]
        guard let url = components.url else {
            extensionContext?.cancelRequest(withError: ShareError.noContent)
            return
        }
        extensionContext?.open(url, completionHandler: nil)
        extensionContext?.completeRequest(returningItems: nil)
    }
}

private enum ShareError: LocalizedError {
    case noContent
    var errorDescription: String? { "Slate could not read anything from that share." }
}

private final class FragmentStore: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [String] = []

    func append(_ value: String) {
        lock.lock()
        values.append(value)
        lock.unlock()
    }

    func joined() -> String {
        lock.lock()
        defer { lock.unlock() }
        return values.joined(separator: "\n")
    }
}
