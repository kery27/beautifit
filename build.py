# src 원본을 합쳐 페이지를 만든다.
#  - index.html (헤어 미러) = src/app.src.html 의 /*WIG*/ 자리에 src/wig.js
#  - nail.html  (네일 미러) = src/nail.src.html 의 /*NAIL*/ 자리에 src/nail.js
# 사용법: python3 build.py   (src 를 고친 뒤 실행하고, 만들어진 html 을 함께 커밋)
from pathlib import Path

root = Path(__file__).parent
for page, src, lib, mark in [('index.html', 'app.src.html', 'wig.js', '/*WIG*/'), ('nail.html', 'nail.src.html', 'nail.js', '/*NAIL*/')]:
    html = (root / 'src' / src).read_text(encoding='utf-8')
    code = (root / 'src' / lib).read_text(encoding='utf-8')
    assert mark in html, f'src/{src} 에 {mark} 자리가 없어요'
    (root / page).write_text(html.replace(mark, code), encoding='utf-8')
    print(page, '을 만들었어요')
