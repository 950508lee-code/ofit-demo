import {createContext, useContext} from 'react';

/**
 * 자리 — 일이 붙어 있는 곳. 업무·부서.
 * 줄의 이름표를 누르면 그 자리 화면이 열린다.
 */
export type Place = {kind: 'unit' | 'dept'; id: string};
/** 찾기 결과에서 왔을 때 업무 화면 안에서 갈 자리와 강조할 말. anchor = 'top' | 'guide' | 'duty:id' | 'step:반복업무id:순번'. */
export type Spot = {q: string; anchor: string; text?: string};
export const PlaceNav = createContext<(p: Place, spot?: Spot) => void>(() => {});
export const usePlaceNav = () => useContext(PlaceNav);
/** 내 업무로 가기. unitId 를 주면 그 업무를 펼쳐 보인다. */
export const WorkNav = createContext<(unitId?: string) => void>(() => {});
export const useWorkNav = () => useContext(WorkNav);
