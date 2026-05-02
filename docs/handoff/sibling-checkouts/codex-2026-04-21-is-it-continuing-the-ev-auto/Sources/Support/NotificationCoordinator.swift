import Foundation
import UserNotifications

@MainActor
public final class NotificationCoordinator {
    public init() {}

    public func requestAuthorizationIfNeeded() async {
        do {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .notDetermined else { return }
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            AppLogger.notifications.info("Notification permission granted: \(granted, privacy: .public)")
        } catch {
            AppLogger.notifications.error("Notification authorization failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    public func notifySyncFailure(sourceName: String, message: String) {
        schedule(
            title: "Sync needs attention",
            body: "\(sourceName): \(message)"
        )
    }

    public func notifySavedSearchMatch(name: String, vehicleName: String) {
        schedule(
            title: "Saved search match",
            body: "\(name) found \(vehicleName)"
        )
    }

    private func schedule(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                AppLogger.notifications.error("Failed to schedule notification: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
