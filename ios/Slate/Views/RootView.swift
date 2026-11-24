import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            SlatePalette.background.ignoresSafeArea()
            switch model.state {
            case .launching:
                ProgressView()
                    .tint(SlatePalette.text)
                    .transition(.opacity)
            case .signedOut, .signingIn:
                SignInView()
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            case .signedIn:
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.smooth(duration: 0.42), value: model.state)
        .alert("Slate", isPresented: errorBinding) {
            Button("OK", role: .cancel) { model.presentedError = nil }
        } message: {
            Text(model.presentedError ?? "")
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { model.presentedError != nil },
            set: { if !$0 { model.presentedError = nil } }
        )
    }
}
