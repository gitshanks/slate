import GoogleSignIn
import SwiftUI

@main
struct SlateApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .onAppear { SlateAppearance.applyStored() }
                .task { await model.bootstrap() }
                .onOpenURL { url in
                    if !GIDSignIn.sharedInstance.handle(url) {
                        model.handleOpenURL(url)
                    }
                }
        }
    }
}
