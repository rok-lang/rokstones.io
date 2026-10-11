# http

An HTTP/1.1 client and server built on `rok::std::net`.

```rok
fn main() throws {
    let res = try http::get("https://rok-lang.org");
    println(f"{res.status}");
}
```
