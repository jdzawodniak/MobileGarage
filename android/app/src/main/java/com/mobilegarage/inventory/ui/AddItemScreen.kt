package com.mobilegarage.inventory.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.navigation.NavController
import com.mobilegarage.inventory.data.api.ItemCreate
import com.mobilegarage.inventory.data.api.Location
import com.mobilegarage.inventory.data.api.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemScreen(navController: NavController) {
    var name by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var printerRoll by remember { mutableStateOf("left") }
    var selectedLocationId by remember { mutableStateOf<Int?>(null) }
    var locations by remember { mutableStateOf<List<Location>>(emptyList()) }
    var photoFile by remember { mutableStateOf<File?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) { /* photoFile set before launch */ }
    }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                locations = RetrofitClient.api.getLocations()
                if (locations.isNotEmpty() && selectedLocationId == null) {
                    selectedLocationId = locations.first().id
                }
            } catch (e: Exception) {
                error = e.message ?: "Error"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add Item") },
                navigationIcon = {
                    TextButton(onClick = { navController.popBackStack() }) { Text("Back") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Item name") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Text("Print to roll", style = MaterialTheme.typography.labelMedium)
            listOf(
                "left" to "Left roll",
                "right" to "Right roll",
                "both" to "Both rolls",
                "test_left" to "Test connection (left) – WMI test page",
            ).forEach { (value, label) ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RadioButton(
                        selected = printerRoll == value,
                        onClick = { printerRoll = value },
                    )
                    Text(label)
                }
            }
            Spacer(Modifier.height(12.dp))
            Text("Location", style = MaterialTheme.typography.labelMedium)
            locations.forEach { loc ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    RadioButton(
                        selected = selectedLocationId == loc.id,
                        onClick = { selectedLocationId = loc.id },
                    )
                    Text(loc.location_code, Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(16.dp))
            Button(onClick = {
                val file = File(ctx.cacheDir, "photo_${System.currentTimeMillis()}.jpg")
                photoFile = file
                val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", file)
                takePicture.launch(uri)
            }) {
                Text(if (photoFile != null && photoFile!!.exists()) "Retake photo" else "Take photo")
            }
            Spacer(Modifier.height(24.dp))
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = {
                    val locId = selectedLocationId
                    if (locId == null || name.isBlank()) {
                        error = "Name and location required"
                        return@Button
                    }
                    loading = true
                    error = null
                    scope.launch {
                        try {
                            var photoPath: String? = null
                            photoFile?.takeIf { it.exists() }?.let { file ->
                                photoPath = withContext(Dispatchers.IO) {
                                    val part = MultipartBody.Part.createFormData(
                                        "photo",
                                        file.name,
                                        file.asRequestBody("image/jpeg".toMediaType()),
                                    )
                                    val resp = RetrofitClient.api.uploadPhoto(part)
                                    resp.path
                                }
                            }
                            val result = RetrofitClient.api.createItem(
                                ItemCreate(
                                    location_id = locId,
                                    name = name.trim(),
                                    notes = notes.ifBlank { null },
                                    photo_path = photoPath,
                                    printer_roll = printerRoll,
                                ),
                            )
                            navController.popBackStack()
                            navController.navigate("item/${result.id}")
                        } catch (e: Exception) {
                            error = e.message ?: "Error"
                        } finally {
                            loading = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !loading,
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(24.dp))
                else Text("Create & print label")
            }
        }
    }
}
