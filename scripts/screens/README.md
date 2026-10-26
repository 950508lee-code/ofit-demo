# 화면 점검 캡처

개발 서버(포트 5180)를 켠 상태에서, 크롬을 개발자 프로토콜로 조종해 상태별 화면을 찍는다.

```
node scripts/screens/scenes.mjs scripts/screens/scenes.json
node scripts/screens/shoot.mjs scripts/screens/scenes.json <저장 폴더>
```

장면은 `scenes.mjs` 에서 고친다(첫 화면, 가입 단계, 할 일, 업무 카드, 내 업무, 업무 추가, 인수인계, 조직 등록, 폰 크기).
