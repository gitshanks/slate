import SwiftUI
import UIKit

/// The primary destinations of the dock (`components/bottom-nav.tsx`).
enum SlateTab: String, CaseIterable, Identifiable {
    case library
    case discover
    case previews
    case lists

    var id: String { rawValue }

    var label: String {
        switch self {
        case .library: "Library"
        case .discover: "Discover"
        case .previews: "Previews"
        case .lists: "Lists"
        }
    }

    var icon: String {
        switch self {
        case .library: "square.grid.2x2"
        case .discover: "safari"
        case .previews: "movieclapper"
        case .lists: "square.3.layers.3d"
        }
    }
}

/// The Library's two views: the shelf of posters, and Space, every poster on
/// one canvas you pan and zoom.
enum LibraryViewMode: String, CaseIterable {
    case shelf, space
}

/// The web app's tokens (app/globals.css: `:root` for light, `.dark` for
/// dark). Each colour follows the appearance the person chose.
enum SlatePalette {
    static let background = Color(light: (0.981, 0.984, 0.989), dark: (0.039, 0.039, 0.043))
    static let surface = Color(light: (1, 1, 1), dark: (0.067, 0.067, 0.075))
    static let accent = Color(light: (0.229, 0.511, 0.258), dark: (0.678, 0.922, 0.702))
    static let onAccent = Color(light: (1, 1, 1), dark: (0.059, 0.122, 0.071))
    /// The page's ink: body text and the base of every hairline and wash.
    static let text = Color(light: (0.079, 0.098, 0.141), dark: (0.98, 0.98, 0.98))
    static let mutedText = Color(light: (0.364, 0.388, 0.436), dark: (0.584, 0.584, 0.616))
    static let muted = text.opacity(0.52)
    static let hairline = text.opacity(0.085)
    static let border = Color(light: (0.887, 0.896, 0.913), dark: (0.133, 0.133, 0.145))
    static let fill = text.opacity(0.055)
    static let raised = Color(light: (1, 1, 1), dark: (0.086, 0.086, 0.094))
    static let placeholder = Color(light: (0.943, 0.948, 0.957), dark: (0.106, 0.106, 0.118))
    static let danger = Color(light: (0.88, 0.16, 0.16), dark: (1, 0.42, 0.478))
}

extension Color {
    /// One colour for light appearance and one for dark.
    init(light: (Double, Double, Double), dark: (Double, Double, Double)) {
        self.init(uiColor: UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
    }
}

/// Light, System or Dark, as on the web's theme slider. Stored on the device.
enum SlateTheme: String, CaseIterable, Identifiable {
    case light, system, dark

    var id: String { rawValue }
    static let storageKey = "slate.theme"

    var label: String {
        switch self {
        case .light: "Light"
        case .system: "System"
        case .dark: "Dark"
        }
    }

    /// System shows the device it follows: a phone on a phone, a tablet on
    /// an iPad (DESIGN.md, Interaction).
    var icon: String {
        switch self {
        case .light: "sun.max"
        case .system: UIDevice.current.userInterfaceIdiom == .pad ? "ipad" : "iphone"
        case .dark: "moon"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .light: .light
        case .system: nil
        case .dark: .dark
        }
    }
}

enum SlateMetrics {
    /// Page gutter on a phone, shared by every screen.
    static let gutter: CGFloat = 16
    static let posterGap: CGFloat = 10
    static let posterCorner: CGFloat = 12
    /// How much room the floating dock takes above the home indicator.
    static let dockHeight: CGFloat = 76

    /// Posters per row: three on a phone, more as the window widens.
    static func posterColumns(for width: CGFloat) -> [GridItem] {
        let available = width - gutter * 2
        let count = max(3, Int((available + posterGap) / (132 + posterGap)))
        return Array(repeating: GridItem(.flexible(), spacing: posterGap), count: count)
    }

    /// The Library's grid at the web's breakpoints (`LIBRARY_POSTER_GRID_CLASS_NAME`):
    /// four small posters a row on a phone, then three, four, five and six as
    /// the window widens.
    static func libraryGrid(for width: CGFloat) -> (columns: [GridItem], rowGap: CGFloat, compact: Bool) {
        let (count, gap, rowGap): (Int, CGFloat, CGFloat) = switch width {
        case ..<640: (4, 8, 16)
        case ..<768: (3, 20, 40)
        case ..<1024: (4, 20, 40)
        case ..<1536: (5, 20, 40)
        default: (6, 20, 40)
        }
        return (Array(repeating: GridItem(.flexible(), spacing: gap), count: count), rowGap, width < 640)
    }
}

/// A screen pushed over a tab (a title, a person, a list) asks for the top bar
/// and the dock to step aside.
struct SlateChromeHidden: PreferenceKey {
    static let defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

extension View {
    func slateHidesChrome() -> some View {
        preference(key: SlateChromeHidden.self, value: true)
    }

    /// A screen or a whole result set that replaces another fades up over
    /// 220 ms from 45% opacity, never from nothing (DESIGN.md, Motion).
    func slateArrive<Key: Equatable>(on key: Key) -> some View {
        modifier(SlateArrive(key: key))
    }
}

private struct SlateArrive<Key: Equatable>: ViewModifier {
    let key: Key
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var opacity = 1.0

    func body(content: Content) -> some View {
        content
            .opacity(opacity)
            .onChange(of: key, initial: true) { _, _ in
                guard !reduceMotion else { return }
                var still = Transaction()
                still.disablesAnimations = true
                withTransaction(still) { opacity = 0.45 }
                DispatchQueue.main.async {
                    withAnimation(.timingCurve(0.33, 1, 0.68, 1, duration: 0.22)) { opacity = 1 }
                }
            }
    }
}

struct SlateChrome<Content: View>: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var search: SearchSession
    @Binding var selection: SlateTab
    let profileIsOpen: Bool
    /// Previews runs edge to edge, with no top bar.
    var showsTopBar = true
    /// Library, Discover and Lists carry the search field under the top bar.
    var showsSearch = true
    var viewMode: Binding<LibraryViewMode>?
    let onLogo: () -> Void
    let onAdd: () -> Void
    let onProfile: () -> Void
    let onOpenTitle: (SlateTitle) -> Void
    let onOpenCatalog: (CatalogTitle) -> Void
    let onOpenPerson: (Int) -> Void
    @ViewBuilder let content: () -> Content

    @State private var chromeHidden = false

    var body: some View {
        VStack(spacing: 0) {
            if !chromeHidden && showsTopBar {
                SlateTopBar(
                    profile: model.profile,
                    avatarData: model.avatarData,
                    profileIsOpen: profileIsOpen,
                    viewMode: viewMode,
                    onLogo: onLogo,
                    onProfile: onProfile
                )
                if showsSearch {
                    SmartSearchBar()
                        .padding(.horizontal, SlateMetrics.gutter)
                        .padding(.bottom, 10)
                }
            }

            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onPreferenceChange(SlateChromeHidden.self) { hidden in
                    if hidden != chromeHidden { chromeHidden = hidden }
                }
                .overlay(alignment: .top) {
                    if search.isActive && !chromeHidden && showsTopBar && showsSearch {
                        ZStack(alignment: .top) {
                            SlatePalette.background.opacity(0.55)
                                .ignoresSafeArea()
                                .onTapGesture { search.dismiss() }
                            SearchPanel(
                                onOpenTitle: { search.dismiss(); onOpenTitle($0) },
                                onOpenCatalog: { search.isActive = false; onOpenCatalog($0) },
                                onOpenPerson: { search.isActive = false; onOpenPerson($0) }
                            )
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxHeight: .infinity, alignment: .top)
                            .padding(.horizontal, SlateMetrics.gutter)
                            .padding(.bottom, 12)
                        }
                        .transition(.opacity.combined(with: .offset(y: -6)))
                    }
                }
                .animation(.smooth(duration: 0.2), value: search.isActive)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !chromeHidden && !(search.isActive && showsSearch) {
                        SlateDock(selection: $selection, showsSelection: !profileIsOpen, onAdd: onAdd)
                    }
                }
        }
        .background(SlatePalette.background.ignoresSafeArea())
    }
}

struct SlateTopBar: View {
    let profile: SlateProfile?
    let avatarData: Data?
    let profileIsOpen: Bool
    var viewMode: Binding<LibraryViewMode>?
    let onLogo: () -> Void
    let onProfile: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button(action: onLogo) {
                SlateAppWordmark()
            }
            .buttonStyle(SlatePressStyle())
            .accessibilityLabel("Slate home")

            Spacer()

            if let viewMode {
                LiquidSelector(
                    count: 2,
                    selectedIndex: viewMode.wrappedValue == .shelf ? 0 : 1,
                    onSelect: { viewMode.wrappedValue = $0 == 0 ? .shelf : .space }
                ) { index in
                    Image(systemName: index == 0 ? "square.grid.2x2" : "cube")
                        .font(.system(size: 16, weight: .medium))
                        .frame(width: 30)
                        .accessibilityLabel(index == 0 ? "Shelf" : "Space")
                }
                .frame(width: 104, height: 44)
                .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
                .accessibilityLabel("Library view")
            }

            ThemeButton()

            ProfileAvatarButton(profile: profile, data: avatarData, action: onProfile)
                .overlay {
                    Circle()
                        .stroke(profileIsOpen ? SlatePalette.accent : .clear, lineWidth: 1.5)
                        .padding(4)
                        .allowsHitTesting(false)
                }
        }
        .padding(.leading, SlateMetrics.gutter)
        .padding(.trailing, 9)
        .frame(height: 60)
        .background(SlatePalette.background)
    }
}

/// The wordmark alone, as the web's header sets it (`public/brand/wordmark-*.svg`).
struct SlateAppWordmark: View {
    var body: some View {
        Text("slate")
            .font(.system(size: 27, weight: .bold))
            .tracking(-1.2)
            .foregroundStyle(SlatePalette.text)
            .fixedSize()
    }
}

/// The floating dock of the web app (`components/bottom-nav.tsx`): the primary
/// destinations in one liquid selector, and a round button that finds and adds
/// a title.
struct SlateDock: View {
    @Binding var selection: SlateTab
    var showsSelection = true
    let onAdd: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            LiquidSelector(
                count: SlateTab.allCases.count,
                selectedIndex: showsSelection ? SlateTab.allCases.firstIndex(of: selection) ?? 0 : -1,
                springs: .dock,
                trackColor: SlatePalette.raised,
                reportsReselect: true,
                onSelect: { selection = SlateTab.allCases[$0] }
            ) { index in
                let tab = SlateTab.allCases[index]
                VStack(spacing: 4) {
                    Image(systemName: tab.icon)
                        .font(.system(size: 18, weight: .medium))
                        .frame(height: 20)
                    Text(tab.label)
                        .font(.system(size: 11, weight: .medium))
                        .lineLimit(1)
                }
            }
            .frame(height: 60)
            .overlay { Capsule().stroke(SlatePalette.text.opacity(0.12), lineWidth: 1) }

            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(SlatePalette.accent)
                    .frame(width: 60, height: 60)
                    .background(SlatePalette.raised, in: .circle)
                    .overlay { Circle().stroke(SlatePalette.text.opacity(0.14), lineWidth: 1) }
            }
            .buttonStyle(SlatePressStyle())
            .accessibilityLabel("Find and add a title")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: 430)
        .frame(height: SlateMetrics.dockHeight)
        .frame(maxWidth: .infinity)
        .background {
            LinearGradient(
                colors: [
                    SlatePalette.background.opacity(0),
                    SlatePalette.background.opacity(0.92),
                    SlatePalette.background,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        }
    }
}

/// A screen's name. No label sits above it: the heading carries its own weight.
struct SlateScreenTitle<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(title)
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.8)
                .foregroundStyle(SlatePalette.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            trailing()
        }
    }
}

extension SlateScreenTitle where Trailing == EmptyView {
    init(_ title: String) {
        self.title = title
        self.trailing = { EmptyView() }
    }
}

/// A filled pill in the theme colour: the one primary action of a card or sheet.
struct SlatePrimaryButton: View {
    let label: String
    var enabled = true
    let action: () -> Void

    init(_ label: String, enabled: Bool = true, action: @escaping () -> Void) {
        self.label = label
        self.enabled = enabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .foregroundStyle(SlatePalette.onAccent)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(SlatePalette.accent.opacity(enabled ? 1 : 0.6), in: .capsule)
                .contentShape(.capsule)
        }
        .buttonStyle(SlatePressStyle())
        .disabled(!enabled)
    }
}

/// A quiet pill beside or under a primary one.
struct SlateSecondaryButton: View {
    let label: String
    let action: () -> Void

    init(_ label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .foregroundStyle(SlatePalette.text)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(SlatePalette.fill, in: .capsule)
                .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
                .contentShape(.capsule)
        }
        .buttonStyle(SlatePressStyle())
    }
}

/// A short centred message for a screen with nothing to show.
struct SlateEmptyMessage: View {
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(SlatePalette.text)
            Text(message)
                .font(.system(size: 14))
                .lineSpacing(3)
                .foregroundStyle(SlatePalette.mutedText)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }
}

/// A 2:3 poster with the title set in its place until, or unless, the artwork
/// loads. The artwork fades in once decoded.
struct PosterFrame<Overlay: View>: View {
    let url: URL?
    let title: String
    var corner: CGFloat = SlateMetrics.posterCorner
    @ViewBuilder var overlay: () -> Overlay

    var body: some View {
        Color.clear
            .aspectRatio(2 / 3, contentMode: .fit)
            .overlay {
                CachedAsyncPhaseImage(url: url, transaction: .init(animation: .easeOut(duration: 0.22))) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        fallback
                    case .empty:
                        if url == nil { fallback } else { SlatePalette.placeholder }
                    }
                }
            }
            .background(SlatePalette.placeholder)
            .clipShape(.rect(cornerRadius: corner))
            .overlay { overlay() }
            .contentShape(.rect(cornerRadius: corner))
    }

    private var fallback: some View {
        Text(title)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(SlatePalette.mutedText)
            .multilineTextAlignment(.center)
            .lineLimit(4)
            .padding(8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

extension PosterFrame where Overlay == EmptyView {
    init(url: URL?, title: String, corner: CGFloat = SlateMetrics.posterCorner) {
        self.url = url
        self.title = title
        self.corner = corner
        self.overlay = { EmptyView() }
    }
}

/// One library poster. The artwork is the whole tile; a reaction shows as a
/// small badge.
struct PosterTile: View {
    let title: SlateTitle
    var corner: CGFloat = SlateMetrics.posterCorner

    var body: some View {
        PosterFrame(url: title.posterURL, title: title.title, corner: corner) {
            if let rating = title.rating {
                Image(systemName: rating >= 3 ? "heart.fill" : rating >= 2 ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 25, height: 25)
                    .background(.black.opacity(0.6), in: .circle)
                    .padding(6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .accessibilityLabel(rating >= 3 ? "Loved" : rating >= 2 ? "Liked" : "Disliked")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title.title)
    }
}

/// A Library poster as the web's profile cards draw it: a border in the
/// shelf's tone (mint for Watching, faint mint for Watched), and under it the
/// title, the shelf in small capitals and the year.
struct LibraryPosterCard: View {
    let title: SlateTitle
    var compact = true

    private var tone: (border: Color, meta: Color) {
        switch title.status {
        case .watching: (SlatePalette.accent.opacity(0.8), SlatePalette.accent)
        case .watched: (SlatePalette.accent.opacity(0.35), SlatePalette.accent.opacity(0.65))
        default: (SlatePalette.border, SlatePalette.mutedText)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 2 : 4) {
            PosterTile(title: title, corner: 16)
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(tone.border, lineWidth: 1) }
                .shadow(color: .black.opacity(0.35), radius: 14, y: 10)
            Text(title.title)
                .font(.system(size: compact ? 10 : 12, weight: .medium))
                .foregroundStyle(SlatePalette.text.opacity(0.85))
                .lineLimit(1)
                .padding(.top, compact ? 4 : 6)
            HStack(spacing: 4) {
                SlateMonoLabel(title.status.label, color: tone.meta, size: compact ? 7.5 : 9)
                Spacer(minLength: 0)
                if let year = title.year {
                    SlateMonoLabel(year, color: SlatePalette.mutedText.opacity(0.7), size: compact ? 7.5 : 9)
                }
            }
        }
        .padding(.horizontal, 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title.title), \(title.status.label)\(title.year.map { ", \($0)" } ?? "")")
    }
}

/// A catalogue poster. A tick marks one already on your slate.
struct RailPoster: View {
    let item: DiscoverRailItem
    var saved: Bool?

    var body: some View {
        let isSaved = saved ?? item.saved
        PosterFrame(url: item.posterURL, title: item.title) {
            if isSaved {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(SlatePalette.onAccent)
                    .frame(width: 20, height: 20)
                    .background(SlatePalette.accent, in: .circle)
                    .padding(6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isSaved ? "\(item.title), on your slate" : item.title)
    }
}

/// Wraps its children onto as many rows as they need.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        return CGSize(width: proposal.width ?? rows.width, height: rows.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews, width: bounds.width)
        for (index, origin) in rows.origins.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> (origins: [CGPoint], width: CGFloat, height: CGFloat) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return (origins, widest, y + rowHeight)
    }
}

struct SlatePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.78 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
