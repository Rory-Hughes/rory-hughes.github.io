# Build and record a logbook export

This excerpt supports the **Summary and export** recording. A request selects the PDF or CSV use case, then a successful result is added to report history before the screen exposes its shareable file.

Source: [ExportViewModel.kt, lines 74–119](https://github.com/Rory-Hughes/MilageTracker/blob/main/app/src/main/java/com/example/mileagetracker/ui/viewmodel/ExportViewModel.kt#L74-L119)

~~~kotlin
    fun exportLogbook(
        vehicleId: Int?,
        taxYear: Int,
        format: ExportFormat = ExportFormat.PDF,
        categories: Set<TripCategory> = setOf(TripCategory.BUSINESS),
        includeRouteDetails: Boolean = true,
    ) {
        if (_uiState.value is ExportUiState.Exporting) return

        val request = LogbookExportRequest(
            vehicleId = vehicleId,
            taxYear = taxYear,
            format = format,
            categories = categories.ifEmpty { setOf(TripCategory.BUSINESS) },
            includeRouteDetails = includeRouteDetails,
        )

        viewModelScope.launch {
            _uiState.value = ExportUiState.Exporting(
                vehicleId = vehicleId,
                taxYear = taxYear,
            )

            val result = when (format) {
                ExportFormat.PDF -> exportPdf(request)
                ExportFormat.CSV -> exportCsv(request)
            }

            when (result) {
                is ExportResult.Success -> {
                    val historyId = saveReportHistory(result, request)
                    _uiState.value = ExportUiState.Success(
                        fileUri = result.fileUri,
                        format = result.format,
                        fileSizeBytes = result.fileSizeBytes,
                        historyRecordId = historyId,
                        mimeType = result.format.mimeType,
                    )
                }

                is ExportResult.Failure -> {
                    _uiState.value = ExportUiState.Error(result.reason)
                }
            }
        }
    }
~~~

The recording shows the report and export interface. The code excerpt does not establish a filed or accepted tax return.
