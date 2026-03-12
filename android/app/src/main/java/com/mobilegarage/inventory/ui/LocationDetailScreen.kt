package com.mobilegarage.inventory.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.mobilegarage.inventory.data.api.RetrofitClient
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationDetailScreen(navController: NavController, id: Int) {
    var location by remember { mutableStateOf<com.mobilegarage.inventory.data.api.Location?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(id) {
        scope.launch {
            try {
                location = RetrofitClient.api.getLocation(id)
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
                title = { Text(location?.location_code ?: "Location") },
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
                location != null -> {
                    val loc = location!!
                    Text(loc.description ?: "", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(16.dp))
                    Text("Items here:", style = MaterialTheme.typography.titleSmall)
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(loc.items ?: emptyList()) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { navController.navigate("item/${item.id}") },
                            ) {
                                Text(item.name, Modifier.padding(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
