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
fun SearchScreen(navController: NavController) {
    var query by remember { mutableStateOf("") }
    var locations by remember { mutableStateOf<List<com.mobilegarage.inventory.data.api.Location>>(emptyList()) }
    var items by remember { mutableStateOf<List<com.mobilegarage.inventory.data.api.Item>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(query) {
        if (query.length < 2) {
            locations = emptyList()
            items = emptyList()
            return@LaunchedEffect
        }
        loading = true
        error = null
        scope.launch {
            try {
                locations = RetrofitClient.api.getLocations(q = query)
                items = RetrofitClient.api.getItems(q = query)
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
                title = { Text("Search") },
                actions = {
                    TextButton(onClick = { navController.navigate("locations") }) { Text("Locations") }
                    TextButton(onClick = { navController.navigate("add-item") }) { Text("Add Item") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search items or locations") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(16.dp))
            when {
                loading -> CircularProgressIndicator(Modifier.padding(24.dp))
                error != null -> Text(error!!, color = MaterialTheme.colorScheme.error)
                else -> {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(locations) { loc ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { navController.navigate("location/${loc.id}") },
                            ) {
                                Column(Modifier.padding(16.dp)) {
                                    Text(loc.location_code, style = MaterialTheme.typography.titleMedium)
                                    Text(loc.description ?: "", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        items(items) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { navController.navigate("item/${item.id}") },
                            ) {
                                Column(Modifier.padding(16.dp)) {
                                    Text(item.name, style = MaterialTheme.typography.titleMedium)
                                    Text(item.location_code ?: "", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
