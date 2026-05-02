import SwiftUI

struct EVAutoTraderCommands: Commands {
    @Environment(\.openWindow) private var openWindow

    let container: AppContainer

    var body: some Commands {
        CommandMenu("EV Auto Trader") {
            Button("Refresh Data") {
                Task { await container.refresh() }
            }
            .keyboardShortcut("r", modifiers: [.command])

            Button("Open Compare") {
                openWindow(id: "compare")
            }
            .keyboardShortcut("j", modifiers: [.command, .shift])

            Button("Open Review Queue") {
                openWindow(id: "reviewQueue")
            }
            .keyboardShortcut("q", modifiers: [.command, .shift])

            Divider()

            Button("Open Settings") {
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            }
            .keyboardShortcut(",", modifiers: [.command])
        }
    }
}
