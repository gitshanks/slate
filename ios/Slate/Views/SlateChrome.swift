import SwiftUI
import UIKit

enum SlateTab: String, CaseIterable, Identifiable {
    case watchlist
    case watching
    case watched
    case lists
    case `import`

    var id: String { rawValue }

    var label: String {
        switch self {
        case .watchlist: "Watchlist"
        case .watching: "Watching"
        case .watched: "Watched"
        case .lists: "Lists"
        case .import: "Import"
        }
    }

    var icon: String {
        switch self {
        case .watchlist: "clock"
        case .watching: "eye"
        case .watched: "checkmark"
        case .lists: "square.3.layers.3d"
        case .import: "square.and.arrow.down"
        }
    }
}

enum SlatePalette {
    static let background = Color(red: 0.039, green: 0.039, blue: 0.043)
    static let surface = Color(red: 0.067, green: 0.067, blue: 0.075)
    static let accent = Color(red: 0.678, green: 0.922, blue: 0.702)
    static let muted = Color.white.opacity(0.52)
    static let hairline = Color.white.opacity(0.085)
}

struct SlateChrome<Content: View>: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: SlateTab
    let profileIsOpen: Bool
    let onLogo: () -> Void
    let onSearch: () -> Void
    let onProfile: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            SlateTopBar(
                profile: model.profile,
                avatarData: model.avatarData,
                profileIsOpen: profileIsOpen,
                onLogo: onLogo,
                onSearch: onSearch,
                onProfile: onProfile
            )

            Divider().overlay(SlatePalette.hairline)

            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            SlateBottomBar(selection: $selection)
        }
        .background(SlatePalette.background.ignoresSafeArea())
    }
}

struct SlateTopBar: View {
    let profile: SlateProfile?
    let avatarData: Data?
    let profileIsOpen: Bool
    let onLogo: () -> Void
    let onSearch: () -> Void
    let onProfile: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            Button(action: onLogo) {
                SlateAppWordmark()
            }
            .buttonStyle(SlatePressStyle())
            .accessibilityLabel("Slate home")

            Spacer()

            Image(systemName: "moon")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.62))
                .frame(width: 30, height: 30)
                .accessibilityHidden(true)

            ProfileAvatarButton(profile: profile, data: avatarData, action: onProfile)
                .overlay {
                    Circle()
                        .stroke(profileIsOpen ? SlatePalette.accent : .clear, lineWidth: 1.5)
                        .padding(-3)
                }

            Button(action: onSearch) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.72))
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(SlatePressStyle())
            .accessibilityLabel("Search")
        }
        .padding(.horizontal, 18)
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

struct SlateBottomBar: View {
    @Binding var selection: SlateTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(SlateTab.allCases) { tab in
                Button {
                    withAnimation(.smooth(duration: 0.22)) { selection = tab }
                } label: {
                    VStack(spacing: 6) {
                        Capsule()
                            .fill(selection == tab ? SlatePalette.accent : .clear)
                            .frame(width: 42, height: 2)
                            .padding(.bottom, 1)

                        Image(systemName: tab.icon)
                            .font(.system(size: 21, weight: .regular))
                            .frame(height: 22)

                        Text(tab.label)
                            .font(.system(size: 11, weight: .medium))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selection == tab ? SlatePalette.accent : Color.white.opacity(0.57))
                    .frame(maxWidth: .infinity)
                    .contentShape(.rect)
                }
                .buttonStyle(SlatePressStyle())
                .accessibilityAddTraits(selection == tab ? .isSelected : [])
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 0)
        .frame(height: 70)
        .background(SlatePalette.background.opacity(0.98))
        .overlay(alignment: .top) { Rectangle().fill(SlatePalette.hairline).frame(height: 0.7) }
    }
}

struct SlateSectionHeader: View {
    let eyebrow: String
    let title: String
    var trailing: AnyView? = nil

    var body: some View {
        HStack(alignment: .bottom, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Text(eyebrow.uppercased())
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .tracking(2.4)
                    .foregroundStyle(SlatePalette.muted)
                Text(title)
                    .font(.system(size: 38, weight: .bold))
                    .tracking(-1.6)
                    .foregroundStyle(.white)
            }
            Spacer(minLength: 0)
            trailing
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
