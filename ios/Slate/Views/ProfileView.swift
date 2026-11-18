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
                HStack(spacing: 16) {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Group {
                            if let imageData = shownAvatarData,
                               let image = UIImage(data: imageData) {
                                Image(uiImage: image).resizable().scaledToFill()
                            } else {
                                remoteAvatar
                            }
                        }
                        .frame(width: 72, height: 72)
                        .clipShape(.circle)
                        .overlay { Circle().stroke(.white.opacity(0.13), lineWidth: 0.8) }
                    }
                    .buttonStyle(SlatePressStyle())
                    .accessibilityLabel("Change your photo")

                    VStack(alignment: .leading, spacing: 2) {
                        TextField("Your name", text: $displayName)
                            .font(.system(size: 26, weight: .bold))
                            .tracking(-0.6)
                            .foregroundStyle(.white)
                            .textInputAutocapitalization(.words)
                            .focused($focused, equals: .displayName)
                            .submitLabel(.done)
                            .onSubmit { scheduleSave(immediate: true) }
                        HStack(spacing: 0) {
                            Text("@")
                            TextField("username", text: $username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .username)
                                .submitLabel(.done)
                                .onSubmit { scheduleSave(immediate: true) }
                        }
                        .font(.system(size: 15))
                        .foregroundStyle(SlatePalette.mutedText)
                    }
                }

                // What is on each shelf, in the Library's own words.
                HStack(spacing: 0) {
                    shelfCount("Up Next", .want)
                    shelfCount("Watching", .watching)
                    shelfCount("Watched", .watched)
                }
                .padding(.vertical, 16)
                .background(SlatePalette.surface, in: .rect(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.border, lineWidth: 1) }
                .padding(.top, 24)

                VStack(spacing: 0) {
                    HStack(spacing: 14) {
                        Image(systemName: isPublic ? "globe" : "lock")
                            .font(.system(size: 17))
                            .foregroundStyle(SlatePalette.mutedText)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Share your slate")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(.white)
                            Text(isPublic ? "Anyone with your link can browse it." : "Only you can see it.")
                                .font(.system(size: 13))
                                .foregroundStyle(SlatePalette.mutedText)
                        }
                        Spacer()
                        Toggle("Share your slate", isOn: $isPublic).labelsHidden().tint(SlatePalette.accent)
                    }
                    .padding(16)

                    if isPublic, let url = publicURL {
                        Divider().overlay(SlatePalette.border)
                        ShareLink(item: url, subject: Text("\(displayName)'s slate")) {
                            HStack(spacing: 14) {
                                Image(systemName: "square.and.arrow.up")
                                    .font(.system(size: 17))
                                    .foregroundStyle(SlatePalette.mutedText)
                                    .frame(width: 22)
                                Text("s1ate.space/u/\(username)")
                                    .font(.system(size: 15))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Spacer(minLength: 0)
                            }
                            .padding(16)
                            .contentShape(.rect)
                        }
                        .buttonStyle(SlatePressStyle())
                    }

                    Divider().overlay(SlatePalette.border)
                    Button {
                        Task { await model.signOut(); dismiss() }
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 17))
                                .frame(width: 22)
                            Text("Sign out").font(.system(size: 15, weight: .medium))
                            Spacer(minLength: 0)
                        }
                        .foregroundStyle(SlatePalette.danger)
                        .padding(16)
                        .contentShape(.rect)
                    }
                    .buttonStyle(SlatePressStyle())
                }
                .background(SlatePalette.surface, in: .rect(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.border, lineWidth: 1) }
                .padding(.top, 12)
            }
            .padding(.horizontal, SlateMetrics.gutter)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
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

    private func shelfCount(_ label: String, _ status: LibraryStatus) -> some View {
        VStack(spacing: 2) {
            Text("\(model.titles.filter { $0.status == status }.count)")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(SlatePalette.mutedText)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
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
