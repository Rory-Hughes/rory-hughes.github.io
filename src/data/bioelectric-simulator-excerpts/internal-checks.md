# Tests for current balance and pulse boundaries

These tests check internal properties of the simulator: current across each gap is equal and opposite, and a square pulse is active at its start but inactive at its end. They do not compare a simulated trajectory with the cited paper's published results.

Source: [test_model.py, lines 36–69](https://github.com/Rory-Hughes/simple-multicellular-bioelectric-simulator/blob/master/tests/test_model.py#L36-L69)

~~~python
def test_gap_current_is_pairwise_equal_and_opposite():
    network = make_chain(cell_count=4)
    current = network.gap_current_matrix_nA([-70.0, -50.0, -80.0, -65.0])
    np.testing.assert_allclose(current, -current.T, atol=1e-12)
    assert np.sum(current) == pytest.approx(0.0, abs=1e-12)
~~~

~~~python
def test_gap_only_network_conserves_capacitance_weighted_voltage():
    network = ElectricalNetwork(
        capacitance_nF=[1.0, 2.0, 0.5],
        leak_conductance_uS=[0.0, 0.0, 0.0],
        leak_reversal_mV=[-70.0, -70.0, -70.0],
        gap_conductance_uS=[
            [0.0, 0.08, 0.0],
            [0.08, 0.0, 0.08],
            [0.0, 0.08, 0.0],
        ],
    )
    result = simulate(
        network,
        [-20.0, -70.0, -90.0],
        duration_ms=80.0,
        dt_ms=0.1,
    )
    charge_like_quantity = result.voltage_mV @ network.capacitance_nF
    np.testing.assert_allclose(
        charge_like_quantity, charge_like_quantity[0], atol=2e-11
    )
~~~

~~~python
def test_square_pulse_uses_half_open_time_interval():
    pulse = SquarePulse(3, 1, 2.5, 10.0, 20.0)
    np.testing.assert_array_equal(pulse(9.999), [0.0, 0.0, 0.0])
    np.testing.assert_array_equal(pulse(10.0), [0.0, 2.5, 0.0])
    np.testing.assert_array_equal(pulse(19.999), [0.0, 2.5, 0.0])
    np.testing.assert_array_equal(pulse(20.0), [0.0, 0.0, 0.0])
~~~
