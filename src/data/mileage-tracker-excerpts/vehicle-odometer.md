# Save a vehicle with opening odometer evidence

This excerpt supports the **Vehicle and odometer management** recording. Saving a vehicle can also persist an optional opening reading and photo as an odometer capture.

Source: [VehicleManagementViewModel.kt, lines 85–125](https://github.com/Rory-Hughes/MilageTracker/blob/main/app/src/main/java/com/example/mileagetracker/ui/viewmodel/VehicleManagementViewModel.kt#L85-L125)

~~~kotlin
    fun saveVehicle(vehicle: VehicleEntity) {
        saveVehicle(VehicleSaveRequest(vehicle = vehicle))
    }

    fun saveVehicle(request: VehicleSaveRequest) {
        viewModelScope.launch {
            try {
                val savedVehicleId = saveVehicleUseCase(request.vehicle)
                saveOpeningCaptureIfNeeded(
                    request = request,
                    savedVehicleId = savedVehicleId,
                )
                _events.send(VehicleUiEvent.SaveSuccess)
            } catch (e: IllegalArgumentException) {
                _events.send(VehicleUiEvent.Error(e.message ?: "Validation failed"))
            }
        }
    }

    private suspend fun saveOpeningCaptureIfNeeded(
        request: VehicleSaveRequest,
        savedVehicleId: Int,
    ) {
        val photoUri = request.openingOdometerPhotoUri ?: return
        val readingKm = request.vehicle.openingOdometerKm?.toInt() ?: return
        val capture = OdometerCapture(
            vehicleId = savedVehicleId,
            captureDate = System.currentTimeMillis(),
            readingKm = readingKm,
            taxYear = request.vehicle.fiscalYear,
            photoUri = photoUri,
            captureType = OdometerCaptureType.PHOTO_ASSISTED,
            boundaryType = OdometerBoundaryType.OPENING,
            notes = "Opening odometer evidence for ${request.vehicle.fiscalYear}",
        )
        when (val result = saveOdometerCaptureUseCase(capture)) {
            is OdometerSaveResult.InvalidReading -> throw IllegalArgumentException(result.reason)
            is OdometerSaveResult.RegressionWarning -> Unit
            is OdometerSaveResult.Success -> Unit
        }
    }
~~~

The excerpt follows the vehicle save path shown by the settings screens; it does not claim that every odometer workflow is covered by the video.
