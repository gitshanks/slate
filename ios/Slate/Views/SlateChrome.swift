import SwiftUI
import UIKit

/// The primary destinations of the dock.
enum SlateTab: String, CaseIterable, Identifiable {
    case library
    case discover
    case lists

    var id: String { rawValue }

    var label: String {
        switch self {
        case .library: "Library"
        case .discover: "Discover"
        case .lists: "Lists"
        }
    }

    var icon: String {
        switch self {
        case .library: "square.grid.2x2"
        case .discover: "safari"
        case .lists: "square.stack"
        }
    }
}

/// The web app's dark tokens (app/globals.css, `.dark`).
enum SlatePalette {
    static let background = Color(red: 0.039, green: 0.039, blue: 0.043)
    static let surface = Color(red: 0.067, green: 0.067, blue: 0.075)
    static let accent = Color(red: 0.678, green: 0.922, blue: 0.702)
    static let onAccent = Color(red: 0.059, green: 0.122, blue: 0.071)
    static let mutedText = Color(red: 0.584, green: 0.584, blue: 0.616)
    static let muted = Color.white.opacity(0.52)
    static let hairline = Color.white.opacity(0.085)
    static let border = Color(red: 0.133, green: 0.133, blue: 0.145)
    static let fill = Color.white.opacity(0.055)
    static let raised = Color(red: 0.086, green: 0.086, blue: 0.094)
    static let placeholder = Color(red: 0.106, green: 0.106, blue: 0.118)
    static let danger = Color(red: 1, green: 0.42, blue: 0.478)
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
    @Binding var selection: SlateTab
    let profileIsOpen: Bool
    let onLogo: () -> Void
    let onAdd: () -> Void
    let onProfile: () -> Void
    @ViewBuilder let content: () -> Content

    @State private var chromeHidden = false

    var body: some View {
        VStack(spacing: 0) {
            if !chromeHidden {
                SlateTopBar(
                    profile: model.profile,
                    avatarData: model.avatarData,
                    profileIsOpen: profileIsOpen,
                    onLogo: onLogo,
                    onProfile: onProfile
                )
            }

            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onPreferenceChange(SlateChromeHidden.self) { hidden in
                    if hidden != chromeHidden { chromeHidden = hidden }
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !chromeHidden {
                        SlateDock(selection: $selection, onAdd: onAdd)
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
    let onLogo: () -> Void
    let onProfile: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            Button(action: onLogo) {
                SlateAppWordmark()
            }
            .buttonStyle(SlatePressStyle())
            .accessibilityLabel("Slate home")

            Spacer()

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
        .frame(height: 56)
        .background(SlatePalette.background)
    }
}

struct SlateAppWordmark: View {
    var body: some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 2.5) {
                Capsule().fill(Color.white).frame(width: 12, height: 3.5)
                HStack(spacing: 2.5) {
                    Capsule().fill(Color.white).frame(width: 4.75, height: 3.5)
                    Capsule().fill(Color.white).frame(width: 4.75, height: 3.5)
                }
            }
            Text("slate")
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .tracking(-1.1)
                .foregroundStyle(.white)
        }
        .fixedSize()
    }
}

/// The floating dock of the web app (`components/bottom-nav.tsx`): the primary
/// destinations in one liquid selector, and a round button that finds and adds
/// a title.
struct SlateDock: View {
    @Binding var selection: SlateTab
    let onAdd: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            LiquidSelector(
                count: SlateTab.allCases.count,
                selectedIndex: SlateTab.allCases.firstIndex(of: selection) ?? 0,
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
            .overlay { Capsule().stroke(.white.opacity(0.12), lineWidth: 1) }

            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(SlatePalette.accent)
                    .frame(width: 60, height: 60)
                    .background(SlatePalette.raised, in: .circle)
                    .overlay { Circle().stroke(.white.opacity(0.14), lineWidth: 1) }
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
                .foregroundStyle(.white)
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
                .foregroundStyle(.white)
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
                .foregroundStyle(.white)
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

    var body: some View {
        PosterFrame(url: title.posterURL, title: title.title) {
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
