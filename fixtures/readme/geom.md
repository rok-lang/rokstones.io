# geom

A small stone for 2D shapes: area, perimeter, and intersection tests. Numeric operations use [num](https://rokstones.io/stones/num.html).

## Usage

```rok
use geom::{Shape, area};

fn main() {
    let s = Shape::Rect { w: 2.0, h: 3.0 };
    println(f"area = {area(s):.2}");
}
```

## Docs

- [Changelog](CHANGELOG.md)
- [Examples directory](./examples/)

![Shapes diagram](docs/shapes.png)

<div onclick="alert(1)">This line must show as text, not HTML.</div>

[Suspicious link](javascript:alert(1))
