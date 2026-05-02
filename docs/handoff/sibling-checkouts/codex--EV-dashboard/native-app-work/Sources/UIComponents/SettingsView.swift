import AppModels
import SwiftUI

public struct SettingsView: View {
    @AppStorage("defaultProvince") private var defaultProvince = "Ontario"
    @AppStorage("defaultRadiusMode") private var defaultRadiusMode = RadiusMode.hundredKm.rawValue
    @AppStorage("buyerPostalCode") private var buyerPostalCode = ""
    @AppStorage("temperatureDefaultC") private var temperatureDefaultC = 22.0
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    @AppStorage("syncCadenceHours") private var syncCadenceHours = 6
    @AppStorage("exportsIncludeListingPrice") private var exportsIncludeListingPrice = true

    public init() {}

    public var body: some View {
        Form {
            Section("Buying Location") {
                TextField("Postal-code center", text: $buyerPostalCode, prompt: Text("e.g. M5V 2T6"))
                    .textFieldStyle(.roundedBorder)
                Text("Used by 100 km and 150 km leverage scopes. Leave blank until you want personalized distance prompts.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Picker("Default Province", selection: $defaultProvince) {
                Text("Ontario").tag("Ontario")
                Text("British Columbia").tag("British Columbia")
                Text("Quebec").tag("Quebec")
                Text("Alberta").tag("Alberta")
            }

            Picker("Default Scope", selection: $defaultRadiusMode) {
                ForEach(RadiusMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode.rawValue)
                }
            }

            HStack {
                Text("Default Temperature")
                Slider(value: $temperatureDefaultC, in: -25...35, step: 1)
                Text("\(Int(temperatureDefaultC))C")
                    .monospacedDigit()
                    .frame(width: 42, alignment: .trailing)
            }

            Section("Research & Export") {
                Stepper("Manual snapshot reminder every \(syncCadenceHours) hours", value: $syncCadenceHours, in: 2...24)
                Toggle("Enable Notifications", isOn: $notificationsEnabled)
                Toggle("Include Best Listing Price In Exports", isOn: $exportsIncludeListingPrice)
                Text("The app uses manual refresh plus saved snapshots by default; it does not aggressively monitor dealer sites.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .padding(20)
        .frame(width: 480)
    }
}
