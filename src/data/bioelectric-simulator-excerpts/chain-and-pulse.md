# Neighbour-only coupling and a bounded pulse

`make_chain` fills only the matrix entries for neighbouring cells, producing a line rather than a fully connected network. `SquarePulse` injects current into one selected cell over `[start_ms, end_ms)`, including the start time and excluding the end time.

Source: [scenarios.py, lines 12–56](https://github.com/Rory-Hughes/simple-multicellular-bioelectric-simulator/blob/master/src/bioelectric_sim/scenarios.py#L12-L56)

~~~python
def make_chain(
    cell_count: int = 10,
    *,
    capacitance_nF: float = 1.0,
    leak_conductance_uS: float = 0.025,
    leak_reversal_mV: float = -70.0,
    gap_conductance_uS: float = 0.05,
) -> ElectricalNetwork:
    """Create a line of identical cells coupled to immediate neighbours."""
    if cell_count < 1:
        raise ValueError("cell_count must be at least one")
    gap = np.zeros((cell_count, cell_count), dtype=float)
    neighbour_indices = np.arange(cell_count - 1)
    gap[neighbour_indices, neighbour_indices + 1] = gap_conductance_uS
    gap[neighbour_indices + 1, neighbour_indices] = gap_conductance_uS
    return ElectricalNetwork(
        capacitance_nF=np.full(cell_count, capacitance_nF, dtype=float),
        leak_conductance_uS=np.full(cell_count, leak_conductance_uS, dtype=float),
        leak_reversal_mV=np.full(cell_count, leak_reversal_mV, dtype=float),
        gap_conductance_uS=gap,
    )

@dataclass(frozen=True)
class SquarePulse:
    """Inject a constant inward current into one cell over [start, end)."""

    cell_count: int
    cell_index: int
    amplitude_nA: float
    start_ms: float
    end_ms: float
~~~

The pulse call itself creates a fresh current vector and uses an inclusive start with an exclusive end:

~~~python
    def __call__(self, time_ms: float) -> NDArray[np.float64]:
        current = np.zeros(self.cell_count, dtype=float)
        if self.start_ms <= time_ms < self.end_ms:
            current[self.cell_index] = self.amplitude_nA
        return current
~~~

The full class also validates its cell index, amplitude, and pulse times before returning a current vector.
