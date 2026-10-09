# Euler and RK4 time integration

`simulate` samples the stimulus while stepping the network. Euler uses one derivative per step; RK4 samples four stages. `_time_points` shortens a last step when `dt_ms` does not divide the requested duration exactly, so the returned trajectory reaches that duration.

Source: [model.py, lines 143–205](https://github.com/Rory-Hughes/simple-multicellular-bioelectric-simulator/blob/master/src/bioelectric_sim/model.py#L143-L205)

~~~python
def _time_points(duration_ms: float, dt_ms: float) -> FloatArray:
    if not np.isfinite(duration_ms) or duration_ms <= 0:
        raise ValueError("duration_ms must be finite and positive")
    if not np.isfinite(dt_ms) or dt_ms <= 0:
        raise ValueError("dt_ms must be finite and positive")
    full_step_count = int(np.floor(duration_ms / dt_ms))
    points = np.arange(full_step_count + 1, dtype=float) * dt_ms
    tolerance = np.finfo(float).eps * max(duration_ms, 1.0) * 8
    if duration_ms - points[-1] > tolerance:
        points = np.append(points, duration_ms)
    else:
        points[-1] = duration_ms
    return points

def simulate(
    network: ElectricalNetwork,
    initial_voltage_mV: ArrayLike,
    *,
    duration_ms: float,
    dt_ms: float,
    stimulus: Stimulus | None = None,
    method: IntegrationMethod = "rk4",
) -> SimulationResult:
    """Integrate the network equation and return every sampled state.

    ``dt_ms`` is the maximum time step.  If it does not divide the requested
    duration exactly, the final step is shortened so the final time is exact.
    """
    if method not in ("euler", "rk4"):
        raise ValueError("method must be 'euler' or 'rk4'")

    initial = _vector("initial_voltage_mV", initial_voltage_mV, network.cell_count)
    time = _time_points(duration_ms, dt_ms)
    voltage = np.empty((time.size, network.cell_count), dtype=float)
    external_current = np.empty_like(voltage)
    voltage[0] = initial
~~~

The update loop samples the stimulus for each intermediate RK4 stage, checks the next state, and records the final stimulus sample:

~~~python
    def derivative(t: float, state: FloatArray) -> FloatArray:
        current = _sample_stimulus(stimulus, t, network.cell_count)
        return network.voltage_derivative_mV_per_ms(state, current)

    for index in range(time.size - 1):
        t = float(time[index])
        h = float(time[index + 1] - time[index])
        state = voltage[index]
        external_current[index] = _sample_stimulus(stimulus, t, network.cell_count)
        if method == "euler":
            next_state = state + h * derivative(t, state)
        else:
            k1 = derivative(t, state)
            k2 = derivative(t + h / 2, state + h * k1 / 2)
            k3 = derivative(t + h / 2, state + h * k2 / 2)
            k4 = derivative(t + h, state + h * k3)
            next_state = state + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        if not np.all(np.isfinite(next_state)):
            raise FloatingPointError(
                "the simulation became non-finite; reduce dt_ms or inspect parameters"
            )
        voltage[index + 1] = next_state

    external_current[-1] = _sample_stimulus(
        stimulus, float(time[-1]), network.cell_count
    )
    return SimulationResult(time, voltage, external_current, method)
~~~

This excerpt describes numerical implementation behavior only.
