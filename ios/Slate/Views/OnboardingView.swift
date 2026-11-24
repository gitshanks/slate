import SwiftUI

/// The first-run picks (`components/onboarding/onboarding-deck.tsx`): ten
/// titles, one at a time, each kept for later or passed. Then "A good
/// beginning.": the picks, and more based on what was kept, any of which can
/// join them before the first shelf is made.
struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel
    let payload: OnboardingPayload
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var index = 0
    @State private var kept: [OnboardingTitle] = []
    @State private var passed: [OnboardingTitle] = []
    @State private var drag: CGSize = .zero
    @State private var suggestions: [OnboardingTitle]?
    @State private var suggestionsFailed = false
    @State private var chosen: Set<String> = []
    @State private var saving = false
    @State private var saveError: String?

    private var deck: [OnboardingTitle] { payload.titles }
    private var finished: Bool { index >= deck.count }

    var body: some View {
        VStack(spacing: 0) {
            header
            if finished { shelf } else { card }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            // The card's own still, blurred far behind it; it never sets the
            // width of the page.
            ZStack {
                SlatePalette.background
                if !finished, let current = deck[safe: index] {
                    Color.clear
                        .overlay {
                            CachedAsyncImage(url: current.backdropURL) { image in
                                image.resizable().scaledToFill()
                            } placeholder: { Color.clear }
                        }
                        .clipped()
                        .blur(radius: 40)
                        .opacity(0.35)
                        .id(current.id)
                        .transition(.opacity)
                }
            }
            .ignoresSafeArea()
        }
        .environment(\.colorScheme, .dark)
        .animation(reduceMotion ? nil : .smooth(duration: 0.35), value: index)
        #if DEBUG
        .onAppear {
            guard SlatePreview.isOn, UserDefaults.standard.bool(forKey: "slateOnboardingDone") else { return }
            kept = Array(deck.prefix(7))
            passed = Array(deck.dropFirst(7))
            index = deck.count
            Task { await loadSuggestions() }
        }
        #endif
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 18) {
            HStack {
                Text("slate")
                    .font(.system(size: 34, weight: .bold))
                    .tracking(-1.5)
                    .foregroundStyle(.white)
                Spacer()
                if finished {
                    Button {
                        kept = []
                        passed = []
                        suggestions = nil
                        chosen = []
                        index = 0
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Start the picks again")
                } else {
                    Button("Skip") { index = deck.count }
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .overlay { Capsule().stroke(.white.opacity(0.18), lineWidth: 1) }
                }
            }
            HStack(spacing: 12) {
                SlateMonoLabel(finished ? "Ready" : "A few to start", color: .white.opacity(0.55))
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.12))
                        Capsule().fill(SlatePalette.accent)
                            .frame(width: proxy.size.width * CGFloat(min(index, deck.count)) / CGFloat(max(deck.count, 1)))
                    }
                }
                .frame(height: 2)
                SlateMonoLabel(
                    finished ? "\(kept.count) kept" : String(format: "%02d / %02d", index + 1, deck.count),
                    color: .white.opacity(0.85)
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    // MARK: The deck

    private var card: some View {
        let current = deck[index]
        return VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ZStack {
                        if let next = deck[safe: index + 1] {
                            PosterFrame(url: next.posterURL, title: next.title, corner: 22)
                                .frame(width: 168)
                                .rotationEffect(.degrees(4))
                                .offset(x: 22, y: 8)
                                .opacity(0.5)
                        }
                        PosterFrame(url: current.posterURL, title: current.title, corner: 22)
                            .frame(width: 168)
                            .overlay { RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.14), lineWidth: 1) }
                            .shadow(color: .black.opacity(0.5), radius: 24, y: 16)
                            .offset(drag)
                            .rotationEffect(.degrees(Double(drag.width) / 18))
                            .overlay(alignment: .top) { swipeHint }
                            .gesture(swipe)
                            .id(current.id)
                            .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 0.96)), removal: .opacity))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 28)

                    Text(current.title)
                        .font(.system(size: 34, weight: .bold))
                        .tracking(-1.3)
                        .foregroundStyle(.white.opacity(0.92))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 26)
                    HStack(spacing: 8) {
                        SlateMonoLabel(current.mediaType == .movie ? "Film" : "Series", color: .white.opacity(0.6), size: 12)
                        if let year = current.year {
                            SlateMonoLabel("·", color: .white.opacity(0.4), size: 12)
                            SlateMonoLabel(year, color: .white.opacity(0.6), size: 12)
                        }
                        if let genre = current.genres.first {
                            SlateMonoLabel("·", color: .white.opacity(0.4), size: 12)
                            SlateMonoLabel(genre, color: .white.opacity(0.6), size: 12)
                        }
                    }
                    .padding(.top, 12)
                    Text(current.overview)
                        .font(.system(size: 16))
                        .lineSpacing(5)
                        .foregroundStyle(.white.opacity(0.6))
                        .padding(.top, 14)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }

            HStack(spacing: 12) {
                Button { decide(keep: false) } label: {
                    Label("Pass", systemImage: "xmark")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .overlay { Capsule().stroke(.white.opacity(0.2), lineWidth: 1) }
                        .contentShape(.capsule)
                }
                .buttonStyle(SlatePressStyle())
                .frame(width: 130)
                Button { decide(keep: true) } label: {
                    Label("Keep for later", systemImage: "plus")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(SlatePalette.onAccent)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(SlatePalette.accent, in: .capsule)
                        .contentShape(.capsule)
                }
                .buttonStyle(SlatePressStyle())
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(.black.opacity(0.35).blendMode(.multiply))
        }
    }

    @ViewBuilder
    private var swipeHint: some View {
        if abs(drag.width) > 30 {
            Text(drag.width > 0 ? "KEEP" : "PASS")
                .font(Font.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(drag.width > 0 ? SlatePalette.onAccent : Color.white)
                .padding(.horizontal, 12)
                .frame(height: 30)
                .background(drag.width > 0 ? SlatePalette.accent : Color.white.opacity(0.2), in: .capsule)
                .padding(.top, 14)
                .opacity(Double(min(1, (abs(drag.width) - 30) / 60)))
        }
    }

    private var swipe: some Gesture {
        DragGesture()
            .onChanged { drag = $0.translation }
            .onEnded { value in
                let distance = value.predictedEndTranslation.width
                if abs(distance) > 140 {
                    decide(keep: distance > 0)
                } else {
                    withAnimation(.spring(duration: 0.3)) { drag = .zero }
                }
            }
    }

    private func decide(keep: Bool) {
        guard let current = deck[safe: index] else { return }
        if keep { kept.append(current) } else { passed.append(current) }
        drag = .zero
        index += 1
        if index >= deck.count { Task { await loadSuggestions() } }
    }

    // MARK: The first shelf

    private var shelf: some View {
        ScrollView {
            VStack(spacing: 0) {
                SlateMonoLabel("Your first shelf", color: SlatePalette.accent, size: 13)
                    .padding(.top, 36)
                Text(kept.isEmpty ? "Let's find a few." : "A good beginning.")
                    .font(.system(size: 44, weight: .bold))
                    .tracking(-2)
                    .foregroundStyle(.white.opacity(0.94))
                    .multilineTextAlignment(.center)
                    .padding(.top, 14)
                Text(kept.isEmpty
                     ? "Nothing kept yet. Pick from the ones below, or start empty."
                     : "Start with your picks, or find a few more to look forward to.")
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                Button(action: save) {
                    HStack(spacing: 10) {
                        Text(saving ? "Making your shelf…" : startLabel)
                        Image(systemName: "arrow.right")
                    }
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(SlatePalette.onAccent)
                    .padding(.horizontal, 26)
                    .frame(height: 56)
                    .background(SlatePalette.accent, in: .capsule)
                    .padding(12)
                    .background(.black.opacity(0.5), in: .capsule)
                }
                .buttonStyle(SlatePressStyle())
                .disabled(saving)
                .padding(.top, 28)
                if let saveError {
                    Text(saveError)
                        .font(.system(size: 14))
                        .foregroundStyle(SlatePalette.danger)
                        .multilineTextAlignment(.center)
                        .padding(.top, 10)
                }

                if !kept.isEmpty {
                    sectionHeading("You picked", count: kept.count)
                    posterGrid(kept, selectable: false)
                }

                sectionHeading("Based on what you liked", count: nil)
                Text(suggestionsFailed
                     ? "Suggestions couldn't load. Start with just your picks."
                     : suggestions?.isEmpty == true
                        ? "No close matches this time. Your picks are a great place to start."
                        : "Add any that catch your eye. Tap again to leave it out.")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 14)
                if let suggestions {
                    posterGrid(suggestions, selectable: true)
                } else if !suggestionsFailed {
                    ProgressView().tint(.white.opacity(0.6)).padding(.vertical, 40)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 40)
        }
    }

    private var startLabel: String {
        let total = kept.count + chosen.count
        if total == 0 { return "Start with an empty slate" }
        return total == 1 ? "Start with 1 title" : "Start with \(total) titles"
    }

    private func sectionHeading(_ text: String, count: Int?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(text)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(.white.opacity(0.94))
            if let count {
                Text("\(count)").font(.system(size: 17)).foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
        }
        .padding(.top, 44)
        .padding(.bottom, 14)
    }

    private func posterGrid(_ titles: [OnboardingTitle], selectable: Bool) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), alignment: .leading, spacing: 18) {
            ForEach(titles) { title in
                let on = chosen.contains(title.id)
                Button {
                    guard selectable else { return }
                    if on { chosen.remove(title.id) } else { chosen.insert(title.id) }
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        PosterFrame(url: title.posterURL, title: title.title, corner: 14) {
                            if selectable {
                                Image(systemName: on ? "checkmark" : "plus")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(on ? SlatePalette.onAccent : .white)
                                    .frame(width: 26, height: 26)
                                    .background(on ? SlatePalette.accent : .black.opacity(0.55), in: .circle)
                                    .padding(7)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                            }
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(on ? SlatePalette.accent : .white.opacity(0.12), lineWidth: on ? 2 : 1)
                        }
                        Text(title.title)
                            .font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.75))
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(SlatePressStyle())
                .disabled(!selectable)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }

    private func loadSuggestions() async {
        guard suggestions == nil else { return }
        do {
            let found = try await model.onboardingSuggestions(kept: kept.map(\.pick), passed: passed.map(\.pick))
            let seen = Set(deck.map(\.id))
            suggestions = found.filter { !seen.contains($0.id) }
        } catch {
            suggestionsFailed = true
        }
    }

    private func save() {
        saving = true
        saveError = nil
        let extra = (suggestions ?? []).filter { chosen.contains($0.id) }
        let selections = (kept + extra).map(\.pick)
        Task {
            do {
                try await model.completeOnboarding(selections, more: payload.more)
                onDone()
            } catch {
                saveError = "Your picks could not be saved. Nothing is lost — try once more."
            }
            saving = false
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
