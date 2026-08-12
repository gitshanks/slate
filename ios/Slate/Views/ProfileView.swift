import PhotosUI
import SwiftUI
import UIKit

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var username = ""
    @State private var isPublic = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var previewData: Data?
    @State private var saveTask: Task<Void, Never>?
    @FocusState private var focused: Field?

    private enum Field { case displayName, username }

    var body: some View {
        let shownAvatarData = previewData ?? model.avatarData
        let shownAvatarURL = model.profile?.avatarUrl
        let shownInitials = initials
        let remoteAvatar = CachedAsyncImage(url: shownAvatarURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Circle().fill(.white.opacity(0.07)).overlay {
                Text(shownInitials).font(.title2.bold()).foregroundStyle(.secondary)
            }
        }
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SlateSectionHeader(eyebrow: "Your slate", title: "Profile")
                    .padding(.bottom, 8)
                Text("Edit what friends see and choose whether your slate can be shared.")
                    .font(.system(size: 14))
                    .foregroundStyle(SlatePalette.muted)
                    .lineSpacing(3)
                    .padding(.bottom, 26)

                HStack(spacing: 18) {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Group {
                            if let imageData = shownAvatarData,
                               let image = UIImage(data: imageData) {
                                Image(uiImage: image).resizable().scaledToFill()
                            } else {
                                remoteAvatar
                            }
                        }
                        .frame(width: 82, height: 82)
                        .clipShape(.circle)
                        .overlay { Circle().stroke(.white.opacity(0.13), lineWidth: 0.8) }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change profile photo")

                    VStack(alignment: .leading, spacing: 5) {
                        Text(isPublic ? "PUBLIC" : "PRIVATE")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .tracking(1.5)
                            .foregroundStyle(SlatePalette.accent)
                        TextField("Display name", text: $displayName)
                            .font(.system(size: 25, weight: .bold))
                            .tracking(-0.7)
                            .textInputAutocapitalization(.words)
                            .focused($focused, equals: .displayName)
                            .submitLabel(.done)
                            .onSubmit { scheduleSave(immediate: true) }
                        HStack(spacing: 0) {
                            Text("@").foregroundStyle(.secondary)
                            TextField("username", text: $username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .username)
                                .submitLabel(.done)
                                .onSubmit { scheduleSave(immediate: true) }
                        }
                        .font(.system(size: 14, design: .monospaced))
                        .foregroundStyle(.secondary)
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SlatePalette.surface, in: .rect(cornerRadius: 18))
                .overlay { RoundedRectangle(cornerRadius: 18).stroke(SlatePalette.hairline, lineWidth: 0.7) }

                VStack(spacing: 0) {
                    HStack(spacing: 14) {
                        Image(systemName: isPublic ? "globe" : "lock.fill")
                            .frame(width: 22)
                            .foregroundStyle(SlatePalette.accent)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Share your slate").font(.headline)
                            Text(isPublic ? "Anyone with your link can browse it." : "Your slate is private by default.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Toggle("", isOn: $isPublic).labelsHidden().tint(SlatePalette.accent)
                    }
                    .padding(18)

                    if isPublic, let url = publicURL {
                        Divider().overlay(SlatePalette.hairline).padding(.leading, 54)
                        ShareLink(item: url, subject: Text("\(displayName)'s slate")) {
                            HStack(spacing: 14) {
                                Image(systemName: "link").frame(width: 22)
                                Text(url.absoluteString.replacingOccurrences(of: "https://www.", with: ""))
                                    .font(.system(size: 13, design: .monospaced)).lineLimit(1)
                                Spacer()
                                Image(systemName: "square.and.arrow.up").font(.caption.bold()).foregroundStyle(.tertiary)
                            }
                            .foregroundStyle(.primary)
                            .padding(18)
                        }
                    }
                }
                .background(SlatePalette.surface, in: .rect(cornerRadius: 18))
                .overlay { RoundedRectangle(cornerRadius: 18).stroke(SlatePalette.hairline, lineWidth: 0.7) }
                .padding(.top, 18)

                Button("Sign out", role: .destructive) {
                    Task { await model.signOut(); dismiss() }
                }
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.top, 30)
                .padding(.bottom, 34)
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { hydrate() }
        .onChange(of: displayName) { _, _ in scheduleSave() }
        .onChange(of: username) { _, newValue in
            let clean = newValue.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "-" }
            if clean != newValue { username = clean }
            scheduleSave()
        }
        .onChange(of: isPublic) { _, _ in scheduleSave(immediate: true) }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await upload(item) }
        }
        .onChange(of: focused) { old, new in
            if old != nil && new == nil { scheduleSave(immediate: true) }
        }
    }

    private var publicURL: URL? {
        URL(string: "https://www.s1ate.space/u/\(username)")
    }

    private var initials: String {
        displayName.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    private func hydrate() {
        guard let profile = model.profile else { return }
        displayName = profile.displayName
        username = profile.username
        isPublic = profile.isPublic
    }

    private func scheduleSave(immediate: Bool = false) {
        guard let profile = model.profile else { return }
        let cleanName = displayName.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanName.count >= 2, cleanName.count <= 60,
              cleanUsername.range(of: #"^[a-z0-9][a-z0-9-]{2,29}$"#, options: .regularExpression) != nil,
              cleanName != profile.displayName || cleanUsername != profile.username || isPublic != profile.isPublic else { return }
        saveTask?.cancel()
        saveTask = Task {
            if !immediate { try? await Task.sleep(for: .milliseconds(650)) }
            guard !Task.isCancelled else { return }
            do { try await model.updateProfile(displayName: cleanName, username: cleanUsername, isPublic: isPublic) }
            catch {
                guard !Task.isCancelled else { return }
                model.presentedError = error.localizedDescription
            }
        }
    }

    private func upload(_ item: PhotosPickerItem) async {
        do {
            guard let source = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: source),
                  let data = image.slateAvatarJPEG() else {
                throw APIClientError.invalidResponse
            }
            previewData = data
            try await model.uploadAvatar(data: data, mime: "image/jpeg")
        } catch {
            model.presentedError = error.localizedDescription
        }
    }
}

private extension UIImage {
    func slateAvatarJPEG() -> Data? {
        let maxSide: CGFloat = 900
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        let resized = renderer.image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        for quality in stride(from: 0.82, through: 0.35, by: -0.08) {
            if let data = resized.jpegData(compressionQuality: quality), data.count <= 640 * 1024 {
                return data
            }
        }
        return nil
    }
}
