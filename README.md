# rokstones.io

rok 패키지 레지스트리 사이트입니다. rok 패키지는 **stone** 이라고 부릅니다. 사이트 생성기 자체도 rok 으로 작성했습니다. 레지스트리 인덱스 ([rokstones.io-index](https://github.com/rok-lang/rokstones.io-index)) checkout 을 읽어 `public/` 에 정적 사이트를 씁니다.

- 첫 페이지: stone 소개, 검색, 최근 publish / 가장 많이 의존하는 stone, 사용법, publish 방법
- `stones/index.html`: 모든 stone
- `stones/<name>.html`: 버전 목록 (yanked 표시), 최신 버전의 의존 (링크), 역의존, 소스 저장소와 커밋, 설치 방법, README
- `search-index.json` + `search.js`: 브라우저에서 하는 검색

## 빌드

준비물은 rok 툴체인 (`rok`, `rokc`), `git`, 그리고 인덱스 checkout 입니다. 기본 설정은 저장소들이 나란히 있다고 가정합니다.

```
Works/
├── rok-lang/              # impl/ (툴체인)
├── rokstones.io-index/    # 레지스트리 인덱스
└── rokstones.io/          # 이 저장소
```

툴체인이 없으면 먼저 빌드합니다.

```bash
cd ../rok-lang/impl
cargo build --release
export PATH="$PWD/target/release:$PATH"
```

그다음 이 저장소에서 실행합니다.

```bash
rok run                        # site.rokon 의 인덱스로 public/ 에 사이트 생성
rok run -- check               # 생성 + 깨진 내부 링크나 잘못된 인덱스 줄이 있으면 종료 코드 1
rok run -- --demo              # fixtures/ 의 예제 인덱스로 생성
rok run -- check --demo        # 예제로 생성 + 검사
rok run -- --offline           # README 를 git 으로 가져오지 않음 (캐시만)
rok run -- --index <dir>       # 다른 인덱스 checkout
rok test                       # 마크다운 렌더러, semver, 인덱스 줄 테스트
```

빌드가 끝나면 stone 수, README 를 찾은 stone 수, 인덱스 에러 수, 깨진 링크 수, 걸린 시간을 출력합니다. 링크 검사는 생성된 HTML 의 모든 `href` / `src` 의 대상 파일과 `#앵커` 가 있는지 확인합니다.

## 예제 인덱스 (`--demo`)

실제 인덱스는 아직 비어 있으므로, 사이트 모양을 확인할 수 있게 `fixtures/` 에 예제를 둡니다.

| 경로 | 내용 |
|------|------|
| `fixtures/index/` | 인덱스와 같은 배치의 stone 파일 8 개 (`num`, `geom`, `json`, `http`, `url`, `rx`, `check`, `old`). yanked 버전, pre-release, dev 의존, 다른 인덱스 의존, 모든 버전이 yanked 인 stone 이 들어 있습니다 |
| `fixtures/readme/<name>.md` | `--demo` 에서 git 대신 쓰는 README |

예제 stone 의 소스 url 은 실제로 없는 저장소이므로 `--demo` 에서는 git 을 실행하지 않습니다.

## README

stone 페이지의 README 는 최신 버전의 `source` (git url 과 커밋) 에서 가져옵니다. `.cache/git` 에 bare 저장소 하나를 두고 `git fetch --depth 1 <url> <commit>` 으로 그 커밋만 받은 뒤 `README.md` (또는 `readme.md`, `Readme.md`, `README`) 를 읽어 `.cache/readme/<name>/<commit>.md` 에 저장합니다. 커밋이 같으면 다음 빌드는 캐시를 씁니다. 오프라인이거나 가져오기에 실패하면 경고만 내고 README 없이 페이지를 만듭니다 (실패는 캐시하지 않으므로 다음 빌드가 다시 시도합니다).

README 는 누구나 쓴 글이므로 HTML 블록을 그대로 내보내지 않고 글자로 보이며, `http(s)` / `mailto` 가 아닌 링크는 지웁니다. 상대 링크는 GitHub / GitLab / Codeberg 저장소면 그 커밋의 파일 (이미지는 raw) 을 가리킵니다.

## 미리 보기

검색 색인을 `fetch` 로 읽기 때문에 `file://` 이 아니라 로컬 서버로 엽니다.

```bash
python3 -m http.server -d public 8000
# http://localhost:8000
```

## 설정

`site.rokon` (RokON) 에서 바꿉니다.

| 필드         | 뜻 |
|--------------|----|
| `title`      | 사이트 이름 |
| `tagline`    | 첫 페이지 부제 |
| `index`      | 인덱스 checkout (기본 `../rokstones.io-index`) |
| `index_repo` | 인덱스 저장소의 웹 주소 (stone 파일 링크, pull request 안내) |
| `base_url`   | 사이트 주소 (`https://rokstones.io`), canonical 링크에 씀 |
| `docs`       | 언어 문서 주소 (`https://rok-lang.org`) |
| `cache`      | README 캐시 디렉토리 (기본 `.cache`) |
| `out`        | 출력 디렉토리 (기본 `public`) |

## 구조

| 파일 | 내용 |
|------|------|
| `main.rok`      | 설정과 인자 읽기, 페이지 생성, 검색 색인, 정적 파일 복사, 링크 검사 |
| `stones.rok`    | 인덱스 읽기 (`Stone { .. }` 줄), semver 순서, 최신 버전, 역의존, README 가져오기 |
| `layout.rok`    | 페이지 틀 (헤더, 검색, 푸터), 첫 페이지, stone 목록, stone 페이지 |
| `markdown.rok`  | rok-lang.org 의 마크다운 렌더러 (README 용 `render_untrusted` 추가) |
| `highlight.rok` | rok-lang.org 의 ` ```rok ` / ` ```rokon ` 하이라이터 |
| `pages/index.md`| 첫 페이지의 설명 (stone 이란, 사용하기, publish 하기) |
| `static/`       | `style.css` (라이트 / 다크), `search.js`, 로고 |

최근 publish 순서와 날짜는 인덱스의 git 기록 (stone 파일을 마지막으로 바꾼 커밋) 에서 읽습니다. 인덱스가 git 저장소가 아니면 이름 순입니다.
