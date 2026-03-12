package com.mobilegarage.inventory.data.api

import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.*

data class Location(
    val id: Int,
    val location_code: String,
    val space_number: Int,
    val description: String?,
    val building_code: String,
    val storage_type: String,
    val storage_id: String,
    val items: List<Item>? = null,
)

data class Item(
    val id: Int,
    val name: String,
    val location_id: Int? = null,
    val location_code: String? = null,
    val notes: String? = null,
    val photo_path: String? = null,
)

data class StorageUnit(
    val id: Int,
    val building_code: String,
    val storage_type: String,
    val storage_id: String,
    val spaces_count: Int,
    val description: String? = null,
    val locations: List<Location>? = null,
)

data class StorageUnitCreate(
    val building_code: String,
    val storage_type: String,
    val storage_id: String,
    val spaces_count: Int,
    val description: String? = null,
)

data class ItemCreate(
    val location_id: Int,
    val name: String,
    val notes: String? = null,
    val photo_path: String? = null,
    val printer_roll: String? = "left",
)

interface InventoryApi {
    @GET("locations")
    suspend fun getLocations(
        @Query("q") q: String? = null,
        @Query("building") building: String? = null,
        @Query("type") type: String? = null,
    ): List<Location>

    @GET("locations/{id}")
    suspend fun getLocation(@Path("id") id: Int): Location

    @GET("items")
    suspend fun getItems(
        @Query("q") q: String? = null,
        @Query("location_id") locationId: Int? = null,
    ): List<Item>

    @GET("items/{id}")
    suspend fun getItem(@Path("id") id: Int): Item

    @POST("items")
    suspend fun createItem(@Body body: ItemCreate): Item

    @GET("storage-units")
    suspend fun getStorageUnits(): List<StorageUnit>

    @POST("storage-units")
    suspend fun createStorageUnit(@Body body: StorageUnitCreate): StorageUnit

    @Multipart
    @POST("photos")
    suspend fun uploadPhoto(@Part photo: okhttp3.MultipartBody.Part): PhotoResponse
}

data class PhotoResponse(val path: String, val url: String)
