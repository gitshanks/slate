import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            LibraryScreen(status: .want)
                .tabItem { Label("Watchlist", systemImage: "clock") }
            LibraryScreen(status: .watching)
                .tabItem { Label("Watching", systemImage: "eye") }
            LibraryScreen(status: .watched)
                .tabItem { Label("Watched", systemImage: "checkmark") }
            ListsScreen()
                .tabItem { Label("Lists", systemImage: "square.3.layers.3d") }
            ProfileScreen()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
        .tint(Color(red: 0.58, green: 0.43, blue: 0.96))
    }
}

private struct LibraryScreen: View {
    @EnvironmentObject private var model: AppModel
    let status: LibraryStatus

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                let titles = model.titles(in: status)
                if titles.isEmpty {
                    ContentUnavailableView(
                        status == .want ? "Your watchlist is empty" : "Nothing here yet",
                        systemImage: status == .watched ? "checkmark.circle" : "film",
                        description: Text("Search and save a title to see it here.")
                    )
                    .padding(.top, 120)
                } else {
                    LazyVGrid(columns: columns, spacing: 24) {
                        ForEach(titles) { title in
                            NavigationLink {
                                TitleDetailView(title: title)
                            } label: {
                                PosterCard(title: title)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 24)
                }
            }
            .refreshable { await model.refreshLibrary() }
            .navigationTitle(status.label)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: {}) { Image(systemName: "magnifyingglass") }
                        .accessibilityLabel("Search")
                }
            }
        }
    }
}

private struct PosterCard: View {
    let title: SlateTitle

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            AsyncImage(url: title.posterURL, transaction: .init(animation: .smooth)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    posterPlaceholder
                default:
                    posterPlaceholder.overlay { ProgressView().tint(.white.opacity(0.65)) }
                }
            }
            .aspectRatio(2 / 3, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 15))
            .overlay {
                RoundedRectangle(cornerRadius: 15)
                    .stroke(.white.opacity(0.11), lineWidth: 0.7)
            }

            Text(title.title)
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            if let year = title.year {
                Text(year)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(.rect)
    }

    private var posterPlaceholder: some View {
        Rectangle()
            .fill(Color.white.opacity(0.06))
            .overlay {
                Image(systemName: "film")
                    .font(.title2)
                    .foregroundStyle(.tertiary)
            }
    }
}

private struct TitleDetailView: View {
    let title: SlateTitle

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                AsyncImage(url: title.posterURL) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    RoundedRectangle(cornerRadius: 22).fill(.white.opacity(0.06))
                }
                .clipShape(.rect(cornerRadius: 22))
                .frame(maxWidth: 280)
                .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: 8) {
                    Text(title.title).font(.largeTitle.bold())
                    if let year = title.year { Text(year).foregroundStyle(.secondary) }
                }
                if let overview = title.overview {
                    Text(overview)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .lineSpacing(4)
                }
            }
            .padding(20)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ListsScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List(model.lists) { list in
                VStack(alignment: .leading, spacing: 4) {
                    Text(list.name).font(.headline)
                    if let description = list.description {
                        Text(description).foregroundStyle(.secondary).lineLimit(2)
                    }
                }
                .padding(.vertical, 6)
            }
            .navigationTitle("Lists")
        }
    }
}

private struct ProfileScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if let profile = model.profile {
                    AsyncImage(url: profile.avatarUrl) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Circle().fill(.white.opacity(0.08))
                    }
                    .frame(width: 96, height: 96)
                    .clipShape(.circle)
                    Text(profile.displayName).font(.title2.bold())
                    Text("@\(profile.username)").foregroundStyle(.secondary)
                    Label(
                        profile.isPublic ? "Public profile" : "Private profile",
                        systemImage: profile.isPublic ? "globe" : "lock"
                    )
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(.thinMaterial, in: .capsule)
                }
                Spacer()
                Button("Sign out", role: .destructive) {
                    Task { await model.signOut() }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(24)
            .navigationTitle("Profile")
        }
    }
}
