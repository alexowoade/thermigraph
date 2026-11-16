# ThermiGraph benchmark: time estimate_wbgt over 100,000 inputs.
# Run: python3 bench.py  (no network, no API key needed)
"""Times physics_engine.estimate_wbgt over 100,000 varied inputs and
prints elapsed time and throughput (estimates per second)."""

import time

from physics_engine import estimate_wbgt

N = 100_000


def main():
    inputs = [
        (25.0 + (i % 20), 20.0 + (i % 70), 100.0 * (i % 9), 2.0 + (i % 30))
        for i in range(N)
    ]
    start = time.perf_counter()
    for temp_c, humidity, solar, wind in inputs:
        estimate_wbgt(temp_c, humidity, solar, wind)
    elapsed = time.perf_counter() - start
    print(f"estimate_wbgt x {N:,}: {elapsed:.3f} s")
    print(f"throughput: {N / elapsed:,.0f} estimates/second")
    print(f"per call: {elapsed / N * 1e6:.2f} microseconds")


if __name__ == "__main__":
    main()
