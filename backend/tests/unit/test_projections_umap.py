from app.embeddings.projections.umap import UmapProjection


def test_umap_projects_every_vector_to_two_components():
    vectors = [[float(i), float(i) * 2, float(i) * 3, float(i) - 1] for i in range(8)]

    result = UmapProjection().project(vectors)

    assert len(result) == 8
    assert all(len(point) == 2 for point in result)


def test_umap_handles_the_minimum_supported_sample_size():
    vectors = [[float(i), float(i) * 2, float(-i)] for i in range(5)]

    result = UmapProjection().project(vectors)

    assert len(result) == 5
    assert all(len(point) == 2 for point in result)
