/* 사이트 설정 — 이 파일만 고치면 돼요 */
window.SITE_CONFIG = {
  /* 사이트 이름 */
  siteName: "스타트",

  /* 멀티뷰로 한 번에 볼 수 있는 방송 수 (2~6) */
  maxMultiView: 4,

  /* 유튜브 데이터 API 키 (멤버 플레이리스트용, 선택)
     - 넣으면: 플레이리스트 제목·표지·영상 목록까지 보여요.
     - 비워 두면: 플레이리스트가 유튜브 플레이어로만 보여요 (재생은 똑같이 돼요).
     - 키가 여러 개면 앞의 키가 한도를 넘거나 막혔을 때 다음 키를 써요.
     - 이 파일은 누구나 볼 수 있어요. 키는 꼭 Google Cloud 콘솔에서
       "HTTP 리퍼러(웹사이트 제한)"를 내 사이트 주소로, "API 제한"을 YouTube Data API v3 로 걸어 주세요. */
  youtubeApiKeys: [
    "AIzaSyC9YmEHvBFoPsy4WHVGraYNH0fsghqJho8",  // 키 1
    "AIzaSyA1HMY9Vb0z_7BlxNO0XA7ZEef-HABFov0",  // 키 2
    "AIzaSyALmZsgZ8Q46dBTeVAJgDlfI5NPoS_9R_0",  // 키 3
    "AIzaSyCbR2P_42l8eoWmSK9eIkBcU-Y7gcbzA9o"   // 키 4
  ]
};
