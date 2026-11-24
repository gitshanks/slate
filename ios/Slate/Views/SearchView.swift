import SwiftUI

private struct SearchPeopleRail: View {
    let people: [CatalogPerson]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("People").font(.system(size: 15, weight: .semibold)).foregroundStyle(SlatePalette.text)
                .padding(.horizontal, 18)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(people) { person in
                        NavigationLink { PersonView(personId: person.id) } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                CachedAsyncImage(url: person.profileURL) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: { SlatePalette.text.opacity(0.06) }
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
                CachedAsyncImage(url: title.posterURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: { SlatePalette.text.opacity(0.06) }
                .aspectRatio(2 / 3, contentMode: .fit)
                .clipShape(.rect(cornerRadius: 15))
                .overlay { RoundedRectangle(cornerRadius: 15).stroke(SlatePalette.text.opacity(0.1), lineWidth: 0.7) }
                if title.saved != nil {
                    Image(systemName: "checkmark")
                        .font(.caption.bold()).foregroundStyle(SlatePalette.onAccent)
                        .frame(width: 28, height: 28).background(SlatePalette.accent, in: .circle)
                        .padding(9)
                }
            }
            Text(title.title).font(.body.weight(.semibold)).lineLimit(1)
            HStack(spacing: 7) {
                Text(title.year ?? (title.mediaType == .movie ? "Film" : "Series"))
                if let rating = title.tmdbRating, rating > 0 { Text("·"); Text(String(format: "%.1f", rating)) }
            }
            .font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct DiscoverTitleView: View {
    @EnvironmentObject private var model: AppModel
    let mediaType: MediaType
    let tmdbId: Int
    @State private var detail: DiscoverDetailPayload?
    @State private var loading = true
    @State private var adding = false
    @State private var trailer: TrailerPresentation?

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                SlatePalette.background.ignoresSafeArea()
                if let backdrop = detail?.title.backdropURL {
                    CachedAsyncImage(url: backdrop) { image in image.resizable().scaledToFill() } placeholder: { SlatePalette.placeholder }
                        .frame(width: proxy.size.width, height: 760)
                        .clipped()
                    LinearGradient(colors: [SlatePalette.background.opacity(0.42), SlatePalette.background.opacity(0.68),  SlatePalette.background], startPoint: .top, endPoint: .bottom)
                        .frame(width: proxy.size.width, height: 760)
                }
                ScrollView {
                    if let detail {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(detail.title.title).font(.system(size: 32, weight: .semibold)).tracking(-0.9)
                            DiscoverMetadata(title: detail.title).padding(.top, 8)
                            HStack(spacing: 9) {
                                if let saved = detail.savedTitle {
                                    NavigationLink { TitleDetailView(title: saved) } label: {
                                        DiscoverPill(saved.status.label, icon: "checkmark", highlighted: true)
                                    }
                                } else {
                                    Menu {
                                        addButton(.want, "Up Next")
                                        addButton(.watching, "Watching")
                                        addButton(.watched, "Watched")
                                    } label: { DiscoverPill(adding ? "Adding…" : "Add to slate", icon: "plus", highlighted: true) }
                                    .disabled(adding)
                                }
                                if let key = detail.trailerKey {
                                    Button {
                                        trailer = TrailerPresentation(videoID: key, title: detail.title.title)
                                    } label: { DiscoverPill("Trailer", icon: "play.fill") }
                                }
                                if let providers = detail.watchProviders, !providers.providers.isEmpty {
                                    Link(destination: providers.link) { DiscoverPill("Watch", icon: "tv") }
                                }
                            }
                            .padding(.top, 22)
                            if let overview = detail.title.overview, !overview.isEmpty {
                                Text(overview).font(.system(size: 16)).foregroundStyle(SlatePalette.text.opacity(0.82)).lineSpacing(5).padding(.top, 24)
                            }
                            DiscoverPeopleSection(label: "Cast", people: detail.cast)
                            DiscoverPeopleSection(label: "Crew", people: detail.crew)
                            DiscoverRecommendations(label: detail.title.title, items: detail.recommendations)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 18)
                        .padding(.top, 30)
                        .padding(.bottom, 56)
                    } else if loading {
                        ProgressView().tint(SlatePalette.text).padding(.top, 220)
                    }
                }
                .frame(width: proxy.size.width)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .slateHidesChrome()
        .task { await load() }
        .fullScreenCover(item: $trailer) { trailer in
            TrailerPlayerView(trailer: trailer)
        }
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
                Text(title.mediaType == .movie ? "Film" : "Series")
                if let year = title.year { Text("·"); Text(year) }
                if let runtime = title.runtime { Text("·"); Text(runtime >= 60 ? "\(runtime / 60)h \(runtime % 60)m" : "\(runtime)m") }
                ForEach(title.genres.prefix(3), id: \.id) { genre in Text("·"); Text(genre.name) }
                if let imdb = title.imdbRating { Text("·"); Text("IMDb \(String(format: "%.1f", imdb))") }
            }
            .font(.system(size: 13)).foregroundStyle(SlatePalette.text.opacity(0.66))
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
            .foregroundStyle(highlighted ? SlatePalette.accent : SlatePalette.text.opacity(0.84))
            .padding(.horizontal, 14).frame(height: 40)
            .background(highlighted ? SlatePalette.accent.opacity(0.19) : SlatePalette.text.opacity(0.07), in: .capsule)
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
                                CachedAsyncImage(url: person.profileURL) { image in image.resizable().scaledToFill() } placeholder: { SlatePalette.text.opacity(0.06) }
                                    .aspectRatio(1, contentMode: .fit).clipShape(.rect(cornerRadius: 13))
                                Text(person.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(SlatePalette.text).lineLimit(1)
                                Text(person.subtitle ?? "").font(.system(size: 10)).foregroundStyle(SlatePalette.text.opacity(0.5)).lineLimit(1)
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
                                CachedAsyncImage(url: title.posterURL) { image in image.resizable().scaledToFill() } placeholder: { SlatePalette.text.opacity(0.06) }
                                    .aspectRatio(2 / 3, contentMode: .fit).clipShape(.rect(cornerRadius: 13))
                                Text(title.title).font(.system(size: 12, weight: .semibold)).foregroundStyle(SlatePalette.text).lineLimit(1)
                                Text(title.year ?? "").font(.system(size: 11)).foregroundStyle(SlatePalette.text.opacity(0.48))
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
                        CachedAsyncImage(url: person.profileURL) { image in image.resizable().scaledToFill() } placeholder: { SlatePalette.text.opacity(0.06) }
                            .frame(width: 128, height: 192).clipShape(.rect(cornerRadius: 18))
                        VStack(alignment: .leading, spacing: 8) {
                            Text(person.name).font(.system(size: 30, weight: .bold)).tracking(-0.8)
                            Text(person.knownForDepartment).font(.system(size: 13)).foregroundStyle(.secondary)
                            if let birthday = person.birthday { Text(birthday.prefix(4)).font(.caption).foregroundStyle(.secondary) }
                            if let place = person.placeOfBirth { Text(place).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    if let biography = person.biography, !biography.isEmpty {
                        Text(biography).foregroundStyle(SlatePalette.text.opacity(0.8)).lineSpacing(5)
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
                ProgressView().tint(SlatePalette.text).padding(.top, 170)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .slateHidesChrome()
        .task {
            do { person = try await model.person(id: personId) }
            catch { model.presentedError = error.localizedDescription }
        }
    }
}
