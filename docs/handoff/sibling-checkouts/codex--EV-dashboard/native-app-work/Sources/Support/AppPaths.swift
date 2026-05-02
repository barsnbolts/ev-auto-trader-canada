import Foundation

public enum AppPaths {
    public static func databaseURL() throws -> URL {
        let applicationSupport = try applicationSupportDirectory()
        return applicationSupport.appendingPathComponent("ev-auto-trader.sqlite3", conformingTo: .database)
    }

    public static func applicationSupportDirectory() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let folder = base.appendingPathComponent("EVAutoTraderCanada", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }
}
