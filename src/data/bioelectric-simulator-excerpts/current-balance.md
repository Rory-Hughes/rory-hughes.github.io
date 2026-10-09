# Passive membrane current balance

The model keeps leak, gap-junction, and external current as separate components. It sums current flowing from coupled cells into each cell and divides the total by membrane capacitance to obtain the voltage derivative. This is the simulator's passive electrical model; it does not establish a biological or paper-reproduction result.

Source: [model.py, lines 93–116](https://github.com/Rory-Hughes/simple-multicellular-bioelectric-simulator/blob/master/src/bioelectric_sim/model.py#L93-L116)

~~~python
    def gap_current_matrix_nA(self, voltage_mV: ArrayLike) -> FloatArray:
        """Return current into cell i from cell j at matrix position [i, j]."""

        voltage = _vector("voltage_mV", voltage_mV, self.cell_count)
        voltage_difference = voltage[np.newaxis, :] - voltage[:, np.newaxis]
        return self.gap_conductance_uS * voltage_difference

    def current_components(
        self, voltage_mV: ArrayLike, external_current_nA: ArrayLike | None = None
    ) -> CurrentComponents:
        """Calculate inward-positive leak, coupling, and applied currents."""
        voltage = _vector("voltage_mV", voltage_mV, self.cell_count)
        external = (
            np.zeros(self.cell_count, dtype=float)
            if external_current_nA is None
            else _vector("external_current_nA", external_current_nA, self.cell_count)
        )
        leak = -self.leak_conductance_uS * (voltage - self.leak_reversal_mV)
        gap = self.gap_current_matrix_nA(voltage).sum(axis=1)
        return CurrentComponents(leak, gap, external)

    def voltage_derivative_mV_per_ms(
        self, voltage_mV: ArrayLike, external_current_nA: ArrayLike | None = None
    ) -> FloatArray:
        currents = self.current_components(voltage_mV, external_current_nA)
        return currents.total_nA / self.capacitance_nF
~~~
