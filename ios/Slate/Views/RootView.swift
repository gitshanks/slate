import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            Color(red: 0.028, green: 0.026, blue: 0.031).ignoresSafeArea()
            switch model.state {
            case .launching:
                ProgressView()
                    .tint(.white)
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
