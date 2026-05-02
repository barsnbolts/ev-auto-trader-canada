import Foundation
import OSLog

public enum AppLogger {
    public static let subsystem = "com.ianmcadam.evautotradercanada"
    public static let app = Logger(subsystem: subsystem, category: "App")
    public static let persistence = Logger(subsystem: subsystem, category: "Persistence")
    public static let sync = Logger(subsystem: subsystem, category: "Sync")
    public static let ui = Logger(subsystem: subsystem, category: "UI")
    public static let export = Logger(subsystem: subsystem, category: "Export")
    public static let notifications = Logger(subsystem: subsystem, category: "Notifications")
}
