import io


def make_pdf(text: str) -> bytes:
    """Build a minimal, valid single-page PDF containing the given text (or no
    text at all if `text` is empty), with a correct xref table so `pypdf` can
    parse it. Avoids depending on a heavy PDF-generation library just for
    tests."""
    objects = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>"
        b"/MediaBox[0 0 600 800]/Contents 5 0 R>>",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]

    stream = (f"BT /F1 12 Tf 10 700 Td ({text}) Tj ET".encode()) if text else b""
    objects.append(b"<</Length " + str(len(stream)).encode() + b">>\nstream\n" + stream + b"\nendstream")

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n")

    xref_offset = out.tell()
    count = len(objects) + 1
    out.write(b"xref\n0 " + str(count).encode() + b"\n")
    out.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.write(str(offset).zfill(10).encode() + b" 00000 n \n")
    out.write(b"trailer\n<</Size " + str(count).encode() + b"/Root 1 0 R>>\n")
    out.write(b"startxref\n" + str(xref_offset).encode() + b"\n%%EOF")
    return out.getvalue()


def make_words_pdf(word_count: int, word: str = "word") -> bytes:
    """A PDF whose extracted text is `word_count` space-separated words —
    useful for exercising fixed-size word-count chunking deterministically."""
    return make_pdf(" ".join([word] * word_count))


def make_multi_page_pdf(texts: list[str]) -> bytes:
    """Build a minimal, valid multi-page PDF, one page per entry in `texts`, with a
    correct xref table so `pypdf` can parse it — same approach as `make_pdf`, generalized
    to multiple pages so per-page extraction progress can be exercised deterministically."""
    font_num = 3
    page_nums = [4 + i * 2 for i in range(len(texts))]
    content_nums = [5 + i * 2 for i in range(len(texts))]

    objects: dict[int, bytes] = {
        1: b"<</Type/Catalog/Pages 2 0 R>>",
        2: ("<</Type/Pages/Kids[" + " ".join(f"{n} 0 R" for n in page_nums) + f"]/Count {len(texts)}>>").encode(),
        font_num: b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    }

    for i, text in enumerate(texts):
        objects[page_nums[i]] = (
            f"<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 {font_num} 0 R>>>>"
            f"/MediaBox[0 0 600 800]/Contents {content_nums[i]} 0 R>>"
        ).encode()
        stream = (f"BT /F1 12 Tf 10 700 Td ({text}) Tj ET".encode()) if text else b""
        objects[content_nums[i]] = (
            b"<</Length " + str(len(stream)).encode() + b">>\nstream\n" + stream + b"\nendstream"
        )

    max_num = max(objects)
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets: dict[int, int] = {}
    for num in range(1, max_num + 1):
        obj = objects.get(num)
        if obj is None:
            continue
        offsets[num] = out.tell()
        out.write(str(num).encode() + b" 0 obj\n" + obj + b"\nendobj\n")

    xref_offset = out.tell()
    count = max_num + 1
    out.write(b"xref\n0 " + str(count).encode() + b"\n")
    out.write(b"0000000000 65535 f \n")
    for num in range(1, max_num + 1):
        out.write(str(offsets.get(num, 0)).zfill(10).encode() + b" 00000 n \n")
    out.write(b"trailer\n<</Size " + str(count).encode() + b"/Root 1 0 R>>\n")
    out.write(b"startxref\n" + str(xref_offset).encode() + b"\n%%EOF")
    return out.getvalue()


def make_multi_page_words_pdf(words_per_page: list[int], word: str = "word") -> bytes:
    """A multi-page PDF where page `i`'s extracted text is `words_per_page[i]`
    space-separated words — lets tests assert on per-page progress increments."""
    return make_multi_page_pdf([" ".join([word] * n) for n in words_per_page])
