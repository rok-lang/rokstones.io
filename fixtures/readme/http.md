# http

`rok::std::net` 위에 만든 HTTP/1.1 클라이언트와 서버입니다.

```rok
fn main() throws {
    let res = try http::get("https://rok-lang.org");
    println(f"{res.status}");
}
```
