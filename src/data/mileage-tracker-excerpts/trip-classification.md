# Swipe to classify, tap to review

This excerpt supports the **Captured trips, classification, and editing** recording. Each unclassified trip row maps a swipe direction to a business or personal action, while tapping the row opens that trip's detail screen.

Source: [UnclassifiedScreen.kt, lines 240–276](https://github.com/Rory-Hughes/MilageTracker/blob/main/app/src/main/java/com/example/mileagetracker/ui/screen/UnclassifiedScreen.kt#L240-L276)

~~~kotlin
private fun UnclassifiedDriveRow(
    drive: com.example.mileagetracker.data.local.entity.DriveEntity,
    onTripTapped: (Int) -> Unit,
    onClassifyDrive: (drive: com.example.mileagetracker.data.local.entity.DriveEntity, isBusiness: Boolean) -> Unit,
) {
    val display = DriveDisplayModel.from(drive)
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    onClassifyDrive(drive, true)
                    true
                }

                SwipeToDismissBoxValue.EndToStart -> {
                    onClassifyDrive(drive, false)
                    true
                }

                SwipeToDismissBoxValue.Settled -> false
            }
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            SwipeBackground(dismissDirection = dismissState.dismissDirection)
        },
        content = {
            DriveCard(
                display = display,
                onClick = { onTripTapped(drive.id) },
            )
        },
    )
}
~~~

The source ties the gestures and row tap to their callbacks. The video shows captured trip records and the available review path.
