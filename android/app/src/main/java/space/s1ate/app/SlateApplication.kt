package space.s1ate.app

import android.app.Application
import android.content.Context
import androidx.room.Room
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.request.CachePolicy
import okio.Path.Companion.toOkioPath
import space.s1ate.app.data.AppDatabase
import space.s1ate.app.data.LibraryCache
import space.s1ate.app.data.SecureSessionStore
import space.s1ate.app.network.SlateApi

class SlateApplication : Application(), SingletonImageLoader.Factory {
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

    override fun newImageLoader(context: Context): ImageLoader = ImageLoader.Builder(context)
        .memoryCache {
            MemoryCache.Builder()
                .maxSizePercent(context, 0.25)
                .build()
        }
        .diskCache {
            DiskCache.Builder()
                .directory(context.cacheDir.resolve("slate-title-images-v1").toOkioPath())
                .maxSizeBytes(384L * 1_024 * 1_024)
                .build()
        }
        .memoryCachePolicy(CachePolicy.ENABLED)
        .diskCachePolicy(CachePolicy.ENABLED)
        .networkCachePolicy(CachePolicy.ENABLED)
        .build()
}

data class AppGraph(
    val api: SlateApi,
    val sessionStore: SecureSessionStore,
    val libraryCache: LibraryCache,
)
