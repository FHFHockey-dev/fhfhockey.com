# Superseded candidate 01: not for integration

This was the first build, from mapper `937da536…`. Its candidate had SHA-256 `bd6e9908601186249cd05d8c4bf39d6ff6515efcf36a1441e5a42e18e4432469` and was 9,910,939 bytes.

A wording scan after the build found 1,057 comparison fields showing a raw reason code (`Unavailable: window_not_supplied`) instead of a written text. The scores, counts and every other mapping were correct.

The mapper now has texts for every explanation reason code. Its tests check comparison reasons as well as notes, on the fixtures and on all 725 profiles. The rebuilt candidate is in `../`. This folder is kept as evidence; it was never handed off or installed.
