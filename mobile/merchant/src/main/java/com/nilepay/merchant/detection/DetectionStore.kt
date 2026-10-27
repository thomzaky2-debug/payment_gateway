package com.nilepay.merchant.detection

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "pending_payment_events")
data class PendingPaymentEvent(
    @PrimaryKey val eventId: String,
    val amountEgp: Double,
    val senderHandle: String,
    val reference: String?,
    val notificationTimestamp: String,
    val deviceId: String,
    val appVersion: String,
    val androidVersion: String,
    val createdAt: Long = System.currentTimeMillis(),
    val needsAttention: Boolean = false,
    val lastError: String? = null
)

@Dao
interface DetectionDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: PendingPaymentEvent): Long

    @Query("SELECT * FROM pending_payment_events WHERE eventId = :id LIMIT 1")
    suspend fun find(id: String): PendingPaymentEvent?

    @Query("DELETE FROM pending_payment_events WHERE eventId = :id")
    suspend fun delete(id: String)

    @Query("UPDATE pending_payment_events SET needsAttention = 1, lastError = :message WHERE eventId = :id")
    suspend fun markAttention(id: String, message: String)

    @Query("DELETE FROM pending_payment_events WHERE createdAt < :cutoff")
    suspend fun deleteOlderThan(cutoff: Long)

    @Query("DELETE FROM pending_payment_events WHERE eventId IN (SELECT eventId FROM pending_payment_events ORDER BY createdAt ASC LIMIT :count)")
    suspend fun deleteOldest(count: Int)

    @Query("SELECT COUNT(*) FROM pending_payment_events")
    suspend fun count(): Int

    @Query("SELECT COUNT(*) FROM pending_payment_events WHERE needsAttention = 1")
    suspend fun attentionCount(): Int

    @Query("SELECT * FROM pending_payment_events ORDER BY createdAt ASC")
    suspend fun all(): List<PendingPaymentEvent>

    @Query("UPDATE pending_payment_events SET needsAttention = 0, lastError = NULL WHERE eventId = :id")
    suspend fun clearAttention(id: String)
}

@Database(entities = [PendingPaymentEvent::class], version = 1, exportSchema = false)
abstract class DetectionDatabase : RoomDatabase() {
    abstract fun events(): DetectionDao

    companion object {
        @Volatile private var instance: DetectionDatabase? = null
        fun get(context: Context): DetectionDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                DetectionDatabase::class.java,
                "nilepay_detection.db"
            ).build().also { instance = it }
        }
    }
}
