## stone 이란

**stone** 은 rok 패키지입니다. `lib.rok` 와 `rok.rokon` 이 루트에 있는 git 저장소 하나가 stone 하나입니다. 레지스트리는 git 저장소인 [인덱스](https://github.com/rok-lang/rokstones.io-index) 하나가 전부입니다. 각 버전은 원래 저장소의 커밋을 가리키고, `rok` 는 그 커밋을 가져와 tree hash 로 검증합니다. 소스 tarball 을 올리는 서버는 없습니다.

## 사용하기

프로젝트 디렉토리에서 `rok add` 로 의존을 더합니다.

```sh
rok add geom            # 최신 버전과 호환되는 범위 (^0.3)
rok add geom@^0.2       # 범위를 직접
```

`rok add` 는 `rok.rokon` 의 `deps` 에 한 줄을 씁니다. 직접 써도 됩니다.

```rokon
Package {
    name: "app",
    version: "0.1.0",
    deps: {
        "geom": Dep::version("^0.3"),
    },
}
```

다음 `rok build` / `rok run` 이 인덱스를 받아 범위에 맞는 가장 높은 버전 (yanked 제외) 을 고르고 `rok.lock` 에 고정합니다. 코드에서는 `use geom::Shape;` 처럼 stone 이름으로 씁니다.

버전 요구는 `^1.2` (기본, 연산자 없는 버전도 같음), `~1.2.3`, `=1.0.0`, `>=1.2, <2`, `1.*`, `*` 입니다.

## publish 하기

서버도 계정도 없습니다. 인덱스 저장소에 한 줄을 더하는 커밋이 publish 입니다.

1. stone 저장소의 루트에 `lib.rok` 와 `rok.rokon` (`name`, `version`) 이 있고, work tree 가 깨끗하며, 커밋이 `origin` 에 push 되어 있어야 합니다. 의존은 stone 뿐이어야 합니다 (`Dep::path` / `Dep::git` 불가).
2. `rok publish` 로 인덱스에 들어갈 줄을 미리 봅니다 (dry run).
3. 인덱스를 fork 해서 checkout 한 뒤 줄을 더하고 커밋합니다.

   ```sh
   git clone https://github.com/<you>/rokstones.io-index
   rok publish --index rokstones.io-index --commit
   ```

4. 만든 커밋을 [인덱스 저장소](https://github.com/rok-lang/rokstones.io-index) 에 pull request 로 보냅니다. 병합되면 이 사이트에 나타납니다.

잘못 publish 한 버전은 지우지 않고 yank 합니다: `rok yank --vers 0.3.1 --index <checkout>` (되돌리기는 `--undo`). 이미 `rok.lock` 에 고정된 프로젝트는 그대로 쓸 수 있습니다.

인덱스의 줄 형식은 [인덱스 README](https://github.com/rok-lang/rokstones.io-index#readme) 에 있습니다.
