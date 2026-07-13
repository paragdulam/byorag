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
