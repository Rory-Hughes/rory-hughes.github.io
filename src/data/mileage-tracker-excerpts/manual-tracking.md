# Manual tracking commands

This excerpt supports the **Manual trip-tracking controls** recording. The view model exposes tracking state and sends start/stop commands through a dispatcher, keeping the screen separate from service internals.

Source: [ManualTripControlViewModel.kt, lines 49–74](https://github.com/Rory-Hughes/MilageTracker/blob/main/app/src/main/java/com/example/mileagetracker/ui/viewmodel/ManualTripControlViewModel.kt#L49-L74)

~~~kotlin
    val trackingState: StateFlow<TrackingState> = trackingStateBus.state

    /**
     * Latest GPS fix during recording, or null between trips / before first fix.
     * Observed by [ManualTripControlScreen] to update the live map position.
     */
    val liveLocation: StateFlow<LatLng?> = liveLocationBus.location

    /**
     * Sends [DriveTrackingService.ACTION_MANUAL_START] to begin recording.
     *
     * Safe to call while already in [TrackingState.ManualRecording] — the
     * service ignores duplicate starts.
     */
    fun startManualTrip() {
        trackingCommandDispatcher.startManual()
    }

    /**
     * Sends [DriveTrackingService.ACTION_MANUAL_STOP] to end recording.
     *
     * Safe to call while in [TrackingState.Idle] — the service no-ops.
     */
    fun stopManualTrip() {
        trackingCommandDispatcher.stopManual()
    }
~~~

The supplied clip shows the controls in their ready state. It does not show a completed drive or verify a GPS outcome.
