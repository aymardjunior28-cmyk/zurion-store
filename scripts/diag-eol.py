#!/usr/bin/env python3
"""Diagnostic : fins de ligne + lignes cibles (images / css) des fichiers clés."""
import sys

FILES = [
    'src/utils/views-helpers.js',
    'views/product.ejs',
    'views/layout.ejs',
]

out = []
for f in FILES:
    data = open(f, 'rb').read()
    eol = 'CRLF' if b'\r\n' in data else 'LF'
    out.append(f"{f} | {eol} | {len(data)} octets")
    for i, l in enumerate(data.split(b'\n'), 1):
        if b'assets/images' in l or b'zurion.css' in l or b'storefront.css' in l:
            out.append(f"  L{i}: {l!r}")

open('/tmp/zurion_diag.txt', 'w').write('\n'.join(out) + '\n')
print('OK')
