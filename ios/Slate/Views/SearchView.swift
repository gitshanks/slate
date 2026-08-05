import SwiftUI

struct SearchView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var model: AppModel
    @State private var query = ""
    @State private var payload: CatalogSearchPayload?
    @State private var loading = false

    private let columns = [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    ContentUnavailableView(
                        "Find your next watch",
                        systemImage: "sparkle.magnifyingglass",
                        description: Text("Search films, series, cast, and crew.")
                    )
                    .padding(.top, 120)
                } else if loading && payload == nil {
                    ProgressView().tint(.white).padding(.top, 140)
                } else if let payload {
                    if !payload.people.isEmpty {
                        SearchPeopleRail(people: payload.people)
                    }
                    if payload.approximate, let approximate = payload.approximateQuery {
                        Text("Showing close matches for “\(approximate)”")
                            .font(.caption).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                            .padding(.top, 18)
                    }
                    LazyVGrid(columns: columns, spacing: 24) {
                        ForEach(payload.results) { title in
                            NavigationLink {
                                if let saved = title.saved,
                                   let libraryTitle = model.titles.first(where: { $0.id == saved.id }) {
                                    TitleDetailView(title: libraryTitle)
                                } else {
                                    DiscoverTitleView(mediaType: title.mediaType, tmdbId: title.tmdbId)
                                }
                            } label: {
                                CatalogPosterCard(title: title)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Titles, cast, crew")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .task(id: query) { await performSearch() }
        }
    }

    private func performSearch() async {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { payload = nil; loading = false; return }
        loading = true
        do {
            try await Task.sleep(for: .milliseconds(260))
            guard !Task.isCancelled else { return }
            payload = try await model.search(value)
        } catch is CancellationError {
        } catch {
            model.presentedError = error.localizedDescription
        }
        loading = false
    }
}

private struct SearchPeopleRail: View {
    let people: [CatalogPerson]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("PEOPLE").font(.caption.monospaced().weight(.semibold)).tracking(1.2).foregroundStyle(.secondary)
                .padding(.horizontal, 18)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(people) { person in
                        NavigationLink { PersonView(personId: person.id) } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                AsyncImage(url: person.profileURL) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: { Color.white.opacity(0.06) }
                                .frame(width: 92, height: 92)
                                .clipShape(.rect(cornerRadius: 15))
                                Text(person.name).font(.caption.weight(.semibold)).foregroundStyle(.primary).lineLimit(1)
                                Text(person.knownForDepartment ?? "Person").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                            }
                            .frame(width: 92, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
            }
        }
        .padding(.top, 12)
    }
}

struct CatalogPosterCard: View {
    let title: CatalogTitle

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: title.posterURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: { Color.white.opacity(0.06) }
                .aspectRatio(2 / 3, contentMode: .fit)
                .clipShape(.rect(cornerRadius: 15))
                .overlay { RoundedRectangle(cornerRadius: 15).stroke(.white.opacity(0.1), lineWidth: 0.7) }
                if title.saved != nil {
                    Image(systemName: "checkmark")
                        .font(.caption.bold()).foregroundStyle(.black)
                        .frame(width: 28, height: 28).background(.white.opacity(0.92), in: .circle)
                        .padding(9)
                }
            }
            Text(title.title).font(.body.weight(.semibold)).lineLimit(1)
            HStack(spacing: 7) {
                Text(title.year ?? title.mediaType.rawValue.capitalized)
                if let rating = title.tmdbRating, rating > 0 { Text("·"); Text(String(format: "%.1f", rating)) }
            }
            .font(.caption.monospaced()).foregroundStyle(.secondary)
        }
    }
}

struct DiscoverTitleView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.openURL) private var openURL
    let mediaType: MediaType
    let tmdbId: Int
    @State private var detail: DiscoverDetailPayload?
    @State private var loading = true
    @State private var adding = false

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            if let backdrop = detail?.title.backdropURL {
                AsyncImage(url: backdrop) { image in image.resizable().scaledToFill() } placeholder: { Color(white: 0.07) }
                    .frame(height: 540).clipped().ignoresSafeArea(edges: .top)
                LinearGradient(colors: [.black.opacity(0.18), .black.opacity(0.55), .black], startPoint: .top, endPoint: .bottom)
                    .frame(height: 540).ignoresSafeArea(edges: .top)
            }
            ScrollView {
                if let detail {
                    VStack(alignment: .leading, spacing: 0) {
                        Color.clear.frame(height: 300)
                        DiscoverMetadata(title: detail.title)
                        Text(detail.title.title).font(.system(size: 38, weight: .bold)).tracking(-1.7).padding(.top, 8)
                        HStack(spacing: 9) {
                            if let saved = detail.savedTitle {
                                NavigationLink { TitleDetailView(title: saved) } label: {
                                    DiscoverPill("In your \(saved.status.label.lowercased())", icon: "checkmark", highlighted: true)
                                }
                            } else {
                                Menu {
                                    addButton(.want, "Want")
                                    addButton(.watching, "Watching")
                                    addButton(.watched, "Watched")
                                } label: { DiscoverPill(adding ? "Adding…" : "Add to slate", icon: "plus", highlighted: true) }
                                .disabled(adding)
                            }
                            if let key = detail.trailerKey, let url = URL(string: "https://www.youtube.com/watch?v=\(key)") {
                                Button { openURL(url) } label: { DiscoverPill("Trailer", icon: "play.fill") }
                            }
                            if let providers = detail.watchProviders, !providers.providers.isEmpty {
                                Link(destination: providers.link) { DiscoverPill("Watch", icon: "tv") }
                            }
                        }
                        .padding(.top, 22)
                        if let overview = detail.title.overview, !overview.isEmpty {
                            Text(overview).font(.system(size: 16)).foregroundStyle(.white.opacity(0.82)).lineSpacing(5).padding(.top, 24)
                        }
                        DiscoverPeopleSection(label: "Cast", people: detail.cast)
                        DiscoverPeopleSection(label: "Crew", people: detail.crew)
                        DiscoverRecommendations(label: detail.title.title, items: detail.recommendations)
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 56)
                } else if loading {
                    ProgressView().tint(.white).padding(.top, 220)
                }
            }
        }
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        do { detail = try await model.discover(mediaType: mediaType, tmdbId: tmdbId) }
        catch { model.presentedError = error.localizedDescription }
        loading = false
    }

    private func addButton(_ status: LibraryStatus, _ label: String) -> some View {
        Button(label) {
            adding = true
            Task {
                do {
                    let saved = try await model.addCatalogTitle(tmdbId: tmdbId, mediaType: mediaType, status: status)
                    detail?.savedTitle = saved
                } catch { model.presentedError = error.localizedDescription }
                adding = false
            }
        }
    }
}

private struct DiscoverMetadata: View {
    let title: DiscoverTitle
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Text(title.mediaType == .movie ? "FILM" : "SERIES")
                if let year = title.year { Text("·"); Text(year) }
                if let runtime = title.runtime { Text("·"); Text(runtime >= 60 ? "\(runtime / 60)H \(runtime % 60)M" : "\(runtime)M") }
                ForEach(title.genres.prefix(3), id: \.id) { genre in Text("·"); Text(genre.name.uppercased()) }
                if let imdb = title.imdbRating { Text("·"); Text("IMDb \(String(format: "%.1f", imdb))") }
            }
            .font(.system(size: 11, design: .monospaced)).foregroundStyle(.white.opacity(0.64))
        }
    }
}

private struct DiscoverPill: View {
    let label: String
    let icon: String
    let highlighted: Bool
    init(_ label: String, icon: String, highlighted: Bool = false) { self.label = label; self.icon = icon; self.highlighted = highlighted }
    var body: some View {
        Label(label, systemImage: icon).font(.system(size: 13, weight: .semibold))
            .foregroundStyle(highlighted ? Color(red: 0.72, green: 0.61, blue: 1) : .white.opacity(0.84))
            .padding(.horizontal, 14).frame(height: 40)
            .background(highlighted ? Color.purple.opacity(0.2) : .white.opacity(0.07), in: .capsule)
    }
}

private struct DiscoverPeopleSection: View {
    let label: String
    let people: [TitlePerson]
    var body: some View {
        if !people.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text(label).font(.system(size: 22, weight: .bold))
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 22) {
                    ForEach(people) { person in
                        NavigationLink { PersonView(personId: person.id) } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                AsyncImage(url: person.profileURL) { image in image.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.06) }
                                    .aspectRatio(1, contentMode: .fit).clipShape(.rect(cornerRadius: 13))
                                Text(person.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                                Text(person.subtitle ?? "").font(.system(size: 10)).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(.top, 44)
        }
    }
}

private struct DiscoverRecommendations: View {
    let label: String
    let items: [CatalogTitle]
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 17) {
                Text("If you liked \(label)…").font(.system(size: 22, weight: .bold))
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 11), count: 3), spacing: 22) {
                    ForEach(items) { title in
                        NavigationLink { DiscoverTitleView(mediaType: title.mediaType, tmdbId: title.tmdbId) } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                AsyncImage(url: title.posterURL) { image in image.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.06) }
                                    .aspectRatio(2 / 3, contentMode: .fit).clipShape(.rect(cornerRadius: 13))
                                Text(title.title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                                Text(title.year ?? "").font(.system(size: 11, design: .monospaced)).foregroundStyle(.white.opacity(0.48))
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(.top, 48)
        }
    }
}

struct PersonView: View {
    @EnvironmentObject private var model: AppModel
    let personId: Int
    @State private var person: PersonDetailPayload?

    var body: some View {
        ScrollView {
            if let person {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(alignment: .top, spacing: 20) {
                        AsyncImage(url: person.profileURL) { image in image.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.06) }
                            .frame(width: 128, height: 192).clipShape(.rect(cornerRadius: 18))
                        VStack(alignment: .leading, spacing: 8) {
                            Text(person.knownForDepartment.uppercased()).font(.caption.monospaced()).foregroundStyle(.secondary)
                            Text(person.name).font(.system(size: 32, weight: .bold)).tracking(-1)
                            if let birthday = person.birthday { Text(birthday.prefix(4)).font(.caption.monospaced()).foregroundStyle(.secondary) }
                            if let place = person.placeOfBirth { Text(place).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    if let biography = person.biography, !biography.isEmpty {
                        Text(biography).foregroundStyle(.white.opacity(0.8)).lineSpacing(5)
                    }
                    if !person.knownFor.isEmpty {
                        Text("Known for").font(.title2.bold()).padding(.top, 10)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                            ForEach(person.knownFor) { title in
                                NavigationLink { DiscoverTitleView(mediaType: title.mediaType, tmdbId: title.tmdbId) } label: {
                                    CatalogPosterCard(title: title)
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }.padding(18)
            } else {
                ProgressView().tint(.white).padding(.top, 170)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do { person = try await model.person(id: personId) }
            catch { model.presentedError = error.localizedDescription }
        }
    }
}
