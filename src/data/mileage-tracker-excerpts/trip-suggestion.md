# Apply or dismiss a trip suggestion

This excerpt supports the **Application overview** recording. The trip-detail view model loads the top suggestion, applies it through a domain use case, then refreshes its displayed drive after a successful save.

Source: [TripDetailViewModel.kt, lines 251–287](https://github.com/Rory-Hughes/MilageTracker/blob/main/app/src/main/java/com/example/mileagetracker/ui/viewmodel/TripDetailViewModel.kt#L251-L287)

~~~kotlin
    private fun fetchSuggestion(drive: DriveEntity) {
        viewModelScope.launch {
            val suggestions = getTripSuggestionsUseCase(
                candidate = drive,
                driverUid = driverUid,
            )
            _topSuggestion.value = suggestions.firstOrNull()
        }
    }

    val applySuggestion: (TripSuggestion) -> Unit = { suggestion ->
        driveId?.let { id ->
            viewModelScope.launch {
                runCatching {
                    val saved = applySuggestionUseCase(
                        tripId = id,
                        suggestion = suggestion,
                        actorUid = driverUid,
                    )
                    if (saved) {
                        _topSuggestion.value = null
                        _calendarHints.value = emptyList()
                        loadDrive()
                        _events.send(TripDetailEvent.SuggestionApplied(suggestion))
                    } else {
                        _events.send(TripDetailEvent.Error("Trip no longer exists."))
                    }
                }.onFailure { error ->
                    _events.send(TripDetailEvent.Error("Failed to apply suggestion: ${error.message}"))
                }
            }
        }
    }

    val dismissSuggestion: () -> Unit = {
        _topSuggestion.value = null
    }
~~~

The excerpt shows the suggestion actions represented in the screen recording; it does not establish that every suggested category is correct.
