from app.system.service import compute_capacity_estimate


def test_estimate_is_monotonic_in_memory() -> None:
    estimates = [
        compute_capacity_estimate(total_memory_gb=ram, cpu_cores=4, gpu_detected=False).maxPdfCount
        for ram in (4, 8, 16, 32)
    ]

    assert estimates == sorted(estimates)
    assert len(set(estimates)) == len(estimates)


def test_estimate_is_monotonic_in_cpu_cores() -> None:
    estimates = [
        compute_capacity_estimate(
            total_memory_gb=16, cpu_cores=cores, gpu_detected=False
        ).maxPdfCount
        for cores in (2, 4, 8, 16)
    ]

    assert estimates == sorted(estimates)
    assert len(set(estimates)) == len(estimates)


def test_estimate_increases_with_gpu_present() -> None:
    without_gpu = compute_capacity_estimate(total_memory_gb=16, cpu_cores=8, gpu_detected=False)
    with_gpu = compute_capacity_estimate(total_memory_gb=16, cpu_cores=8, gpu_detected=True)

    assert with_gpu.maxPdfCount > without_gpu.maxPdfCount
    assert with_gpu.maxTotalSizeGb > without_gpu.maxTotalSizeGb


def test_estimate_never_zero_or_negative_on_minimal_hardware() -> None:
    estimate = compute_capacity_estimate(total_memory_gb=0.5, cpu_cores=1, gpu_detected=False)

    assert estimate.maxPdfCount >= 1
    assert estimate.maxTotalSizeGb > 0


def test_estimate_basis_reflects_gpu_presence() -> None:
    assert (
        compute_capacity_estimate(total_memory_gb=16, cpu_cores=8, gpu_detected=False).basis
        == "cpu-only"
    )
    assert (
        compute_capacity_estimate(total_memory_gb=16, cpu_cores=8, gpu_detected=True).basis
        == "full"
    )


def test_estimate_at_reference_hardware_hits_base_values() -> None:
    estimate = compute_capacity_estimate(total_memory_gb=32, cpu_cores=16, gpu_detected=True)

    assert estimate.maxPdfCount == 300
    assert estimate.maxTotalSizeGb == 6.0


def test_estimate_above_reference_hardware_does_not_exceed_base_values() -> None:
    estimate = compute_capacity_estimate(total_memory_gb=128, cpu_cores=64, gpu_detected=True)

    assert estimate.maxPdfCount == 300
    assert estimate.maxTotalSizeGb == 6.0
