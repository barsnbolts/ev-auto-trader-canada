import Foundation

public enum Formatters {
    public static func currency(_ value: Double) -> String {
        value.formatted(.currency(code: "CAD").precision(.fractionLength(0)))
    }

    public static func relative(date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: .now)
    }
}
