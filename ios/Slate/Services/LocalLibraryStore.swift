import Foundation
import GRDB

final class LocalLibraryStore: @unchecked Sendable {
    private struct CachedTitle: Codable, FetchableRecord, PersistableRecord {
        static let databaseTableName = "cachedTitle"
        let id: String
        let status: String
        let position: Int
        let updatedAt: String
        let payload: Data
    }

    private let database: DatabaseQueue
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() throws {
        let folder = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let appFolder = folder.appending(path: "Slate", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        database = try DatabaseQueue(path: appFolder.appending(path: "library.sqlite").path)

        var migrator = DatabaseMigrator()
        migrator.registerMigration("cached-library-v1") { db in
            try db.create(table: CachedTitle.databaseTableName) { table in
                table.column("id", .text).primaryKey()
                table.column("status", .text).notNull().indexed()
                table.column("position", .integer).notNull()
                table.column("updatedAt", .text).notNull()
                table.column("payload", .blob).notNull()
            }
        }
        try migrator.migrate(database)
    }

    func titles() throws -> [SlateTitle] {
        try database.read { db in
            try CachedTitle
                .order(Column("status"), Column("position"), Column("updatedAt").desc)
                .fetchAll(db)
                .map { try decoder.decode(SlateTitle.self, from: $0.payload) }
        }
    }

    func replace(with titles: [SlateTitle]) throws {
        try database.write { db in
            try CachedTitle.deleteAll(db)
            for title in titles {
                try CachedTitle(
                    id: title.id,
                    status: title.status.rawValue,
                    position: title.position,
                    updatedAt: title.updatedAt,
                    payload: try encoder.encode(title)
                ).insert(db)
            }
        }
    }

    func clear() throws {
        _ = try database.write { db in try CachedTitle.deleteAll(db) }
    }
}
