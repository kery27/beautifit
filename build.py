# src/app.src.html 의 /*WIG*/ 자리에 src/wig.js 를 넣어 index.html 을 만든다.
# 사용법: python3 build.py   (src 를 고친 뒤 실행하고, index.html 을 함께 커밋)
from pathlib import Path

root = Path(__file__).parent
html = (root / 'src' / 'app.src.html').read_text(encoding='utf-8')
wig = (root / 'src' / 'wig.js').read_text(encoding='utf-8')
assert '/*WIG*/' in html, 'src/app.src.html 에 /*WIG*/ 자리가 없어요'
(root / 'index.html').write_text(html.replace('/*WIG*/', wig), encoding='utf-8')
print('index.html 을 만들었어요')
