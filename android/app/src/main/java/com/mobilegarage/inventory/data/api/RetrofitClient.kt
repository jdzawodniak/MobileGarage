package com.mobilegarage.inventory.data.api

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    // PC on LAN (port 3011); use 10.0.2.2:3011 for emulator if needed.
    private const val DEFAULT_BASE_URL = "http://192.168.87.20:3011/api/"
    var baseUrl: String = DEFAULT_BASE_URL
        private set

    fun setBaseUrl(url: String) {
        baseUrl = url.trimEnd('/') + "/api/"
    }

    private val okHttp = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttp)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val api: InventoryApi = retrofit.create(InventoryApi::class.java)
}
