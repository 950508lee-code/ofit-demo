# UI·모션 조사 요약 (2026-10-15)

화면 위계·메뉴·화면 전환을 정할 때 근거로 쓴다. 출처는 조사 때 직접 연 페이지.

## 버튼 위계
- KRDS: 강조(채움)·기본(윤곽)·텍스트 3단계, "한 페이지에 최상위 강조 버튼은 한 번만". https://www.krds.go.kr/html/site/component/component_05_02.html
- Apple HIG: 눈에 띄는 버튼은 한 화면에 1~2개. https://developer.apple.com/design/human-interface-guidelines/buttons
- Material 3: 채움은 "흐름을 끝내는 중요한 동작". https://material-web.dev/components/button/
- 만들기 버튼 자리: 구글 캘린더 왼쪽 위 '만들기'(Shift+C), Linear 옆 메뉴 맨 위(C), Todoist(Q).
  - https://support.google.com/calendar/answer/72143
  - https://linear.app/docs/creating-issues
  - https://www.todoist.com/help/articles/introduction-to-tasks-080OAXric
- **OFIT:** 채운 버튼은 메뉴의 '일정 등록'과 끝내는 버튼(완료·보내기)뿐이다. 패널이 열리면 최대 2개가 된다. 이것은 Apple 기준에 맞고, KRDS의 '1개'와는 다르다.

## 메뉴
- KRDS 사이드 메뉴: 왼쪽, 2단계까지, `aria-current`. https://www.krds.go.kr/html/site/component/component_03_04.html
- KRDS 탭바: 5개 이내, 하단 고정, **아이콘+레이블 함께**. https://www.krds.go.kr/html/site/component/component_12_07.html
- Apple 탭바: 이동용이고 실행 버튼을 두지 않는다. 배지는 중요한 것에만. https://developer.apple.com/design/human-interface-guidelines/tab-bars
- KRDS 배지: 999+까지, 텍스트 레이블을 붙인다. https://www.krds.go.kr/html/site/component/component_04_06.html
- Linear 2026.3 개편: 옆 메뉴를 한 단계 흐리게 해서 작업 영역을 앞에 둔다. https://linear.app/now/behind-the-latest-design-refresh

## 목록·상세, 창
- 넓으면 목록+상세 나란히, 좁으면 하나씩. https://developer.android.com/develop/ui/compose/layouts/adaptive/list-detail
- KRDS 모달: "최후의 수단". 길면 본문 끝을 흐리고 버튼 영역은 하단에 고정. https://www.krds.go.kr/html/site/component/component_04_05.html
- 바텀시트: 짧은 상호작용에만 쓰고 닫기 버튼을 둔다.
  - https://www.nngroup.com/articles/bottom-sheet/
  - https://www.krds.go.kr/html/site/component/component_12_03.html
- KRDS 토스트: 한 줄, 2~3초. 스낵바에는 '되돌리기' 버튼을 1개까지 둘 수 있다.
  - https://www.krds.go.kr/html/site/component/component_12_05.html
  - https://www.krds.go.kr/html/site/component/component_12_06.html
- 빈 화면: 지금 상태, 기능 안내, 다음 할 일로 가는 길. https://www.nngroup.com/articles/empty-state-interface-design/
- Todoist 빠른 입력: 인식한 날짜를 강조하고, 눌러서 해제한다. https://todoist.com/help/articles/introduction-to-due-dates-and-due-times-q7VobO

## 글자
- KRDS: Pretendard GOV, 본문 17px, 행간 150% 이상, 굵기 400/500/700. https://www.krds.go.kr/html/site/style/style_03.html

## 화면 전환 모션
- 길이(NN/g): 단순한 반응은 약 100ms, 큰 변화는 200~300ms, 400ms부터 느리다. 닫힘은 열림보다 짧게. https://www.nngroup.com/articles/animation-duration/
- 곡선(Material 3, Flutter 소스로 확인): https://api.flutter.dev/flutter/material/Durations-class.html
  - standard `cubic-bezier(.2,0,0,1)`
  - 들어옴 `(.05,.7,.1,1)`
  - 나감 `(.3,0,.8,.15)`
- IBM Carbon: 업무용 '생산적' 모션과 '표현적' 모션을 나눈다. 토스트는 240ms. https://carbondesignsystem.com/elements/motion/overview/
- 패턴(Material 모션 시스템): https://material.io/design/motion/the-motion-system.html
  - 형제 화면(탭)은 fade through.
  - 목록→상세는 container transform.
  - 앞뒤 관계(달력)는 shared axis.
- Emil Kowalski: 300ms 이하, ease-out, transform·opacity만 쓴다. 키보드로 하는 동작에는 애니메이션을 넣지 않는다.
  - https://emilkowal.ski/ui/great-animations
  - https://emilkowal.ski/ui/you-dont-need-animations
- 접근성: WCAG 2.3.3, `prefers-reduced-motion`이면 이동을 빼고 투명도만 남긴다. https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- 기술:
  - View Transitions(같은 문서): Chrome/Edge 111+. https://developer.chrome.com/docs/web-platform/view-transitions/same-document
  - `@starting-style`: CSS만으로 등장 애니메이션. https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
  - React 19.3 `<ViewTransition>` 정식 출시(조사 보고, 버전 올릴 때 다시 확인). https://react.dev/blog/2026/09/09/react-19-3

### OFIT 모션 표 (거리·크기 값은 근거 없는 출발점)
| 상황 | 효과 | 길이(열림/닫힘) | 곡선 | 움직임 줄이기 |
|---|---|---|---|---|
| 메뉴 전환 | fade through, 0.98→1 | 90 나감 / 180 들어옴 | standard | 즉시 |
| 행→오른쪽 패널 | 24px 밀려 들어오기+투명도 | 250 / 180 | 들어옴 / 나감 | 투명도 120 |
| 폰 상세 | 오른쪽에서 들어오기 | 300 / 250 | 들어옴 / 나감 | 투명도 120 |
| 모달 | 투명도+0.96→1 | 200 / 150 | 들어옴 / 나감 | 투명도 120 |
| 폰 아래 창 | 아래에서 올라오기 | 300 / 250 | 들어옴 / 나감 | 투명도 120 |
| 주·달 넘김 | 방향 따라 ±24px | 200 | standard | 즉시 |
| 완료 후 재정렬 | FLIP 이동 | 250 | standard | 즉시 |
| 토스트 | 아래 16px에서 | 240 / 150 | 들어옴 | 투명도 |

## 특색은 어디서 오나 (2026-10-15 조사)
- Notion: "Everything you see in Notion is a block" — 손잡이·`/` 메뉴·종류 바꾸기가 모두 블록 하나를 드러냄. https://www.notion.com/blog/data-model-behind-notion
- Linear: 속도·키보드가 핵심(⌘K, ENG-123 이슈 ID). 색은 오히려 줄임(무채색에서 출발).
  - https://linear.app/now/invisible-details
  - https://linear.app/now/how-we-redesigned-the-linear-ui
- Things 3: Magic Plus(끌어다 놓은 자리에 생김), Today 아래 This Evening. https://culturedcode.com/things/features/
- Superhuman: 게이미피케이션이 아닌 게임 디자인 — Inbox Zero가 목표, 도달하면 풍경. https://blog.superhuman.com/game-design-not-gamification/
- Sunsama: 아침 계획·저녁 마무리라는 '정해진 순서'가 제품의 얼굴. https://www.sunsama.com/features/daily-planning-and-shutdown
- 토스: 가입 과정 모든 화면에서 할 일을 하나로 제한, 쉬운 말. https://toss.im/tossfeed/article/importance-simplicity
- 공통 원칙(정리):
  1. 개념 하나를 화면 모든 곳에 드러낸다.
  2. 대표 동작이 하나 있다.
  3. 고유한 이름표·어휘를 고정한다.
  4. 빈 상태·끝 상태를 설계한다.
  5. 색이 아니라 구조·밀도로 말한다.
- OFIT의 개념 후보: **일의 주인은 사람이 아니라 업무(자리)**.
