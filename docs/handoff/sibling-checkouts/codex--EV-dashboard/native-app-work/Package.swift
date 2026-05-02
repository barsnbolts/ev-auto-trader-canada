// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "EVAutoTraderCanada",
    platforms: [
        .macOS(.v26)
    ],
    products: [
        .executable(name: "EVAutoTraderApp", targets: ["EVAutoTraderApp"]),
        .library(name: "AppModels", targets: ["AppModels"]),
        .library(name: "Persistence", targets: ["Persistence"]),
        .library(name: "Calculators", targets: ["Calculators"]),
        .library(name: "SeedData", targets: ["SeedData"]),
        .library(name: "SyncEngine", targets: ["SyncEngine"]),
        .library(name: "Catalog", targets: ["Catalog"]),
        .library(name: "UIComponents", targets: ["UIComponents"]),
        .library(name: "Support", targets: ["Support"])
    ],
    targets: [
        .target(name: "AppModels"),
        .target(name: "Support", dependencies: ["AppModels"]),
        .target(name: "SeedData", dependencies: ["AppModels"]),
        .target(name: "Calculators", dependencies: ["AppModels"]),
        .target(
            name: "Persistence",
            dependencies: ["AppModels", "SeedData", "Support"],
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        ),
        .target(
            name: "SyncEngine",
            dependencies: ["AppModels", "Persistence", "SeedData", "Support"]
        ),
        .target(
            name: "Catalog",
            dependencies: ["AppModels", "Persistence", "Support"]
        ),
        .target(
            name: "UIComponents",
            dependencies: ["AppModels", "Catalog", "Calculators", "Support"]
        ),
        .executableTarget(
            name: "EVAutoTraderApp",
            dependencies: [
                "AppModels",
                "Catalog",
                "Persistence",
                "Calculators",
                "SyncEngine",
                "UIComponents",
                "Support"
            ]
        ),
        .testTarget(
            name: "CalculatorsTests",
            dependencies: ["Calculators", "AppModels"]
        ),
        .testTarget(
            name: "PersistenceTests",
            dependencies: ["Persistence", "AppModels", "SeedData", "Support"]
        ),
        .testTarget(
            name: "CatalogTests",
            dependencies: ["Catalog", "Persistence", "AppModels", "SeedData", "Support"]
        ),
        .testTarget(
            name: "SyncEngineTests",
            dependencies: ["SyncEngine", "Persistence", "AppModels", "SeedData", "Support"]
        ),
        .testTarget(
            name: "EVAutoTraderAppTests",
            dependencies: ["EVAutoTraderApp", "Persistence", "SyncEngine"]
        )
    ]
)
