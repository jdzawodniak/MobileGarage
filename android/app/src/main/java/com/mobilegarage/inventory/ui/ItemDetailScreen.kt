package com.mobilegarage.inventory.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.mobilegarage.inventory.data.api.RetrofitClient
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemDetailScreen(navController: NavController, id: Int) {
    var item by remember { mutableStateOf<com.mobilegarage.inventory.data.api.Item?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(id) {
        scope.launch {
            try {
                item = RetrofitClient.api.getItem(id)
            } catch (e: Exception) {
                error = e.message ?: "Error"
            } finally {
                loading = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(item?.name ?: "Item") },
                navigationIcon = {
                    TextButton(onClick = { navController.popBackStack() }) { Text("Back") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            when {
                loading -> CircularProgressIndicator(Modifier.padding(24.dp))
                error != null -> Text(error!!, color = MaterialTheme.colorScheme.error)
                item != null -> {
                    val i = item!!
                    Text("Location: ${i.location_code ?: ""}", style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.height(8.dp))
                    Text(i.notes ?: "", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
