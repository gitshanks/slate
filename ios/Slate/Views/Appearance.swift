import SwiftUI
import UIKit

/// Applies the chosen theme to every window. Dark is the default, as on the
/// web (`defaultTheme="dark"` in app/layout.tsx).
@MainActor
enum SlateAppearance {
    static var stored: SlateTheme {
        SlateTheme(rawValue: UserDefaults.standard.string(forKey: SlateTheme.storageKey) ?? "") ?? .dark
    }

    /// Sets the stored theme on the windows, without a fade (at launch).
    static func applyStored() {
        set(stored)
    }

    /// Changes the theme behind one even crossfade of the whole screen, after
    /// the control's thumb has landed (DESIGN.md, Motion). A choice that looks
    /// the same (Dark to System on a dark phone) gets no fade.
    static func choose(_ theme: SlateTheme, reduceMotion: Bool) {
        UserDefaults.standard.set(theme.rawValue, forKey: SlateTheme.storageKey)
        guard changesLook(to: theme), !reduceMotion else {
            set(theme)
            return
        }
        for window in windows {
            UIView.transition(
                with: window,
                duration: 0.32,
                options: [.transitionCrossDissolve, .allowUserInteraction],
                animations: { window.overrideUserInterfaceStyle = style(theme) }
            )
        }
    }

    private static func set(_ theme: SlateTheme) {
        for window in windows { window.overrideUserInterfaceStyle = style(theme) }
    }

    private static func style(_ theme: SlateTheme) -> UIUserInterfaceStyle {
        switch theme {
        case .light: .light
        case .system: .unspecified
        case .dark: .dark
        }
    }

    private static func changesLook(to theme: SlateTheme) -> Bool {
        guard let window = windows.first else { return true }
        let now = window.traitCollection.userInterfaceStyle
        let device = window.windowScene?.screen.traitCollection.userInterfaceStyle ?? .dark
        let next: UIUserInterfaceStyle = theme == .system ? device : style(theme)
        return next != now
    }

    private static var windows: [UIWindow] {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
    }
}

/// Light, System and Dark as stops on one track (`ThemeSlider` in
/// components/appearance-controls.tsx). Stops show only their icon; the name
/// appears inside the thumb. Tap a stop or throw the thumb: it lands on the
/// nearest stop with a small overshoot, and the screen changes once it has
/// landed. 272 pt wide, 88 pt a stop, everywhere it appears.
struct ThemeSlider: View {
    @AppStorage(SlateTheme.storageKey) private var stored = SlateTheme.dark.rawValue
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var chosen: SlateTheme?
    @State private var pending: DispatchWorkItem?

    static let width: CGFloat = 272

    private var current: SlateTheme { SlateTheme(rawValue: stored) ?? .dark }
    private var shown: SlateTheme { chosen ?? current }

    var body: some View {
        LiquidSelector(
            count: SlateTheme.allCases.count,
            selectedIndex: SlateTheme.allCases.firstIndex(of: shown) ?? 2,
            springs: .slider,
            trackColor: SlatePalette.placeholder.opacity(0.5),
            onSelect: { choose(SlateTheme.allCases[$0]) },
            ink: { index in
                let theme = SlateTheme.allCases[index]
                return AnyView(
                    HStack(spacing: 6) {
                        Image(systemName: theme.icon)
                            .font(.system(size: 14, weight: .medium))
                            .scaleEffect(theme == .system ? 0.9 : 1)
                        Text(theme.label)
                            .font(.system(size: 12, weight: .medium))
                    }
                )
            }
        ) { index in
            let theme = SlateTheme.allCases[index]
            Image(systemName: theme.icon)
                .font(.system(size: 14, weight: .medium))
                .scaleEffect(theme == .system ? 0.9 : 1)
                .frame(width: 60)
                .accessibilityLabel(theme.label)
        }
        .frame(width: Self.width, height: 40)
        .overlay { Capsule().stroke(SlatePalette.border, lineWidth: 1) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Theme")
        .onDisappear { pending?.perform() }
    }

    private func choose(_ theme: SlateTheme) {
        pending?.cancel()
        guard theme != current else {
            chosen = nil
            return
        }
        chosen = theme
        // The thumb lands first; then the light changes, never both at once.
        let work = DispatchWorkItem {
            SlateAppearance.choose(theme, reduceMotion: reduceMotion)
            stored = theme.rawValue
            chosen = nil
            pending = nil
        }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + (reduceMotion ? 0 : 0.3), execute: work)
    }
}

/// The round theme button of the top bar (`ThemeToggle`): it shows the setting
/// chosen, System included, and opens the slider. A new icon turns into place.
struct ThemeButton: View {
    @AppStorage(SlateTheme.storageKey) private var stored = SlateTheme.dark.rawValue
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var open = false

    private var theme: SlateTheme { SlateTheme(rawValue: stored) ?? .dark }

    var body: some View {
        Button { open = true } label: {
            Image(systemName: theme.icon)
                .font(.system(size: 15, weight: .medium))
                .scaleEffect(theme == .system ? 0.9 : 1)
                .id(theme)
                .transition(reduceMotion ? .opacity : .asymmetric(
                    insertion: .modifier(
                        active: TurnIn(progress: 0),
                        identity: TurnIn(progress: 1)
                    ),
                    removal: .opacity
                ))
                .foregroundStyle(open ? SlatePalette.text : SlatePalette.mutedText)
                .frame(width: 40, height: 40)
                .background(SlatePalette.fill, in: .circle)
                .overlay { Circle().stroke(SlatePalette.border, lineWidth: 1) }
                .frame(width: 44, height: 44)
                .contentShape(.circle)
                .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.32), value: theme)
        }
        .buttonStyle(SlatePressStyle())
        .accessibilityLabel("Appearance")
        .accessibilityValue(theme.label)
        .popover(isPresented: $open, arrowEdge: .top) {
            ThemeSlider()
                .padding(8)
                .presentationCompactAdaptation(.popover)
                .presentationBackground(SlatePalette.surface)
        }
    }
}

/// The arriving icon turns in from a quarter turn back, slightly small.
private struct TurnIn: ViewModifier {
    let progress: Double
    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(-90 * (1 - progress)))
            .scaleEffect(0.6 + 0.4 * progress)
            .opacity(progress)
    }
}
