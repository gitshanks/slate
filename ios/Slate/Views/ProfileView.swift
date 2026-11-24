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
    @State private var copied = false
    @State private var deleting = false
    var onOpenShelf: (Shelf) -> Void = { _ in }
    @FocusState private var focused: Field?

    private enum Field { case displayName, username }

    var body: some View {
        let shownAvatarData = previewData ?? model.avatarData
        let shownAvatarURL = model.profile?.avatarUrl
        let shownInitials = initials
        let remoteAvatar = CachedAsyncImage(url: shownAvatarURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Circle().fill(SlatePalette.text.opacity(0.07)).overlay {
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
                        .overlay { Circle().stroke(SlatePalette.text.opacity(0.13), lineWidth: 0.8) }
                    }
                    .buttonStyle(SlatePressStyle())
                    .accessibilityLabel("Change your photo")

                    VStack(alignment: .leading, spacing: 2) {
                        TextField("Your name", text: $displayName)
                            .font(.system(size: 26, weight: .bold))
                            .tracking(-0.6)
                            .foregroundStyle(SlatePalette.text)
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

                if let joined {
                    Text("Joined \(joined)")
                        .font(.system(size: 13))
                        .foregroundStyle(SlatePalette.mutedText)
                        .padding(.top, 10)
                }

                // What is on each shelf: a tap opens it in the Library.
                HStack(spacing: 0) {
                    shelfCount("Up next", .upNext, first: true)
                    shelfCount("Watching", .watching)
                    shelfCount("Watched", .watched)
                }
                .overlay(alignment: .top) { Rectangle().fill(SlatePalette.border.opacity(0.6)).frame(height: 1) }
                .overlay(alignment: .bottom) { Rectangle().fill(SlatePalette.border.opacity(0.6)).frame(height: 1) }
                .padding(.top, 20)

                settingsGroup("Sharing") {
                    settingsRow(
                        "Share your slate",
                        description: isPublic ? "Anyone with the link can browse your shelves." : "Only you can see your shelves."
                    ) {
                        Toggle("Share your slate", isOn: $isPublic).labelsHidden().tint(SlatePalette.accent)
                    }
                    if isPublic, let url = publicURL {
                        groupDivider
                        HStack(spacing: 10) {
                            Image(systemName: "link")
                                .font(.system(size: 14))
                                .foregroundStyle(SlatePalette.mutedText)
                            Text("s1ate.space/u/\(username)")
                                .font(.system(size: 14))
                                .foregroundStyle(SlatePalette.mutedText)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer(minLength: 8)
                            Button {
                                UIPasteboard.general.url = url
                                copied = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
                            } label: {
                                Text(copied ? "Copied" : "Copy link")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(SlatePalette.text)
                                    .padding(.horizontal, 14)
                                    .frame(height: 36)
                                    .background(SlatePalette.fill, in: .rect(cornerRadius: 12))
                                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(SlatePalette.border, lineWidth: 1) }
                            }
                            .buttonStyle(SlatePressStyle())
                            .accessibilityLabel("Copy public profile link")
                            ShareLink(item: url, subject: Text("\(displayName)'s slate")) {
                                Image(systemName: "square.and.arrow.up")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(SlatePalette.text)
                                    .frame(width: 36, height: 36)
                                    .background(SlatePalette.fill, in: .rect(cornerRadius: 12))
                                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(SlatePalette.border, lineWidth: 1) }
                            }
                            .accessibilityLabel("Share your slate")
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                }

                settingsGroup("Appearance") {
                    // On a phone the slider sits under its title, so it keeps
                    // its full width (DESIGN.md, Motion).
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Theme")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(SlatePalette.text)
                        ThemeSlider()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                settingsGroup("Account") {
                    settingsRow("Data and privacy", description: "Review what slate collects.") {
                        Link(destination: URL(string: "https://www.s1ate.space/privacy")!) {
                            Text("Read details")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(SlatePalette.accent)
                                .frame(height: 36)
                        }
                    }
                    groupDivider
                    settingsRow("Signed in", description: "This device is signed in to your account.") {
                        Button {
                            Task { await model.signOut(); dismiss() }
                        } label: {
                            Text("Sign out")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(SlatePalette.text)
                                .padding(.horizontal, 14)
                                .frame(height: 36)
                                .background(SlatePalette.fill, in: .rect(cornerRadius: 12))
                                .overlay { RoundedRectangle(cornerRadius: 12).stroke(SlatePalette.border, lineWidth: 1) }
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                    groupDivider
                    settingsRow("Delete account", description: "Permanently remove your profile, library, and lists you own.") {
                        Button { deleting = true } label: {
                            Text("Delete…")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(SlatePalette.danger)
                                .padding(.horizontal, 14)
                                .frame(height: 36)
                        }
                        .buttonStyle(SlatePressStyle())
                    }
                }
            }
            .padding(.horizontal, SlateMetrics.gutter)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(SlatePalette.background)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $deleting) { DeleteAccountSheet() }
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

    private func shelfCount(_ label: String, _ shelf: Shelf, first: Bool = false) -> some View {
        Button { onOpenShelf(shelf) } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(model.titles.filter { $0.status == shelf.status }.count)")
                    .font(.system(size: 28, weight: .semibold))
                    .tracking(-1.1)
                    .monospacedDigit()
                    .foregroundStyle(SlatePalette.text)
                Text(label)
                    .font(.system(size: 13))
                    .foregroundStyle(SlatePalette.mutedText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, first ? 0 : 16)
            .padding(.vertical, 20)
            .overlay(alignment: .leading) {
                if !first { Rectangle().fill(SlatePalette.border.opacity(0.6)).frame(width: 1) }
            }
            .contentShape(.rect)
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityElement(children: .combine)
    }

    /// A quiet label over one hairlined card (`components/settings-group.tsx`).
    private func settingsGroup<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(SlatePalette.mutedText)
                .padding(.horizontal, 4)
            VStack(spacing: 0) { content() }
                .background(SlatePalette.surface.opacity(0.5), in: .rect(cornerRadius: 20))
                .overlay { RoundedRectangle(cornerRadius: 20).stroke(SlatePalette.border.opacity(0.7), lineWidth: 1) }
        }
        .padding(.top, 36)
    }

    private func settingsRow<Trailing: View>(
        _ title: String,
        description: String? = nil,
        @ViewBuilder trailing: () -> Trailing
    ) -> some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(SlatePalette.text)
                if let description {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundStyle(SlatePalette.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(minHeight: 72)
    }

    private var groupDivider: some View {
        Rectangle().fill(SlatePalette.border.opacity(0.6)).frame(height: 1)
    }

    /// "March 2025", from the profile's creation date.
    private var joined: String? {
        guard let created = model.profile?.createdAt else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: created) ?? ISO8601DateFormatter().date(from: created)
        guard let date else { return nil }
        let format = DateFormatter()
        format.dateFormat = "MMMM yyyy"
        return format.string(from: date)
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

/// Deleting the account (`components/delete-account-settings.tsx`): what goes,
/// that it can't be undone, and DELETE typed to confirm.
private struct DeleteAccountSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var confirmation = ""
    @State private var pending = false
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Delete your Slate account?")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(SlatePalette.text)
            Text("This permanently deletes your profile, saved titles, ratings, notes, and preview preferences. Lists you own will be deleted for everyone. You will leave lists owned by others. You will be signed out on every device.")
                .font(.system(size: 15))
                .lineSpacing(4)
                .foregroundStyle(SlatePalette.mutedText)
            Text("This cannot be undone. You can sign up again with the same email or Google account and start fresh.")
                .font(.system(size: 12))
                .foregroundStyle(SlatePalette.mutedText)
            VStack(alignment: .leading, spacing: 8) {
                (Text("Type ") + Text("DELETE").font(.system(size: 14, weight: .bold, design: .monospaced)) + Text(" to confirm"))
                    .font(.system(size: 14))
                    .foregroundStyle(SlatePalette.text)
                TextField("", text: $confirmation)
                    .font(.system(size: 15, design: .monospaced))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .disabled(pending)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(SlatePalette.background, in: .rect(cornerRadius: 12))
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(SlatePalette.border, lineWidth: 1) }
            }
            if let message {
                Text(message).font(.system(size: 14)).foregroundStyle(SlatePalette.danger)
            }
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Button("Keep my account") { dismiss() }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(SlatePalette.text)
                    .padding(.horizontal, 16)
                    .frame(height: 40)
                    .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
                    .buttonStyle(SlatePressStyle())
                    .disabled(pending)
                Button {
                    pending = true
                    message = nil
                    Task {
                        do {
                            try await model.deleteAccount()
                        } catch {
                            message = error.localizedDescription
                            pending = false
                        }
                    }
                } label: {
                    Text(pending ? "Deleting…" : "Permanently delete")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(SlatePalette.danger.opacity(confirmation == "DELETE" && !pending ? 1 : 0.4), in: .capsule)
                }
                .buttonStyle(SlatePressStyle())
                .disabled(pending || confirmation != "DELETE")
            }
        }
        .padding(22)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(SlatePalette.surface.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(pending)
    }
}
