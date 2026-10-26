import {createContext, useContext} from 'react';

/**
 * 자리 — 일이 붙어 있는 곳. 업무·부서.
 * 줄의 이름표를 누르면 그 자리 화면이 열린다.
 */
export type Place = {kind: 'unit' | 'dept'; id: string};
export const PlaceNav = createContext<(p: Place) => void>(() => {});
export const usePlaceNav = () => useContext(PlaceNav);
