from fastapi.testclient import TestClient


def test_get_system_capacity_shape(client: TestClient) -> None:
    response = client.get("/api/system/capacity")

    assert response.status_code == 200
    body = response.json()

    assert "hardware" in body
    hardware = body["hardware"]
    for field in (
        "processorName",
        "cpuCores",
        "totalMemoryGb",
        "gpuDetected",
        "gpuName",
        "detectionFailed",
    ):
        assert field in hardware
    assert isinstance(hardware["gpuDetected"], bool)
    assert isinstance(hardware["detectionFailed"], bool)

    assert "estimate" in body
    if hardware["detectionFailed"]:
        assert body["estimate"] is None
    else:
        estimate = body["estimate"]
        assert estimate is not None
        for field in ("maxPdfCount", "maxTotalSizeGb", "basis"):
            assert field in estimate
        assert estimate["basis"] in ("full", "cpu-only")
