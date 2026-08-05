package space.s1ate.app

import android.app.Application
import androidx.room.Room
import space.s1ate.app.data.AppDatabase
import space.s1ate.app.data.LibraryCache
import space.s1ate.app.data.SecureSessionStore
import space.s1ate.app.network.SlateApi

class SlateApplication : Application() {
    val graph: AppGraph by lazy {
        val database = Room.databaseBuilder(
            applicationContext,
            AppDatabase::class.java,
            "slate-library.db",
        ).build()
        AppGraph(
            api = SlateApi(),
            sessionStore = SecureSessionStore(applicationContext),
            libraryCache = LibraryCache(database.cachedTitleDao()),
        )
    }
}

data class AppGraph(
    val api: SlateApi,
    val sessionStore: SecureSessionStore,
    val libraryCache: LibraryCache,
)
