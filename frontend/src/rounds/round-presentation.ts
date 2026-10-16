import type { PublicRound } from './round-contract.ts';

export const roundStatusLabels: Record<PublicRound['status'], { label: string; description: string }> = {
  PUBLISHED: { label: '공개 · 시작 전', description: '공개된 회차입니다. 경매 시작을 기다리고 있습니다.' },
  WAITING: { label: '시작 대기', description: '예약 시각이 지났으며 시작 조건을 기다리고 있습니다.' },
  ACTIVE: { label: '진행 중', description: '시작된 회차입니다. 개별 레인의 중단·보류 상태는 이 화면에 표시되지 않습니다.' },
  COMPLETED: { label: '종료', description: '회차의 경매 진행이 종료되었습니다.' },
  CANCELLED: { label: '취소', description: '취소된 회차입니다.' },
};
