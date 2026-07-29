from app.embeddings.projections.pca import PcaProjection


def test_pca_projects_every_vector_to_two_components():
    vectors = [[float(i), float(i) * 2, float(i) * 3, float(-i)] for i in range(6)]

    result = PcaProjection().project(vectors)

    assert len(result) == 6
    assert all(len(point) == 2 for point in result)


def test_pca_is_deterministic_for_the_same_input():
    vectors = [
        [1.0, 2.0, 3.0],
        [4.0, 1.0, 0.0],
        [0.0, 5.0, 2.0],
        [3.0, 3.0, 3.0],
        [2.0, 0.0, 1.0],
    ]

    first = PcaProjection().project(vectors)
    second = PcaProjection().project(vectors)

    assert first == second
