# geom

2차원 기하 도형과 넓이, 둘레, 교차 판정을 제공하는 작은 stone 입니다. 수 연산은 [num](https://rokstones.io/stones/num.html) 을 씁니다.

## 사용

```rok
use geom::{Shape, area};

fn main() {
    let s = Shape::Rect { w: 2.0, h: 3.0 };
    println(f"area = {area(s):.2}");
}
```

## 문서

- [변경 기록](CHANGELOG.md)
- [예제 디렉토리](./examples/)

![도형 그림](docs/shapes.png)

<div onclick="alert(1)">이 줄은 HTML 이 아니라 글자로 보여야 합니다.</div>

[이상한 링크](javascript:alert(1))
