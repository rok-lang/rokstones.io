# json

JSON 문서를 읽고 쓰는 stone 입니다. `#[derive(Json)]` 으로 struct 와 enum 을 그대로 변환합니다.

```rok
use json;

#[derive(Json)]
struct User { name: str; age: u32; }

fn main() throws {
    let u: User = try json::from_str("{\"name\": \"ada\", \"age\": 36}");
    println(json::to_string(u));
}
```

| 함수 | 뜻 |
|------|----|
| `from_str` | 문자열에서 값으로 |
| `to_string` | 값에서 한 줄 문자열로 |
