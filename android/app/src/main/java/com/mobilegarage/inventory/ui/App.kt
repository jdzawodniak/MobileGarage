package com.mobilegarage.inventory.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun App() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "search") {
        composable("search") { SearchScreen(navController) }
        composable("locations") { LocationsScreen(navController) }
        composable("add-item") { AddItemScreen(navController) }
        composable("location/{id}") { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id")?.toIntOrNull() ?: return@composable
            LocationDetailScreen(navController, id)
        }
        composable("item/{id}") { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id")?.toIntOrNull() ?: return@composable
            ItemDetailScreen(navController, id)
        }
    }
}
