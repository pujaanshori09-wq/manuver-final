/**
 * Push notification texts in every app language. The receiver's language decides
 * (profiles.language); English when it is not set. Placeholders: {name}, {sport}.
 */
type Texts = {
  matchTitle: string;
  matchBody: string;
  invite: string;
  accepted: string;
  declined: string;
};

export const PUSH_TEXT: Record<string, Texts> = {
  EN: {
    matchTitle: "It's a match!",
    matchBody: 'You and {name} both want to play. Say hi!',
    invite: '{name} invited you to play {sport}',
    accepted: '{name} accepted your {sport} invite',
    declined: "{name} can't make it to {sport} this time",
  },
  ID: {
    matchTitle: 'Kamu match!',
    matchBody: 'Kamu dan {name} sama-sama mau olahraga bareng. Sapa duluan!',
    invite: '{name} ngajak kamu sparing {sport}',
    accepted: '{name} menerima ajakan {sport}-mu',
    declined: '{name} belum bisa ikut {sport} kali ini',
  },
  ZH: {
    matchTitle: '配对成功！',
    matchBody: '你和{name}都想一起运动。打个招呼吧！',
    invite: '{name}邀请你一起打{sport}',
    accepted: '{name}接受了你的{sport}邀请',
    declined: '{name}这次没法参加{sport}',
  },
  ES: {
    matchTitle: '¡Es un match!',
    matchBody: 'Tú y {name} quieren hacer deporte juntos. ¡Saluda!',
    invite: '{name} te invitó a jugar {sport}',
    accepted: '{name} aceptó tu invitación de {sport}',
    declined: '{name} no puede ir a {sport} esta vez',
  },
  HI: {
    matchTitle: 'मैच हो गया!',
    matchBody: 'आप और {name} दोनों साथ खेलना चाहते हैं। हाय बोलिए!',
    invite: '{name} ने आपको {sport} खेलने बुलाया',
    accepted: '{name} ने आपका {sport} न्योता स्वीकार किया',
    declined: '{name} इस बार {sport} में नहीं आ पाएँगे',
  },
  PT: {
    matchTitle: 'Deu match!',
    matchBody: 'Você e {name} querem treinar juntos. Diga oi!',
    invite: '{name} convidou você para jogar {sport}',
    accepted: '{name} aceitou seu convite de {sport}',
    declined: '{name} não pode ir ao {sport} desta vez',
  },
  RU: {
    matchTitle: 'Это мэтч!',
    matchBody: 'Вы и {name} хотите позаниматься вместе. Напишите первым!',
    invite: '{name} зовёт вас на {sport}',
    accepted: '{name} принял(а) ваше приглашение на {sport}',
    declined: '{name} не сможет прийти на {sport} в этот раз',
  },
  JA: {
    matchTitle: 'マッチしました！',
    matchBody: 'あなたと{name}さんは一緒に運動したいと思っています。あいさつしよう！',
    invite: '{name}さんから{sport}のお誘いが届きました',
    accepted: '{name}さんが{sport}のお誘いを受けました',
    declined: '{name}さんは今回の{sport}に参加できません',
  },
  DE: {
    matchTitle: "Es ist ein Match!",
    matchBody: 'Du und {name} wollt zusammen Sport machen. Sag hallo!',
    invite: '{name} lädt dich zu {sport} ein',
    accepted: '{name} hat deine Einladung zu {sport} angenommen',
    declined: '{name} kann diesmal nicht zu {sport} kommen',
  },
  FR: {
    matchTitle: "C'est un match !",
    matchBody: 'Toi et {name} voulez faire du sport ensemble. Dis bonjour !',
    invite: "{name} t'invite à jouer au {sport}",
    accepted: '{name} a accepté ton invitation au {sport}',
    declined: '{name} ne peut pas venir au {sport} cette fois',
  },
  KO: {
    matchTitle: '매치됐어요!',
    matchBody: '{name}님과 함께 운동하고 싶어요. 먼저 인사해 보세요!',
    invite: '{name}님이 {sport} 하자고 초대했어요',
    accepted: '{name}님이 {sport} 초대를 수락했어요',
    declined: '{name}님은 이번 {sport}에 참여하기 어려워요',
  },
  VI: {
    matchTitle: 'Tương hợp rồi!',
    matchBody: 'Bạn và {name} đều muốn tập cùng nhau. Chào nhau đi!',
    invite: '{name} mời bạn chơi {sport}',
    accepted: '{name} đã nhận lời mời {sport} của bạn',
    declined: '{name} lần này chưa thể tham gia {sport}',
  },
  TH: {
    matchTitle: 'แมตช์แล้ว!',
    matchBody: 'คุณกับ {name} อยากออกกำลังกายด้วยกัน ทักทายเลย!',
    invite: '{name} ชวนคุณเล่น {sport}',
    accepted: '{name} ตอบรับคำชวนเล่น {sport} ของคุณแล้ว',
    declined: '{name} ไปเล่น {sport} ครั้งนี้ไม่ได้',
  },
  MS: {
    matchTitle: 'Anda sepadan!',
    matchBody: 'Anda dan {name} sama-sama mahu bersukan. Tegurlah dulu!',
    invite: '{name} mengajak anda bermain {sport}',
    accepted: '{name} menerima ajakan {sport} anda',
    declined: '{name} tidak dapat menyertai {sport} kali ini',
  },
};

export function pushText(language: string | null | undefined, key: keyof Texts, vars: Record<string, string> = {}) {
  const t = (PUSH_TEXT[language ?? 'EN'] ?? PUSH_TEXT.EN!)[key];
  return t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}
