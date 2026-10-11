# json

A stone for reading and writing JSON documents. `#[derive(Json)]` converts structs and enums directly.

```rok
use json;

#[derive(Json)]
struct User { name: str; age: u32; }

fn main() throws {
    let u: User = try json::from_str("{\"name\": \"ada\", \"age\": 36}");
    println(json::to_string(u));
}
```

| Function | Meaning |
|----------|---------|
| `from_str` | String to value |
| `to_string` | Value to a one-line string |
