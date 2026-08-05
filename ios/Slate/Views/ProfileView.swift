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
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Group {
                            if let imageData = shownAvatarData,
                               let image = UIImage(data: imageData) {
                                Image(uiImage: image).resizable().scaledToFill()
                            } else {
                                AsyncImage(url: shownAvatarURL) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: {
                                    Circle().fill(.white.opacity(0.07)).overlay {
                                        Text(shownInitials).font(.title.bold()).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                        .frame(width: 112, height: 112)
                        .clipShape(.circle)
                        .overlay { Circle().stroke(.white.opacity(0.13), lineWidth: 0.8) }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change profile photo")
                    .padding(.top, 20)

                    VStack(spacing: 5) {
                        TextField("Display name", text: $displayName)
                            .font(.system(size: 28, weight: .bold))
                            .tracking(-0.8)
                            .multilineTextAlignment(.center)
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
                        .font(.system(size: 15, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .fixedSize()
                    }
                    .padding(.top, 18)
                    .padding(.horizontal, 28)

                    VStack(spacing: 0) {
                        HStack(spacing: 14) {
                            Image(systemName: isPublic ? "globe" : "lock.fill")
                                .frame(width: 22)
                                .foregroundStyle(Color(red: 0.66, green: 0.53, blue: 1))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(isPublic ? "Public slate" : "Private slate").font(.headline)
                                Text(isPublic ? "Friends can browse your shelves." : "Only you can see your shelves.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Toggle("", isOn: $isPublic).labelsHidden().tint(.purple)
                        }
                        .padding(18)

                        if isPublic, let url = publicURL {
                            Divider().padding(.leading, 54)
                            ShareLink(item: url, subject: Text("\(displayName)'s slate")) {
                                HStack {
                                    Image(systemName: "square.and.arrow.up").frame(width: 22)
                                    Text("Share your slate").font(.headline)
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                                }
                                .foregroundStyle(.primary)
                                .padding(18)
                            }
                        }
                    }
                    .background(.white.opacity(0.045), in: .rect(cornerRadius: 20))
                    .overlay { RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.09), lineWidth: 0.7) }
                    .padding(.horizontal, 18)
                    .padding(.top, 38)

                    Button("Sign out", role: .destructive) {
                        Task { await model.signOut(); dismiss() }
                    }
                    .font(.body.weight(.semibold))
                    .padding(.top, 38)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
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
        .presentationBackground(.ultraThinMaterial)
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
