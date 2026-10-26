import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
// 서체는 앱 안에 넣는다(외부 요청 0건 — 기관 업무망에서도 그대로 뜨게). 화면에 쓰인 글자 묶음만 불러오는 가변 서체.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
