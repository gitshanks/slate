package space.s1ate.app.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import space.s1ate.app.model.SlateTitle

@Entity(tableName = "cached_titles")
data class CachedTitleEntity(
    @PrimaryKey val id: String,
    val status: String,
    val position: Int,
    val updatedAt: String,
    val payload: String,
)

@Dao
interface CachedTitleDao {
    @Query("SELECT * FROM cached_titles ORDER BY status, position, updatedAt DESC")
    suspend fun all(): List<CachedTitleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CachedTitleEntity>)

    @Query("DELETE FROM cached_titles")
    suspend fun clear()

    @Transaction
    suspend fun replaceAll(items: List<CachedTitleEntity>) {
        clear()
        insertAll(items)
    }
}

@Database(entities = [CachedTitleEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cachedTitleDao(): CachedTitleDao
}

class LibraryCache(private val dao: CachedTitleDao) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun titles(): List<SlateTitle> = withContext(Dispatchers.IO) {
        dao.all().mapNotNull { row ->
            runCatching { json.decodeFromString<SlateTitle>(row.payload) }.getOrNull()
        }
    }

    suspend fun replace(titles: List<SlateTitle>) = withContext(Dispatchers.IO) {
        dao.replaceAll(
            titles.map { title ->
                CachedTitleEntity(
                    id = title.id,
                    status = title.status.name,
                    position = title.position,
                    updatedAt = title.updatedAt,
                    payload = json.encodeToString(title),
                )
            },
        )
    }

    suspend fun clear() = withContext(Dispatchers.IO) { dao.clear() }
}
